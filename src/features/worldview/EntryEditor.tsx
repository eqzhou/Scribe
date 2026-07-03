/**
 * EntryEditor 世界观条目编辑器
 *
 * 基于 Modal（宽度 800px）实现，承载：
 * - 标题输入
 * - 富文本内容（TipTap 编辑器：StarterKit + SceneDivider），工具栏由 EntryEditorToolbar 承载
 * - 标签管理：复用通用 TagInput 组件
 * - 关联角色 / 关联场景：双栏 checkbox 列表由 WorldviewRelationsSection 承载
 * - 保存：调用 worldviewRepository.create / update，并通过 syncWorldviewRelations 双向同步关联实体
 * - 删除：复用 useDeleteWithImpact Hook + EditModalFooter 通用底部操作区与确认弹窗
 */
import { useEffect, useState, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { SceneDivider } from '../editor/nodes/SceneDivider';
import {
  worldviewRepository,
  characterRepository,
  sceneRepository,
} from '../../lib/repositories';
import { useApiQuery } from '../../hooks/useApiQuery';
import { syncWorldviewRelations } from '../../lib/relationSync';
import { useDeleteWithImpact } from '../../hooks/useDeleteWithImpact';
import type {
  WorldviewEntry,
  WorldviewCategory,
  Character,
  Scene,
} from '../../types';
import {
  Modal,
  Input,
  TagInput,
  EditModalFooter,
} from '../../components/ui';
import { EntryEditorToolbar } from './EntryEditorToolbar';
import { WorldviewRelationsSection } from './WorldviewRelationsSection';

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
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 删除确认流程：复用通用 Hook（弹窗开关 + 引用影响检测）
  const { confirmOpen, deleteImpact, requestDelete, cancelDelete } =
    useDeleteWithImpact();

  // 实时监听当前作品的角色与场景，供关联选择
  const characters = useApiQuery<Character[]>(
    async () => characterRepository.list(bookId),
    [bookId],
  ) ?? [];
  const scenes = useApiQuery<Scene[]>(
    async () => sceneRepository.list(bookId),
    [bookId],
  ) ?? [];

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
    setError(null);
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
      await syncWorldviewRelations(
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

  /** 确认删除：删除条目并清理关联实体的反向引用 */
  const handleDeleteConfirm = async (): Promise<void> => {
    if (!entry) return;
    setDeleting(true);
    try {
      // 1. 清理角色反向引用
      if (entry.relatedCharacterIds.length > 0) {
        const linkedChars = await characterRepository.listByIds(
          entry.relatedCharacterIds,
        );
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
        const linkedScenes = await sceneRepository.listByIds(
          entry.relatedSceneIds,
        );
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
      onDeleted?.(entry.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败');
    } finally {
      setDeleting(false);
      cancelDelete();
    }
  };

  const title = entry ? '编辑条目' : '新建条目';

  return (
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
          <EntryEditorToolbar editor={editor} />
          {/* 编辑器主体 */}
          <div className="min-h-[200px] rounded-b border border-t-0 border-border bg-background px-3 py-2">
            <EditorContent editor={editor} />
          </div>
        </div>

        {/* 标签管理 */}
        <TagInput
          tags={form.tags}
          onChange={(tags) => updateField('tags', tags)}
          label="标签"
        />

        {/* 关联角色与场景：双栏 checkbox 列表 */}
        <WorldviewRelationsSection
          characters={characters}
          scenes={scenes}
          selectedCharacterIds={form.relatedCharacterIds}
          selectedSceneIds={form.relatedSceneIds}
          onToggleCharacter={toggleCharacter}
          onToggleScene={toggleScene}
        />

        {/* 错误提示 */}
        {error && (
          <p className="rounded border border-primary/40 bg-primary/8 px-3 py-2 text-xs text-primary">
            {error}
          </p>
        )}

        {/* 底部操作区 + 删除确认弹窗 */}
        <EditModalFooter
          isEditing={Boolean(entry)}
          deleteLabel="删除条目"
          submitLabel={entry ? '保存修改' : '创建条目'}
          submitting={submitting}
          deleting={deleting}
          onCancel={onClose}
          onSubmit={handleSubmit}
          onDelete={() => {
            if (!entry) return;
            void requestDelete('worldview', entry.id, bookId);
          }}
          onConfirmDelete={handleDeleteConfirm}
          onCancelDelete={() => {
            if (!deleting) cancelDelete();
          }}
          confirmOpen={confirmOpen}
          deleteImpact={deleteImpact}
          deleteTitle="删除条目"
          deleteMessage={`确认永久删除条目「${entry?.title ?? ''}」？此操作不可撤销。`}
        />
      </div>
    </Modal>
  );
}

export default EntryEditor;
