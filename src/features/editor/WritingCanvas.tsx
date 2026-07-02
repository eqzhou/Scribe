/**
 * WritingCanvas 写作画布
 *
 * 中部 720px 文本柱 + TipTap 富文本编辑器。
 * - 顶栏：章节标题（可编辑）+ 字数统计（实时 countWords）+ 状态标识 + 保存状态
 * - TipTap：StarterKit + SceneDivider + CharacterMention + WorldviewRef + AIGhostText
 * - 接入 useAutoSave（debounce 1500ms + 重试 3 次）
 * - 章节状态联动：编辑 done 章节时提示回退
 * - AI 工具栏：续写 / 改写 / 润色 / 扩写 / 全文生成（流式插入 ghost 文本，Tab 接受 / Esc 拒绝）
 * - 大纲面板：章节大纲编辑器，debounce 自动保存
 *
 * 视图层拆分：
 * - EditorTopBar：顶栏（标题 / 大纲按钮 / 状态徽章 / 字数 / 容量 / 保存 / 章节操作）
 * - EditorToolbar：格式与 AI 工具栏
 * - OutlinePanel：右侧大纲抽屉
 * - useSaveStatusDisplay：保存状态徽章展示
 * - useAIEditorActions：AI 写作操作与对应弹窗状态
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Download, FileText } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../lib/db';
import { chapterRepository } from '../../lib/repositories';
import { downloadJson } from '../../lib/exporter';
import type { Chapter, Character, WorldviewEntry } from '../../types';
import type { RewriteStyle } from '../../types/ai';
import { useEditorStore, useBookStore, useToastStore } from '../../stores';
import { useAutoSave } from '../../hooks';
import { countWords } from '../../utils/wordCount';
import { getContentSizeKB, getCapacityLevel } from '../../utils/contentSize';
import { Modal, Button, ConfirmDialog } from '../../components/ui';
import { SceneDivider } from './nodes/SceneDivider';
import { CharacterMention } from './nodes/CharacterMention';
import { WorldviewRef } from './nodes/WorldviewRef';
import { AIGhostText } from './nodes/AIGhostText';
import { EditorTopBar } from './EditorTopBar';
import { EditorToolbar } from './EditorToolbar';
import { OutlinePanel } from './OutlinePanel';
import { useSaveStatusDisplay } from './hooks/useSaveStatusDisplay';
import { useAIEditorActions } from './hooks/useAIEditorActions';

export interface WritingCanvasProps {
  chapter: Chapter;
  bookId: string;
}

/** 大纲自动保存 debounce 间隔（毫秒） */
const OUTLINE_DEBOUNCE_MS = 1000;

/**
 * 写作画布：TipTap 编辑器 + 顶栏 + 工具栏。
 */
