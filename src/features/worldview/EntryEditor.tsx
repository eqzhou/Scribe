/**
 * EntryEditor 世界观条目编辑器
 *
 * 基于 Modal（宽度 800px）实现，承载：
 * - 标题输入
 * - 富文本内容（TipTap 编辑器：StarterKit + SceneDivider）
 * - 标签管理（输入回车添加，点击 x 删除）
 * - 关联角色（多选 checkbox 列表）
 * - 关联场景（多选 checkbox 列表）
 * - 保存：调用 worldviewRepository.create / update，并双向同步关联实体的数组字段
 * - 删除：ConfirmDialog 显示影响范围（关联角色与场景数）
 */
import { useEffect, useState, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { X, Trash2 } from 'lucide-react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { SceneDivider } from '../editor/nodes/SceneDivider';
import { db } from '../../lib/db';
import {
  worldviewRepository,
  characterRepository,
  sceneRepository,
} from '../../lib/repositories';
import { checkReferences } from '../../lib/referenceChecker';
import type {
  WorldviewEntry,
  WorldviewCategory,
  Character,
  Scene,
} from '../../types';
import type { ImpactInfo } from '../../components/ui';
import { cn } from '../../utils/cn';
import {
  Modal,
  Button,
  Input,
  Tag,
  ConfirmDialog,
} from '../../components/ui';

export interface EntryEditorProps {
  /** 是否打开 */
  open: boolean;
  /** 关闭回调 */
  onClose: () => void;
  /** 编辑目标条目；为 null 时表示新建 */
  entry: WorldviewEntry | null;
  /** 新建时所属分类（编辑时取 entry.category） */
  category: WorldviewCategory;
  /** 当前作品 ID */
  bookId: string;
  /** 保存成功回调 */
  onSaved?: (entry: WorldviewEntry) => void;
  /** 删除成功回调 */
  onDeleted?: (id: string) => void;
}

/** 表单状态 */
interface EntryFormState {
  title: string;
  content: string;
  tags: string[];
  relatedCharacterIds: string[];
  relatedSceneIds: string[];
}

/** 默认表单值 */
const DEFAULT_FORM: EntryFormState = {
  title: '',
  content: '',
  tags: [],
  relatedCharacterIds: [],
  relatedSceneIds: [],
};

/**
 * 世界观条目编辑器。
 */
export function EntryEditor({
  open,
  onClose,
  entry,
  category,
  bookId,
  onSaved,
  onDeleted,
}: EntryEditorProps) {
  const [form, setForm] = useState<EntryFormState>(DEFAULT_FORM);

  // TipTap 富文本编辑器：内容直接以 HTML 形式存储
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      SceneDivider,
    ],
    content: '',
    editorProps: {
      attributes: {
        class: 'prose-editor min-h-[200px] focus:outline-none',
        spellcheck: 'false',
      },
    },
  });

  // 编辑器内容变化时同步到 form.content
  const handleEditorUpdate = useCallback(() => {
    const html = editor?.getHTML() ?? '';
    setForm((prev) => ({ ...prev, content: html }));
  }, [editor]);
  const [tagInput, setTagInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteImpact, setDeleteImpact] = useState<ImpactInfo | null>(null);

  // 实时监听当前作品的角色与场景，供关联选择
  const characters = useLiveQuery(
    () => db.characters.where('bookId').equals(bookId).toArray(),
    [bookId],
    [] as Character[],
  );
  const scenes = useLiveQuery(
    () => db.scenes.where('bookId').equals(bookId).toArray(),
    [bookId],
    [] as Scene[],
  );

  // 弹窗打开或编辑目标变化时同步表单与编辑器内容
  useEffect(() => {
    if (!open) return;
    if (entry) {
      setForm({
        title: entry.title,
        content: entry.content,
        tags: [...entry.tags],
        relatedCharacterIds: [...entry.relatedCharacterIds],
        relatedSceneIds: [...entry.relatedSceneIds],
      });
      // 同步富文本内容到编辑器
      if (editor) {
        editor.commands.setContent(entry.content || '', { emitUpdate: false });
      }
    } else {
      setForm(DEFAULT_FORM);
      if (editor) {
        editor.commands.setContent('', { emitUpdate: false });
      }
    }
    setTagInput('');
    setError(null);
    setDeleteImpact(null);
  }, [open, entry, editor]);

  // 编辑器内容更新监听
  useEffect(() => {
    if (!editor) return;
    editor.on('update', handleEditorUpdate);
    return () => {
      editor.off('update', handleEditorUpdate);
    };
  }, [editor, handleEditorUpdate]);

  /** 通用字段更新 */
  const updateField = <K extends keyof EntryFormState>(
    key: K,
    value: EntryFormState[K],
  ): void => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  /** 添加标签：回车触发，去重并清空输入 */
  const handleTagAdd = (): void => {
    const value = tagInput.trim();
    if (!value) return;
    if (form.tags.includes(value)) {
      setTagInput('');
      return;
    }
    updateField('tags', [...form.tags, value]);
    setTagInput('');
  };

  /** 删除标签 */
  const handleTagRemove = (tag: string): void => {
    updateField(
      'tags',
      form.tags.filter((t) => t !== tag),
    );
  };

  /** 切换角色关联 */
  const toggleCharacter = (id: string): void => {
    const set = new Set(form.relatedCharacterIds);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    updateField('relatedCharacterIds', Array.from(set));
  };

  /** 切换场景关联 */
  const toggleScene = (id: string): void => {
    const set = new Set(form.relatedSceneIds);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    updateField('relatedSceneIds', Array.from(set));
  };

  /** 提交保存：校验 + Repository 写入 + 双向同步关联实体 */
  const handleSubmit = async (): Promise<void> => {
    if (!form.title.trim()) {
      setError('请填写条目标题');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        bookId,
        category: entry?.category ?? category,
        title: form.title.trim(),
        content: form.content,
        tags: form.tags,
        relatedCharacterIds: form.relatedCharacterIds,
        relatedSceneIds: form.relatedSceneIds,
      };

      const saved = entry
        ? await worldviewRepository.update(entry.id, payload)
        : await worldviewRepository.create(payload);

      // 双向同步关联实体（角色 / 场景）
      await syncRelations(
        saved.id,
        entry?.relatedCharacterIds ?? [],
        form.relatedCharacterIds,
        entry?.relatedSceneIds ?? [],
        form.relatedSceneIds,
      );

      onSaved?.(saved);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSubmitting(false);
    }
  };

  /** 触发删除：先检测引用影响 */
  const handleDelete = async (): Promise<void> => {
    if (!entry) return;
    setConfirmOpen(true);
    setDeleteImpact(null);
    const impact = await checkReferences('worldview', entry.id, bookId);
    setDeleteImpact(impact);
  };

  /** 确认删除：删除条目并清理关联实体的反向引用 */
  const handleDeleteConfirm = async (): Promise<void> => {
    if (!entry) return;
    setDeleting(true);
    try {
      await db.transaction(
        'rw',
        [db.worldview, db.characters, db.scenes],
        async () => {
          // 1. 清理角色反向引用
          if (entry.relatedCharacterIds.length > 0) {
            const linkedChars = await db.characters
              .where('id')
              .anyOf(entry.relatedCharacterIds)
              .toArray();
            for (const c of linkedChars) {
              const next = (c.relatedWorldviewIds ?? []).filter(
                (id) => id !== entry.id,
              );
              await characterRepository.update(c.id, {
                relatedWorldviewIds: next,
              });
            }
          }
          // 2. 清理场景反向引用
          if (entry.relatedSceneIds.length > 0) {
            const linkedScenes = await db.scenes
              .where('id')
              .anyOf(entry.relatedSceneIds)
              .toArray();
            for (const s of linkedScenes) {
              const next = s.worldviewEntryIds.filter(
                (id) => id !== entry.id,
              );
              await sceneRepository.update(s.id, {
                worldviewEntryIds: next,
              });
            }
          }
          // 3. 删除条目本身
          await worldviewRepository.delete(entry.id);
        },
      );
      onDeleted?.(entry.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败');
    } finally {
      setDeleting(false);
    }
  };

  const title = entry ? '编辑条目' : '新建条目';

  return (
    <>
      <Modal open={open} onClose={onClose} title={title} width="800px">
        <div className="flex flex-col gap-4">
          {/* 标题 */}
          <Input
            label="条目标题"
            name="title"
            value={form.title}
            onChange={(e) => updateField('title', e.target.value)}
            placeholder="如：昆仑雪顶"
            required
          />

          {/* 内容（TipTap 富文本） */}
          <div className="flex flex-col">
            <label className="mb-1.5 block font-serif text-sm text-foreground">
              条目内容
            </label>
            {/* 富文本工具栏 */}
            <div className="mb-1.5 flex items-center gap-1 rounded-t border border-border bg-muted px-2 py-1.5">
              <button
                type="button"
                onClick={() => editor?.chain().focus().toggleBold().run()}
                className={cn(
                  'rounded px-2 py-0.5 text-xs transition-colors',
                  editor?.isActive('bold')
                    ? 'bg-primary/15 text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
                aria-label="加粗"
              >
                B
              </button>
              <button
                type="button"
                onClick={() => editor?.chain().focus().toggleItalic().run()}
                className={cn(
                  'rounded px-2 py-0.5 text-xs italic transition-colors',
                  editor?.isActive('italic')
                    ? 'bg-primary/15 text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
                aria-label="斜体"
              >
                I
              </button>
              <button
                type="button"
                onClick={() => editor?.chain().focus().toggleBlockquote().run()}
                className={cn(
                  'rounded px-2 py-0.5 text-xs transition-colors',
                  editor?.isActive('blockquote')
                    ? 'bg-primary/15 text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
                aria-label="引文块"
              >
                ❝
              </button>
              <div className="mx-1 h-4 w-px bg-border" aria-hidden="true" />
              <button
                type="button"
                onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
                className={cn(
                  'rounded px-2 py-0.5 text-xs transition-colors',
                  editor?.isActive('heading', { level: 2 })
                    ? 'bg-primary/15 text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
                aria-label="二级标题"
              >
                H2
              </button>
              <button
                type="button"
                onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}
                className={cn(
                  'rounded px-2 py-0.5 text-xs transition-colors',
                  editor?.isActive('heading', { level: 3 })
                    ? 'bg-primary/15 text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
                aria-label="三级标题"
              >
                H3
              </button>
              <div className="mx-1 h-4 w-px bg-border" aria-hidden="true" />
              <button
                type="button"
                onClick={() => editor?.chain().focus().insertContent({ type: 'sceneDivider' }).run()}
                className="rounded px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="插入场景分隔符"
                title="场景分隔符 (Ctrl+Enter)"
              >
                §
              </button>
            </div>
            {/* 编辑器主体 */}
            <div className="min-h-[200px] rounded-b border border-t-0 border-border bg-background px-3 py-2">
              <EditorContent editor={editor} />
            </div>
          </div>

          {/* 标签管理 */}
          <div className="flex flex-col">
            <label className="mb-1.5 block font-serif text-sm text-foreground">
              标签
            </label>
            <div className="flex flex-wrap items-center gap-2 rounded border border-border bg-muted px-2 py-2">
              {form.tags.map((tag) => (
                <Tag key={tag} variant="secondary" size="sm">
                  <span className="inline-flex items-center gap-1">
                    {tag}
                    <button
                      type="button"
                      onClick={() => handleTagRemove(tag)}
                      className="text-secondary transition-colors hover:text-primary"
                      aria-label={`删除标签 ${tag}`}
                    >
                      <X className="h-3 w-3" aria-hidden="true" />
                    </button>
                  </span>
                </Tag>
              ))}
              <input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleTagAdd();
                  }
                }}
                placeholder={form.tags.length === 0 ? '输入标签后回车添加' : '继续添加…'}
                className={cn(
                  'flex-1 min-w-[120px] bg-transparent px-1 py-0.5',
                  'font-serif text-sm text-foreground',
                  'placeholder:text-muted-foreground focus:outline-none',
                )}
              />
            </div>
          </div>

          {/* 关联角色与场景：双栏 checkbox 列表 */}
          <div className="grid grid-cols-2 gap-4">
            {/* 关联角色 */}
            <div className="flex flex-col">
              <label className="mb-1.5 block font-serif text-sm text-foreground">
                关联角色
              </label>
              <div className="max-h-44 overflow-y-auto rounded border border-border bg-muted px-2 py-1.5">
                {characters.length === 0 ? (
                  <p className="px-1 py-2 text-xs text-muted-foreground">
                    当前作品尚无角色
                  </p>
                ) : (
                  <ul className="flex flex-col gap-0.5">
                    {characters.map((c) => {
                      const checked = form.relatedCharacterIds.includes(c.id);
                      return (
                        <li key={c.id}>
                          <label
                            className={cn(
                              'flex cursor-pointer items-center gap-2 rounded px-1.5 py-1',
                              'font-serif text-sm transition-colors',
                              checked
                                ? 'bg-primary/8 text-foreground'
                                : 'text-muted-foreground hover:bg-muted',
                            )}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleCharacter(c.id)}
                              className="h-3.5 w-3.5 accent-primary"
                            />
                            <span className="font-medium">{c.name}</span>
                            {c.alias && (
                              <span className="text-[11px] text-secondary">
                                · {c.alias}
                              </span>
                            )}
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>

            {/* 关联场景 */}
            <div className="flex flex-col">
              <label className="mb-1.5 block font-serif text-sm text-foreground">
                关联场景
              </label>
              <div className="max-h-44 overflow-y-auto rounded border border-border bg-muted px-2 py-1.5">
                {scenes.length === 0 ? (
                  <p className="px-1 py-2 text-xs text-muted-foreground">
                    当前作品尚无场景
                  </p>
                ) : (
                  <ul className="flex flex-col gap-0.5">
                    {scenes.map((s) => {
                      const checked = form.relatedSceneIds.includes(s.id);
                      return (
                        <li key={s.id}>
                          <label
                            className={cn(
                              'flex cursor-pointer items-center gap-2 rounded px-1.5 py-1',
                              'font-serif text-sm transition-colors',
                              checked
                                ? 'bg-moss/10 text-foreground'
                                : 'text-muted-foreground hover:bg-muted',
                            )}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleScene(s.id)}
                              className="h-3.5 w-3.5 accent-primary"
                            />
                            <span className="font-medium">{s.name}</span>
                            {s.atmosphere.length > 0 && (
                              <span className="text-[11px] text-moss">
                                · {s.atmosphere.slice(0, 2).join(' / ')}
                              </span>
                            )}
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          </div>

          {/* 错误提示 */}
          {error && (
            <p className="rounded border border-primary/40 bg-primary/8 px-3 py-2 text-xs text-primary">
              {error}
            </p>
          )}

          {/* 操作区 */}
          <div className="flex items-center justify-between gap-2 pt-2">
            {/* 左侧：删除（仅编辑态） */}
            <div>
              {entry && (
                <Button
                  variant="ghost"
                  size="md"
                  icon={<Trash2 className="h-4 w-4" aria-hidden="true" />}
                  onClick={() => void handleDelete()}
                  disabled={submitting || deleting}
                  className="text-primary hover:bg-primary hover:text-primary-foreground"
                >
                  删除条目
                </Button>
              )}
            </div>
            {/* 右侧：取消 + 保存 */}
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="md"
                onClick={onClose}
                disabled={submitting || deleting}
              >
                取消
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={handleSubmit}
                loading={submitting}
                disabled={deleting}
              >
                {entry ? '保存修改' : '创建条目'}
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      {/* 删除确认 */}
      <ConfirmDialog
        open={confirmOpen}
        onClose={() => {
          if (deleting) return;
          setConfirmOpen(false);
          setDeleteImpact(null);
        }}
        onConfirm={handleDeleteConfirm}
        title="删除条目"
        message={`确认永久删除条目「${entry?.title ?? ''}」？此操作不可撤销。`}
        impactDetails={deleteImpact}
        confirmText="永久删除"
        danger
      />
    </>
  );
}

/**
 * 双向同步关联实体：
 * - 角色：将 entry.id 写入/移出 character.relatedWorldviewIds
 * - 场景：将 entry.id 写入/移出 scene.worldviewEntryIds
 *
 * @param entryId 当前条目 ID
 * @param oldCharIds 旧的关联角色集合
 * @param newCharIds 新的关联角色集合
 * @param oldSceneIds 旧的关联场景集合
 * @param newSceneIds 新的关联场景集合
 */
async function syncRelations(
  entryId: string,
  oldCharIds: string[],
  newCharIds: string[],
  oldSceneIds: string[],
  newSceneIds: string[],
): Promise<void> {
  const addedChars = newCharIds.filter((id) => !oldCharIds.includes(id));
  const removedChars = oldCharIds.filter((id) => !newCharIds.includes(id));
  const addedScenes = newSceneIds.filter((id) => !oldSceneIds.includes(id));
  const removedScenes = oldSceneIds.filter((id) => !newSceneIds.includes(id));

  await db.transaction(
    'rw',
    [db.characters, db.scenes],
    async () => {
      // 角色：新增引用
      for (const id of addedChars) {
        const c = await db.characters.get(id);
        if (!c) continue;
        const set = new Set(c.relatedWorldviewIds ?? []);
        set.add(entryId);
        await characterRepository.update(c.id, {
          relatedWorldviewIds: Array.from(set),
        });
      }
      // 角色：移除引用
      for (const id of removedChars) {
        const c = await db.characters.get(id);
        if (!c) continue;
        const next = (c.relatedWorldviewIds ?? []).filter(
          (x) => x !== entryId,
        );
        await characterRepository.update(c.id, {
          relatedWorldviewIds: next,
        });
      }
      // 场景：新增引用
      for (const id of addedScenes) {
        const s = await db.scenes.get(id);
        if (!s) continue;
        const set = new Set(s.worldviewEntryIds);
        set.add(entryId);
        await sceneRepository.update(s.id, {
          worldviewEntryIds: Array.from(set),
        });
      }
      // 场景：移除引用
      for (const id of removedScenes) {
        const s = await db.scenes.get(id);
        if (!s) continue;
        const next = s.worldviewEntryIds.filter((x) => x !== entryId);
        await sceneRepository.update(s.id, {
          worldviewEntryIds: next,
        });
      }
    },
  );
}

export default EntryEditor;
