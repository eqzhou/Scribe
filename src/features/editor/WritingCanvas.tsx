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
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import {
  Bold,
  Italic,
  Quote,
  Minus,
  AtSign,
  Hash,
  Save,
  Check,
  AlertCircle,
  Loader2,
  Sparkles,
  Wand2,
  Feather,
  Expand,
  Archive,
  RotateCcw,
  Download,
  FileText,
  HardDrive,
  BookOpen,
  X,
} from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../lib/db';
import { chapterRepository } from '../../lib/repositories';
import { downloadJson } from '../../lib/exporter';
import type { Chapter, ChapterStatus, Character, WorldviewEntry } from '../../types';
import type { RewriteStyle } from '../../types/ai';
import { useEditorStore, useBookStore, useAIStore, useToastStore } from '../../stores';
import { useAutoSave } from '../../hooks';
import { countWords, formatWordCount } from '../../utils/wordCount';
import { cn } from '../../utils/cn';
import { Modal, Button, ConfirmDialog } from '../../components/ui';
import { SceneDivider } from './nodes/SceneDivider';
import { CharacterMention } from './nodes/CharacterMention';
import { WorldviewRef } from './nodes/WorldviewRef';
import { AIGhostText } from './nodes/AIGhostText';
import { executeContinue, executeRewrite, executeFulltextEditor } from '../../lib/aiTools';

export interface WritingCanvasProps {
  chapter: Chapter;
  bookId: string;
}

/** 章节状态 → 中文标签 + 颜色 */
const STATUS_BADGE: Record<ChapterStatus, { label: string; cls: string }> = {
  draft: { label: '草稿', cls: 'bg-secondary/15 text-secondary' },
  writing: { label: '写作中', cls: 'bg-primary/15 text-primary' },
  done: { label: '已完成', cls: 'bg-moss/15 text-moss' },
  archived: { label: '已归档', cls: 'bg-muted-foreground/15 text-muted-foreground' },
};

/** 内容容量等级 */
type CapacityLevel = 'normal' | 'warning' | 'danger';

/** 章节内容大小上限（字节） */
const CONTENT_SIZE_LIMIT = 100 * 1024;
/** 警告阈值（字节）：80KB */
const CONTENT_WARNING_THRESHOLD = 80 * 1024;

/** 大纲自动保存 debounce 间隔（毫秒） */
const OUTLINE_DEBOUNCE_MS = 1000;

/**
 * 计算章节内容大小（KB，保留 1 位小数）
 * 使用 UTF-16 码元估算：content.length * 2
 */
function getContentSizeKB(content: string): number {
  const bytes = content.length * 2;
  return Math.round((bytes / 1024) * 10) / 10;
}

/**
 * 获取容量等级：normal / warning / danger
 */
function getCapacityLevel(content: string): CapacityLevel {
  const bytes = content.length * 2;
  if (bytes > CONTENT_SIZE_LIMIT) return 'danger';
  if (bytes > CONTENT_WARNING_THRESHOLD) return 'warning';
  return 'normal';
}

/** 保存状态 → 显示配置 */
function useSaveStatusDisplay() {
  const saveStatus = useEditorStore((s) => s.saveStatus);
  const lastSavedAt = useEditorStore((s) => s.lastSavedAt);
  const [timeStr, setTimeStr] = useState('');

  useEffect(() => {
    if (saveStatus === 'saved' && lastSavedAt) {
      const d = new Date(lastSavedAt);
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      setTimeStr(`${hh}:${mm}`);
    }
  }, [saveStatus, lastSavedAt]);

  if (saveStatus === 'saving') {
    return { icon: Loader2, text: '保存中…', cls: 'text-foreground', spin: true };
  }
  if (saveStatus === 'saved') {
    return { icon: Check, text: `已保存于 ${timeStr}`, cls: 'text-moss', spin: false };
  }
  if (saveStatus === 'failed') {
    return { icon: AlertCircle, text: '保存失败', cls: 'text-primary', spin: false };
  }
  return { icon: Save, text: '待保存', cls: 'text-muted-foreground', spin: false };
}

/**
 * 写作画布：TipTap 编辑器 + 顶栏 + 工具栏。
 */