export function WritingCanvas({ chapter, bookId }: WritingCanvasProps) {
  const setUnsavedContent = useEditorStore((s) => s.setUnsavedContent);
  const saveStatus = useEditorStore((s) => s.saveStatus);
  const lastSavedAt = useEditorStore((s) => s.lastSavedAt);
  const { currentBookId } = useBookStore();
  const pushToast = useToastStore((s) => s.pushToast);
  const [title, setTitle] = useState(chapter.title);
  const [pickerOpen, setPickerOpen] = useState<'character' | 'worldview' | null>(null);
  const [notifiedDone, setNotifiedDone] = useState(false);
  const [content, setContent] = useState(chapter.content);
  const [editorReady, setEditorReady] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [confirmRestore, setConfirmRestore] = useState(false);
  const [saveFailureOpen, setSaveFailureOpen] = useState(false);

  // 大纲面板状态
  const [outlineOpen, setOutlineOpen] = useState(false);
  const [outlineText, setOutlineText] = useState(chapter.outline ?? '');
  const [outlineSaving, setOutlineSaving] = useState(false);
  const [outlineSaved, setOutlineSaved] = useState(false);
  const outlineTimerRef = useRef<number | null>(null);

  // 用于 onUpdate 闭包内读取最新 chapter 状态，避免 stale closure
  const chapterRef = useRef(chapter);
  useEffect(() => {
    chapterRef.current = chapter;
  }, [chapter]);
  const notifiedDoneRef = useRef(false);

  // 实时监听角色与世界观（供插入提及/引用）
  const characters = useLiveQuery(
    async () => {
      if (!bookId) return [] as Character[];
      return db.characters.where('bookId').equals(bookId).toArray();
    },
    [bookId],
    [],
  );
  const worldviewEntries = useLiveQuery(
    async () => {
      if (!bookId) return [] as WorldviewEntry[];
      return db.worldview.where('bookId').equals(bookId).toArray();
    },
    [bookId],
    [],
  );

  // TipTap 编辑器
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      SceneDivider,
      CharacterMention,
      WorldviewRef,
      AIGhostText,
    ],
    content: chapter.content,
    onUpdate: ({ editor: ed }) => {
      const html = ed.getHTML();
      setContent(html);
      setUnsavedContent(html);
      // 编辑 done 章节时自动回退为 writing + toast（每次切换章节仅提示一次）
      const current = chapterRef.current;
      if (current.status === 'done' && !notifiedDoneRef.current) {
        notifiedDoneRef.current = true;
        setNotifiedDone(true);
        void chapterRepository
          .update(current.id, { status: 'writing' })
          .catch((err) => {
            useToastStore
              .getState()
              .pushToast('error', `状态回退失败：${err instanceof Error ? err.message : String(err)}`);
          });
        useToastStore
          .getState()
          .pushToast('warning', '已完成章节被修改，状态已回退为「写作中」');
      }
    },
    onCreate: () => {
      setEditorReady(true);
    },
    editorProps: {
      attributes: {
        class: 'prose-editor min-h-[60vh] focus:outline-none',
        spellcheck: 'false',
      },
    },
  });

  // 接入自动保存（debounce 1500ms + 重试 3 次 + WritingLog 同步）
  const { saveNow } = useAutoSave(chapter.id, content);

  // 章节切换时重置编辑器内容与标题、大纲
  useEffect(() => {
    if (!editor || !editorReady) return;
    editor.commands.setContent(chapter.content || '', { emitUpdate: false });
    setContent(chapter.content);
    setTitle(chapter.title);
    setOutlineText(chapter.outline ?? '');
    setNotifiedDone(false);
    notifiedDoneRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapter.id, editorReady]);

  // 大纲自动保存（debounce）
  useEffect(() => {
    if (outlineTimerRef.current !== null) {
      window.clearTimeout(outlineTimerRef.current);
    }
    if (outlineText === (chapter.outline ?? '')) {
      setOutlineSaved(false);
      return;
    }
    setOutlineSaved(false);
    outlineTimerRef.current = window.setTimeout(async () => {
      setOutlineSaving(true);
      try {
        await chapterRepository.update(chapter.id, { outline: outlineText });
        setOutlineSaving(false);
        setOutlineSaved(true);
        window.setTimeout(() => setOutlineSaved(false), 1500);
      } catch {
        setOutlineSaving(false);
        useToastStore.getState().pushToast('error', '大纲保存失败');
      }
    }, OUTLINE_DEBOUNCE_MS);

    return () => {
      if (outlineTimerRef.current !== null) {
        window.clearTimeout(outlineTimerRef.current);
      }
    };
  }, [outlineText, chapter.id, chapter.outline]);

  // 编辑器快捷键：Ctrl/Cmd+S 立即保存，Ctrl/Cmd+Shift+K 插入引文块
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (!meta) return;
      const key = e.key.toLowerCase();
      // Ctrl/Cmd+S：立即保存（跳过 debounce）
      if (key === 's' && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        void saveNow();
        return;
      }
      // Ctrl/Cmd+Shift+K：插入引文块
      if (key === 'k' && e.shiftKey && !e.altKey) {
        e.preventDefault();
        editor?.chain().focus().toggleBlockquote().run();
        return;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editor, saveNow]);

  // 保存失败时弹出兜底对话框（提供导出当前章节按钮）
  useEffect(() => {
    if (saveStatus === 'failed') {
      setSaveFailureOpen(true);
    }
  }, [saveStatus]);

  // 标题更新（失焦保存）
  const handleTitleBlur = async (): Promise<void> => {
    const trimmed = title.trim();
    try {
      if (trimmed && trimmed !== chapter.title) {
        await chapterRepository.update(chapter.id, { title: trimmed });
      } else if (!trimmed) {
        setTitle(chapter.title);
      }
    } catch (err) {
      pushToast('error', `标题保存失败：${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // 标记完成（二次确认）
  const [confirmDone, setConfirmDone] = useState(false);
  const handleMarkDone = async (): Promise<void> => {
    try {
      await chapterRepository.update(chapter.id, { status: 'done' });
      setConfirmDone(false);
      pushToast('success', `章节「${chapter.title}」已标记为完成`);
    } catch (err) {
      pushToast('error', `标记完成失败：${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // 归档（done→archived，二次确认）
  const handleArchive = async (): Promise<void> => {
    try {
      await chapterRepository.update(chapter.id, { status: 'archived' });
      notifiedDoneRef.current = false;
      pushToast('success', `章节「${chapter.title}」已归档`);
    } catch (err) {
      pushToast('error', `归档失败：${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // 恢复写作（archived→writing，二次确认）
  const handleRestore = async (): Promise<void> => {
    try {
      await chapterRepository.update(chapter.id, { status: 'writing' });
      notifiedDoneRef.current = false;
      pushToast('success', `章节「${chapter.title}」已恢复为「写作中」`);
    } catch (err) {
      pushToast('error', `恢复写作失败：${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // 导出当前章节为 JSON 备份（保存失败兜底）
  const handleExportChapter = (): void => {
    const payload = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      type: 'chapter-backup',
      chapter: {
        id: chapter.id,
        bookId: chapter.bookId,
        title: title || chapter.title,
        content,
        summary: chapter.summary,
        outline: outlineText,
        status: chapter.status,
        wordCount: countWords(content),
        updatedAt: Date.now(),
      },
    };
    downloadJson(JSON.stringify(payload, null, 2), `scribe-chapter-${chapter.id}-${Date.now()}.json`);
    setSaveFailureOpen(false);
    pushToast('success', '章节备份已下载');
  };

  // 编辑 done 章节时显示回退提示横幅（实际回退在 onUpdate 中执行）
  const isDoneChapter = chapter.status === 'done';

  // 工具栏操作
  const toggleBold = () => editor?.chain().focus().toggleBold().run();
  const toggleItalic = () => editor?.chain().focus().toggleItalic().run();
  const toggleBlockquote = () => editor?.chain().focus().toggleBlockquote().run();
  const insertDivider = () =>
    editor?.chain().focus().insertContent({ type: 'sceneDivider' }).run();

  const insertCharacterMention = (characterId: string, label: string) => {
    editor
      ?.chain()
      .focus()
      .insertContent({
        type: 'characterMention',
        attrs: { characterId, label },
      })
      .run();
    setPickerOpen(null);
  };

  const insertWorldviewRef = (worldviewId: string, label: string) => {
    editor
      ?.chain()
      .focus()
      .insertContent({
        type: 'worldviewRef',
        attrs: { worldviewId, label },
      })
      .run();
    setPickerOpen(null);
  };

  // ===== AI 写作操作（由 useAIEditorActions hook 托管） =====
  const {
    aiBusy,
    styleModalOpen,
    setStyleModalOpen,
    fulltextModalOpen,
    setFulltextModalOpen,
    fulltextOutline,
    setFulltextOutline,
    handleAIContinue,
    handleAIRewriteAction,
    handleConfirmRewrite,
    handleAIFulltext,
    handleConfirmFulltext,
    handleAICancel,
  } = useAIEditorActions({
    editor,
    bookId,
    currentBookId,
    chapterId: chapter.id,
    chapterTitle: chapter.title,
    outlineText,
  });

  // 实时字数统计
  const wordCount = useMemo(() => countWords(content), [content]);

  // 容量信息
  const sizeKB = useMemo(() => getContentSizeKB(content), [content]);
  const capacityLevel = useMemo(() => getCapacityLevel(content), [content]);

  const saveDisplay = useSaveStatusDisplay(saveStatus, lastSavedAt);

  // 容量徽章颜色
  const capacityBadgeCls =
    capacityLevel === 'danger'
      ? 'bg-destructive/15 text-destructive border-destructive/30'
      : capacityLevel === 'warning'
        ? 'bg-warning/15 text-warning border-warning/30'
        : 'bg-muted-foreground/10 text-muted-foreground border-transparent';

  // 容量详细提示
  const capacityTooltip =
    capacityLevel === 'danger'
      ? `章节内容已超过 100KB 上限（当前 ${sizeKB} KB），建议拆分为多章以保证保存与加载性能`
      : capacityLevel === 'warning'
        ? `章节内容已接近上限（当前 ${sizeKB} KB / 100KB），请注意控制篇幅`
        : `章节内容大小：${sizeKB} KB / 100KB`;

  return (
    <div className="flex h-full flex-1 flex-col overflow-hidden bg-background/30">
      {/* 顶栏：标题 + 字数 + 状态 + 保存 */}
      <EditorTopBar
        title={title}
        onTitleChange={setTitle}
        onTitleBlur={handleTitleBlur}
        outlineOpen={outlineOpen}
        onOutlineOpen={() => setOutlineOpen(true)}
        status={chapter.status}
        wordCount={wordCount}
        sizeKB={sizeKB}
        capacityLevel={capacityLevel}
        capacityBadgeCls={capacityBadgeCls}
        capacityTooltip={capacityTooltip}
        saveDisplay={saveDisplay}
        onMarkDone={() => setConfirmDone(true)}
        onArchive={() => setConfirmArchive(true)}
        onRestore={() => setConfirmRestore(true)}
      />

      {/* 主体内容区：编辑器 + 大纲面板 */}
      <div className="flex flex-1 overflow-hidden">
        {/* 编辑器区域 */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* 工具栏 */}
          <EditorToolbar
            onToggleBold={toggleBold}
            onToggleItalic={toggleItalic}
            onToggleBlockquote={toggleBlockquote}
            onInsertDivider={insertDivider}
            onPickCharacter={() => setPickerOpen('character')}
            onPickWorldview={() => setPickerOpen('worldview')}
            aiBusy={aiBusy}
            onAIContinue={handleAIContinue}
            onAIRewriteAction={handleAIRewriteAction}
            onAIFulltext={handleAIFulltext}
            onAICancel={handleAICancel}
          />

          {/* 编辑器区：模拟精致实体宣纸稿笺稿纸 */}
          <div className="flex-1 overflow-y-auto bg-muted/10 transition-all duration-300">
            <div className="mx-auto max-w-[760px] px-6 py-9">
              {notifiedDone && isDoneChapter && (
                <div className="mb-5 rounded-lg border border-secondary/30 bg-secondary/5 px-4 py-2.5 text-xs text-secondary shadow-sm animate-fade-in">
                  已完成章节被修改后，状态将自动回退为「写作中」。
                </div>
              )}
              <div className="bg-background border border-border/60 rounded-xl shadow-premium px-10 py-12 transition-all duration-300 relative min-h-[75vh]">
                {/* 稿纸防刺眼毛玻璃感 */}
                <div className="absolute inset-0 pointer-events-none rounded-xl bg-gradient-to-b from-muted/5 via-transparent to-muted/5 opacity-50" />
                <EditorContent editor={editor} />
              </div>
            </div>
          </div>
        </div>

        {/* 大纲面板 */}
        <OutlinePanel
          open={outlineOpen}
          outlineText={outlineText}
          onOutlineTextChange={setOutlineText}
          onClose={() => setOutlineOpen(false)}
          outlineSaving={outlineSaving}
          outlineSaved={outlineSaved}
        />
      </div>

      {/* 角色选择弹窗 */}
      <Modal
        open={pickerOpen === 'character'}
        onClose={() => setPickerOpen(null)}
        title="插入角色提及"
        width="420px"
      >
        <div className="flex flex-col gap-2">
          {characters && characters.length > 0 ? (
            characters.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => insertCharacterMention(c.id, c.name)}
                className="flex items-center gap-2 rounded border border-border bg-muted px-3 py-2 text-left transition-all hover:border-secondary hover:shadow-soft"
              >
                <span
                  className="flex h-7 w-7 items-center justify-center rounded-full font-brush text-xs text-white"
                  style={{ background: c.appearanceColor || '#3d4a3d' }}
                  aria-hidden="true"
                >
                  {c.name.slice(0, 1)}
                </span>
                <div className="flex-1">
                  <p className="font-serif text-sm font-medium text-foreground">{c.name}</p>
                  {c.alias && (
                    <p className="text-[11px] text-muted-foreground">别名：{c.alias}</p>
                  )}
                </div>
              </button>
            ))
          ) : (
            <p className="py-6 text-center text-xs text-muted-foreground">
              暂无角色，请先在角色页创建。
            </p>
          )}
        </div>
      </Modal>

      {/* 世界观选择弹窗 */}
      <Modal
        open={pickerOpen === 'worldview'}
        onClose={() => setPickerOpen(null)}
        title="插入世界观引用"
        width="420px"
      >
        <div className="flex flex-col gap-2">
          {worldviewEntries && worldviewEntries.length > 0 ? (
            worldviewEntries.map((w) => (
              <button
                key={w.id}
                type="button"
                onClick={() => insertWorldviewRef(w.id, w.title)}
                className="rounded border border-border bg-muted px-3 py-2 text-left transition-all hover:border-secondary hover:shadow-soft"
              >
                <p className="font-serif text-sm font-medium text-foreground">{w.title}</p>
                <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                  {w.content.replace(/<[^>]+>/g, '') || '暂无内容'}
                </p>
              </button>
            ))
          ) : (
            <p className="py-6 text-center text-xs text-muted-foreground">
              暂无世界观条目，请先在世界观页创建。
            </p>
          )}
        </div>
      </Modal>

      {/* 标记完成确认 */}
      <Modal
        open={confirmDone}
        onClose={() => setConfirmDone(false)}
        title="标记章节完成"
        width="440px"
      >
        <div className="flex flex-col gap-4">
          <p className="font-serif text-sm leading-relaxed text-foreground">
            确认将章节「{chapter.title}」标记为已完成？
            <br />
            <span className="text-xs text-muted-foreground">
              已完成的章节再次编辑时，状态将自动回退为「写作中」。
            </span>
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="md" onClick={() => setConfirmDone(false)}>
              取消
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={handleMarkDone}
              className="bg-moss hover:bg-moss/90"
            >
              确认完成
            </Button>
          </div>
        </div>
      </Modal>

      {/* AI 改写风格选择弹窗 */}
      <Modal
        open={styleModalOpen !== null}
        onClose={() => setStyleModalOpen(null)}
        title={
          styleModalOpen?.action === 'rewrite'
            ? 'AI 改写'
            : styleModalOpen?.action === 'polish'
              ? 'AI 润色'
              : 'AI 扩写'
        }
        width="480px"
      >
        <div className="flex flex-col gap-4">
          <p className="font-serif text-sm text-muted-foreground">
            选择目标风格，AI 将根据选中文本进行处理：
          </p>
          <div className="grid grid-cols-3 gap-2">
            {(['冷峻', '华丽', '白描', '幽默', '悲怆', '热血'] as RewriteStyle[]).map(
              (s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => handleConfirmRewrite(s)}
                  className="rounded-lg border border-border bg-background px-3 py-3 font-serif text-sm text-foreground transition-all hover:border-primary hover:bg-primary/5 hover:shadow-soft"
                >
                  {s}
                </button>
              ),
            )}
          </div>
          <div className="flex justify-end gap-2 border-t border-border/60 pt-3">
            <Button
              variant="ghost"
              size="md"
              onClick={() => handleConfirmRewrite(undefined)}
            >
              默认风格
            </Button>
            <Button variant="ghost" size="md" onClick={() => setStyleModalOpen(null)}>
              取消
            </Button>
          </div>
        </div>
      </Modal>

      {/* AI 全文生成弹窗 */}
      <Modal
        open={fulltextModalOpen}
        onClose={() => setFulltextModalOpen(false)}
        title="AI 全文生成"
        width="520px"
      >
        <div className="flex flex-col gap-4">
          <p className="font-serif text-sm text-muted-foreground">
            输入本章大纲（可选），AI 将根据大纲生成整章正文：
          </p>
          <textarea
            value={fulltextOutline}
            onChange={(e) => setFulltextOutline(e.target.value)}
            placeholder="例如：主角在森林中迷路，偶遇神秘老者，得知自己的身世之谜……"
            className="h-40 w-full resize-none rounded-lg border border-border bg-background px-3 py-2 font-serif text-sm text-foreground placeholder:text-muted-foreground focus:border-secondary focus:outline-none"
          />
          <div className="flex justify-end gap-2 border-t border-border/60 pt-3">
            <Button variant="ghost" size="md" onClick={() => setFulltextModalOpen(false)}>
              取消
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={handleConfirmFulltext}
              icon={<FileText className="h-3.5 w-3.5" aria-hidden="true" />}
            >
              开始生成
            </Button>
          </div>
        </div>
      </Modal>

      {/* 归档确认 */}
      <ConfirmDialog
        open={confirmArchive}
        title="归档章节"
        message={`确认将章节「${chapter.title}」归档？归档后章节不计入主进度统计，但正文仍保留，可随时恢复为「写作中」。`}
        confirmText="归档"
        cancelText="取消"
        onConfirm={handleArchive}
        onClose={() => setConfirmArchive(false)}
      />

      {/* 恢复写作确认 */}
      <ConfirmDialog
        open={confirmRestore}
        title="恢复章节"
        message={`确认将归档章节「${chapter.title}」恢复为「写作中」？`}
        confirmText="恢复写作"
        cancelText="取消"
        onConfirm={handleRestore}
        onClose={() => setConfirmRestore(false)}
      />

      {/* 保存失败兜底对话框 */}
      <Modal
        open={saveFailureOpen}
        onClose={() => setSaveFailureOpen(false)}
        title="章节保存失败"
        width="460px"
      >
        <div className="flex flex-col gap-4">
          <p className="font-serif text-sm leading-relaxed text-foreground">
            章节内容已连续 3 次保存失败，建议立即导出当前章节作为本地备份，避免数据丢失。
          </p>
          <p className="text-xs text-muted-foreground">
            当前未保存内容仍保留在编辑器内存中，可尝试刷新页面或清理浏览器存储后重试。
          </p>
          <div className="flex justify-end gap-2 border-t border-border/60 pt-3">
            <Button variant="ghost" size="md" onClick={() => setSaveFailureOpen(false)}>
              稍后处理
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={handleExportChapter}
              icon={<Download className="h-3.5 w-3.5" aria-hidden="true" />}
            >
              导出当前章节
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default WritingCanvas;