export function WritingCanvas({ chapter, bookId }: WritingCanvasProps) {
  const setUnsavedContent = useEditorStore((s) => s.setUnsavedContent);
  const saveStatus = useEditorStore((s) => s.saveStatus);
  const { currentBookId } = useBookStore();
  const aiStatus = useAIStore((s) => s.status);
  const pushToast = useToastStore((s) => s.pushToast);
  const [title, setTitle] = useState(chapter.title);
  const [pickerOpen, setPickerOpen] = useState<'character' | 'worldview' | null>(null);
  const [notifiedDone, setNotifiedDone] = useState(false);
  const [content, setContent] = useState(chapter.content);
  const [editorReady, setEditorReady] = useState(false);
  const [styleModalOpen, setStyleModalOpen] = useState<{
    action: 'rewrite' | 'polish' | 'expand';
    text: string;
  } | null>(null);
  const [fulltextModalOpen, setFulltextModalOpen] = useState(false);
  const [fulltextOutline, setFulltextOutline] = useState('');
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
        void chapterRepository.update(current.id, { status: 'writing' });
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
    if (trimmed && trimmed !== chapter.title) {
      await chapterRepository.update(chapter.id, { title: trimmed });
    } else if (!trimmed) {
      setTitle(chapter.title);
    }
  };

  // 标记完成（二次确认）
  const [confirmDone, setConfirmDone] = useState(false);
  const handleMarkDone = async (): Promise<void> => {
    await chapterRepository.update(chapter.id, { status: 'done' });
    setConfirmDone(false);
    pushToast('success', `章节「${chapter.title}」已标记为完成`);
  };

  // 归档（done→archived，二次确认）
  const handleArchive = async (): Promise<void> => {
    await chapterRepository.update(chapter.id, { status: 'archived' });
    notifiedDoneRef.current = false;
    pushToast('success', `章节「${chapter.title}」已归档`);
  };

  // 恢复写作（archived→writing，二次确认）
  const handleRestore = async (): Promise<void> => {
    await chapterRepository.update(chapter.id, { status: 'writing' });
    notifiedDoneRef.current = false;
    pushToast('success', `章节「${chapter.title}」已恢复为「写作中」`);
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

  // ===== AI 写作操作 =====

  const aiBusy = aiStatus === 'loading' || aiStatus === 'streaming';

  /** 获取当前作品信息（用于 AI 上下文） */
  const getBookInfo = async (): Promise<{ id: string; title: string; synopsis: string }> => {
    const id = currentBookId ?? bookId;
    const book = await db.books.get(id);
    return {
      id,
      title: book?.title ?? '未命名作品',
      synopsis: book?.synopsis ?? '',
    };
  };

  /** AI 续写：在光标处续写下文 */
  const handleAIContinue = async (): Promise<void> => {
    if (!editor || aiBusy) return;
    try {
      const book = await getBookInfo();
      await executeContinue(
        editor,
        book.id,
        chapter.id,
        book.title,
        book.synopsis,
      );
    } catch {
      // 错误已在 executeContinue 内通过 toast 提示
    }
  };

  /** AI 改写/润色/扩写：需选中文本，弹出风格选择 */
  const handleAIRewriteAction = (action: 'rewrite' | 'polish' | 'expand'): void => {
    if (!editor || aiBusy) return;
    const { from, to } = editor.state.selection;
    const selectedText = editor.state.doc.textBetween(from, to, '\n');
    if (!selectedText.trim()) {
      useToastStore.getState().pushToast('warning', '请先选中要处理的文本');
      return;
    }
    setStyleModalOpen({ action, text: selectedText });
  };

  /** 确认风格后执行改写 */
  const handleConfirmRewrite = async (style: RewriteStyle | undefined): Promise<void> => {
    if (!editor || !styleModalOpen) return;
    const { action, text } = styleModalOpen;
    setStyleModalOpen(null);
    try {
      const book = await getBookInfo();
      await executeRewrite(
        editor,
        text,
        action,
        style,
        book.id,
        book.title,
        book.synopsis,
      );
    } catch {
      // 错误已提示
    }
  };

  /** AI 全文生成：打开弹窗输入大纲 */
  const handleAIFulltext = (): void => {
    if (!editor || aiBusy) return;
    setFulltextOutline(outlineText || '');
    setFulltextModalOpen(true);
  };

  /** 确认大纲后执行全文生成 */
  const handleConfirmFulltext = async (): Promise<void> => {
    if (!editor) return;
    setFulltextModalOpen(false);
    try {
      const book = await getBookInfo();
      await executeFulltextEditor(
        editor,
        book.id,
        chapter.id,
        chapter.title,
        fulltextOutline,
        book.title,
        book.synopsis,
      );
    } catch {
      // 错误已在 executeFulltextEditor 内通过 toast 提示
    }
  };

  /** 取消 AI 请求 */
  const handleAICancel = (): void => {
    useAIStore.getState().cancel();
    editor?.commands.rejectGhostText();
  };

  // 实时字数统计
  const wordCount = useMemo(() => countWords(content), [content]);

  // 容量信息
  const sizeKB = useMemo(() => getContentSizeKB(content), [content]);
  const capacityLevel = useMemo(() => getCapacityLevel(content), [content]);

  const saveDisplay = useSaveStatusDisplay();
  const SaveIcon = saveDisplay.icon;
  const statusBadge = STATUS_BADGE[chapter.status];

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
      <div className="flex flex-shrink-0 items-center gap-4 border-b border-border/60 bg-background/75 backdrop-blur-md px-6 py-3 z-10 shadow-sm">
        {/* 章节标题（可编辑，带有雅致焦点边框） */}
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={handleTitleBlur}
          className="min-w-0 flex-1 bg-transparent font-serif text-base font-bold text-foreground border-b border-transparent focus:border-secondary/50 pb-0.5 outline-none transition-all placeholder:text-muted-foreground focus:outline-none"
          placeholder="未命名章节"
          aria-label="章节标题"
        />

        {/* 大纲按钮 */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setOutlineOpen(true)}
          className={cn(
            'text-foreground border-border hover:bg-muted rounded-md text-xs font-semibold py-1 shadow-sm',
            outlineOpen && 'bg-primary/10 border-primary/40 text-primary',
          )}
          icon={<BookOpen className="h-3 w-3" aria-hidden="true" />}
        >
          大纲
        </Button>

        {/* 状态徽章 */}
        <span
          className={cn(
            'rounded-full px-2.5 py-0.5 text-[12px] tracking-widest font-semibold border border-transparent shadow-sm scale-95',
            statusBadge.cls,
            chapter.status === 'done' ? 'border-moss/30' : chapter.status === 'writing' ? 'border-primary/30' : 'border-secondary/30'
          )}
        >
          {statusBadge.label}
        </span>

        {/* 字数统计 */}
        <span className="font-mono text-xs text-muted-foreground border-l border-border-soft/60 pl-3">
          {formatWordCount(wordCount)} 字
        </span>

        {/* 容量显示徽章 */}
        <span
          className={cn(
            'flex items-center gap-1 font-mono text-[12px] rounded-full px-2 py-0.5 border shadow-sm scale-95',
            capacityBadgeCls,
            capacityLevel === 'danger' && 'animate-pulse',
          )}
          title={capacityTooltip}
        >
          <HardDrive className="h-3 w-3" aria-hidden="true" />
          {sizeKB} KB / 100KB
        </span>

        {/* 保存状态 */}
        <span className={cn('flex items-center gap-1.5 font-mono text-[12px] border-l border-border-soft/60 pl-3', saveDisplay.cls)}>
          <SaveIcon
            className={cn('h-3.5 w-3.5', saveDisplay.spin && 'animate-spin')}
            aria-hidden="true"
          />
          {saveDisplay.text}
        </span>

        {/* 标记完成按钮（仅 writing/draft 状态显示） */}
        {(chapter.status === 'draft' || chapter.status === 'writing') && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setConfirmDone(true)}
            className="text-moss border-moss/45 hover:bg-moss hover:text-white rounded-md text-xs font-semibold py-1 ml-2 shadow-sm"
          >
            标记完成
          </Button>
        )}

        {/* 归档按钮（仅 done 状态显示） */}
        {chapter.status === 'done' && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setConfirmArchive(true)}
            className="text-muted-foreground border-border hover:bg-muted hover:text-foreground rounded-md text-xs font-semibold py-1 ml-2 shadow-sm"
            icon={<Archive className="h-3 w-3" aria-hidden="true" />}
          >
            归档
          </Button>
        )}

        {/* 恢复写作按钮（仅 archived 状态显示） */}
        {chapter.status === 'archived' && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setConfirmRestore(true)}
            className="text-primary border-primary/45 hover:bg-primary hover:text-white rounded-md text-xs font-semibold py-1 ml-2 shadow-sm"
            icon={<RotateCcw className="h-3 w-3" aria-hidden="true" />}
          >
            恢复写作
          </Button>
        )}
      </div>

      {/* 主体内容区：编辑器 + 大纲面板 */}
      <div className="flex flex-1 overflow-hidden">
        {/* 编辑器区域 */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* 工具栏 */}
          <div className="flex flex-shrink-0 items-center gap-1.5 border-b border-border/50 bg-muted/25 backdrop-blur px-6 py-2 z-10 shadow-sm">
            <ToolbarButton onClick={toggleBold} title="加粗 (Ctrl+B)" icon={Bold} />
            <ToolbarButton onClick={toggleItalic} title="斜体 (Ctrl+I)" icon={Italic} />
            <ToolbarButton onClick={toggleBlockquote} title="引文块 (Ctrl+Shift+K)" icon={Quote} />
            <ToolbarButton onClick={insertDivider} title="场景分隔符 (Ctrl+Enter)" icon={Minus} />
            <div className="mx-1.5 h-4 w-px bg-border/60" />
            <ToolbarButton
              onClick={() => setPickerOpen('character')}
              title="插入角色提及"
              icon={AtSign}
            />
            <ToolbarButton
              onClick={() => setPickerOpen('worldview')}
              title="插入世界观引用"
              icon={Hash}
            />
            <div className="mx-1.5 h-4 w-px bg-border/60" />
            {/* AI 写作工具组 */}
            {aiBusy ? (
              <button
                type="button"
                onClick={handleAICancel}
                className="flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/5 px-2.5 py-1 text-[11px] text-primary hover:bg-primary/10 transition-all font-semibold"
                aria-label="取消 AI 请求"
              >
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                取消生成
              </button>
            ) : (
              <div className="flex items-center gap-1">
                <ToolbarButton
                  onClick={handleAIContinue}
                  title="AI 续写（光标处续写下文）"
                  icon={Sparkles}
                />
                <ToolbarButton
                  onClick={() => handleAIRewriteAction('rewrite')}
                  title="AI 改写（选中文本）"
                  icon={Wand2}
                />
                <ToolbarButton
                  onClick={() => handleAIRewriteAction('polish')}
                  title="AI 润色（选中文本）"
                  icon={Feather}
                />
                <ToolbarButton
                  onClick={() => handleAIRewriteAction('expand')}
                  title="AI 扩写（选中文本）"
                  icon={Expand}
                />
                <ToolbarButton
                  onClick={handleAIFulltext}
                  title="AI 全文生成（根据大纲生成整章正文）"
                  icon={FileText}
                />
              </div>
            )}
          </div>

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
        <AnimatePresence initial={false}>
          {outlineOpen && (
            <motion.aside
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 280, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              className="flex-shrink-0 overflow-hidden border-l border-border bg-muted/50"
            >
              <div className="flex h-full w-[280px] flex-col">
                {/* 大纲头部 */}
                <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
                  <span className="font-serif text-sm font-semibold tracking-wide text-foreground">
                    章节大纲
                  </span>
                  <div className="flex items-center gap-1">
                    {outlineSaving && (
                      <span className="font-mono text-[12px] text-muted-foreground">
                        保存中...
                      </span>
                    )}
                    {outlineSaved && (
                      <span className="font-mono text-[12px] text-moss">
                        已保存
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => setOutlineOpen(false)}
                      className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      aria-label="关闭大纲"
                    >
                      <X className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </div>

                {/* 大纲编辑器 */}
                <div className="flex-1 overflow-y-auto p-3">
                  <textarea
                    value={outlineText}
                    onChange={(e) => setOutlineText(e.target.value)}
                    placeholder="在此编写本章大纲...&#10;&#10;例如：&#10;1. 开场：主角在森林中迷路&#10;2. 发展：偶遇神秘老者&#10;3. 高潮：得知身世之谜&#10;4. 结尾：决定踏上旅程"
                    className="h-full min-h-[400px] w-full resize-none rounded-lg border border-border bg-background px-3 py-2.5 font-serif text-sm text-foreground leading-relaxed placeholder:text-muted-foreground focus:border-secondary/50 focus:outline-none"
                    aria-label="章节大纲"
                  />
                </div>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
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

/** 工具栏按钮 */
interface ToolbarButtonProps {
  onClick: () => void;
  title: string;
  icon: typeof Bold;
}

function ToolbarButton({ onClick, title, icon: Icon }: ToolbarButtonProps) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      whileHover={{ scale: 1.1, translateY: -1 }}
      whileTap={{ scale: 0.95 }}
      className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-primary/5 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
    </motion.button>
  );
}

export default WritingCanvas;
