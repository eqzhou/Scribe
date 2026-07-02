/**
 * SceneForm 场景编辑表单
 *
 * 基于 Modal 实现：
 * - 场景名称、描述（Textarea）、氛围标签（逗号分隔输入）
 * - 关联世界观（多选 checkbox 列表）、关联角色（多选）、出现章节（多选）
 * - 保存：sceneRepository.create / update
 * - 删除：ConfirmDialog，显示影响范围
 */
import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Trash2 } from 'lucide-react';
import { db } from '../../lib/db';
import { sceneRepository } from '../../lib/repositories';
import { useDeleteWithImpact } from '../../hooks/useDeleteWithImpact';
import type { Chapter, Character, Scene, WorldviewEntry } from '../../types';
import { cn } from '../../utils/cn';
import { Modal, Button, Input, Textarea, ConfirmDialog } from '../../components/ui';

export interface SceneFormProps {
  open: boolean;
  onClose: () => void;
  scene: Scene | null;
  bookId: string;
  onSaved?: (scene: Scene) => void;
  onDeleted?: (id: string) => void;
}

/** 表单状态 */
interface SceneFormState {
  name: string;
  description: string;
  atmosphere: string;
  worldviewEntryIds: string[];
  characterIds: string[];
  chapterIds: string[];
}

/** 默认表单值 */
const DEFAULT_FORM: SceneFormState = {
  name: '',
  description: '',
  atmosphere: '',
  worldviewEntryIds: [],
  characterIds: [],
  chapterIds: [],
};

/** 多选项样式 */
const multiOptionCls = (active: boolean) =>
  cn(
    'flex cursor-pointer items-center gap-2 rounded border px-3 py-1.5',
    'text-xs transition-all duration-150',
    active
      ? 'border-primary bg-primary/10 text-primary'
      : 'border-border bg-muted text-muted-foreground hover:border-secondary hover:text-foreground',
  );

/**
 * 场景编辑表单。
 */
export function SceneForm({
  open,
  onClose,
  scene,
  bookId,
  onSaved,
  onDeleted,
}: SceneFormProps) {
  const [form, setForm] = useState<SceneFormState>(DEFAULT_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 删除影响检测：复用通用 Hook（打开确认弹窗 + 检测引用影响）
  const {
    confirmOpen,
    deleteImpact,
    requestDelete,
    cancelDelete,
  } = useDeleteWithImpact();

  const isEditing = Boolean(scene);

  // 实时监听当前作品的世界观条目 / 角色 / 章节，用于多选
  const worldviewEntries = useLiveQuery(
    async () => {
      if (!bookId) return [] as WorldviewEntry[];
      return db.worldview.where('bookId').equals(bookId).toArray();
    },
    [bookId],
    [],
  );
  const characters = useLiveQuery(
    async () => {
      if (!bookId) return [] as Character[];
      return db.characters.where('bookId').equals(bookId).toArray();
    },
    [bookId],
    [],
  );
  const chapters = useLiveQuery(
    async () => {
      if (!bookId) return [] as Chapter[];
      return db.chapters.where('bookId').equals(bookId).sortBy('order');
    },
    [bookId],
    [],
  );

  // 弹窗打开或目标变化时同步表单
  useEffect(() => {
    if (!open) return;
    if (scene) {
      setForm({
        name: scene.name,
        description: scene.description,
        atmosphere: scene.atmosphere.join(', '),
        worldviewEntryIds: [...scene.worldviewEntryIds],
        characterIds: [...scene.characterIds],
        chapterIds: [...scene.chapterIds],
      });
    } else {
      setForm(DEFAULT_FORM);
    }
    setError(null);
    cancelDelete();
  }, [open, scene]);

  /** 通用字段更新 */
  const updateField = <K extends keyof SceneFormState>(
    key: K,
    value: SceneFormState[K],
  ): void => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  /** 切换多选项 */
  const toggleId = (key: 'worldviewEntryIds' | 'characterIds' | 'chapterIds', id: string) => {
    setForm((prev) => {
      const list = prev[key];
      return {
        ...prev,
        [key]: list.includes(id) ? list.filter((x) => x !== id) : [...list, id],
      };
    });
  };

  /** 提交保存 */
  const handleSubmit = async (): Promise<void> => {
    if (!form.name.trim()) {
      setError('请填写场景名称');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        bookId,
        name: form.name.trim(),
        description: form.description.trim(),
        atmosphere: form.atmosphere
          .split(/[,，、\s]+/)
          .map((t) => t.trim())
          .filter(Boolean),
        worldviewEntryIds: form.worldviewEntryIds,
        characterIds: form.characterIds,
        chapterIds: form.chapterIds,
      };

      const saved = scene
        ? await sceneRepository.update(scene.id, payload)
        : await sceneRepository.create(payload);

      onSaved?.(saved);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSubmitting(false);
    }
  };

  /** 触发删除确认：由 Hook 打开弹窗并检测引用影响 */
  const handleDelete = async (): Promise<void> => {
    if (!scene) return;
    await requestDelete('scene', scene.id, bookId);
  };

  /** 确认删除 */
  const handleDeleteConfirm = async (): Promise<void> => {
    if (!scene) return;
    setDeleting(true);
    try {
      await sceneRepository.delete(scene.id);
      onDeleted?.(scene.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败');
    } finally {
      setDeleting(false);
    }
  };

  const title = scene ? '编辑场景' : '新建场景';

  return (
    <>
      <Modal open={open} onClose={onClose} title={title} width="600px">
        <div className="flex flex-col gap-4">
          {/* 场景名称 */}
          <Input
            label="场景名称"
            name="name"
            value={form.name}
            onChange={(e) => updateField('name', e.target.value)}
            placeholder="如：青云观 · 后山禁地"
            required
          />

          {/* 描述 */}
          <Textarea
            label="场景描述"
            name="description"
            value={form.description}
            onChange={(e) => updateField('description', e.target.value)}
            placeholder="描述场景的空间布局、氛围特征、故事意义…"
            rows={4}
          />

          {/* 氛围标签 */}
          <Input
            label="氛围标签"
            name="atmosphere"
            value={form.atmosphere}
            onChange={(e) => updateField('atmosphere', e.target.value)}
            placeholder="用逗号分隔，如：幽静, 神秘, 月夜"
          />
          {form.atmosphere.trim() && (
            <div className="-mt-2 flex flex-wrap gap-1.5">
              {form.atmosphere
                .split(/[,，、\s]+/)
                .map((t) => t.trim())
                .filter(Boolean)
                .map((tag, i) => (
                  <span
                    key={`${tag}-${i}`}
                    className="rounded-full bg-muted px-2 py-0.5 text-[12px] tracking-wide text-muted-foreground"
                  >
                    {tag}
                  </span>
                ))}
            </div>
          )}

          {/* 关联角色多选 */}
          <div className="flex flex-col">
            <label className="mb-1.5 block font-serif text-sm text-foreground">关联角色</label>
            {characters && characters.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {characters.map((c) => (
                  <label key={c.id} className={multiOptionCls(form.characterIds.includes(c.id))}>
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={form.characterIds.includes(c.id)}
                      onChange={() => toggleId('characterIds', c.id)}
                    />
                    {c.name}
                  </label>
                ))}
              </div>
            ) : (
              <p className="text-xs italic text-muted-foreground">暂无角色可关联</p>
            )}
          </div>

          {/* 关联世界观多选 */}
          <div className="flex flex-col">
            <label className="mb-1.5 block font-serif text-sm text-foreground">关联世界观</label>
            {worldviewEntries && worldviewEntries.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {worldviewEntries.map((w) => (
                  <label
                    key={w.id}
                    className={multiOptionCls(form.worldviewEntryIds.includes(w.id))}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={form.worldviewEntryIds.includes(w.id)}
                      onChange={() => toggleId('worldviewEntryIds', w.id)}
                    />
                    {w.title}
                  </label>
                ))}
              </div>
            ) : (
              <p className="text-xs italic text-muted-foreground">暂无世界观条目可关联</p>
            )}
          </div>

          {/* 出现章节多选 */}
          <div className="flex flex-col">
            <label className="mb-1.5 block font-serif text-sm text-foreground">出现章节</label>
            {chapters && chapters.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {chapters.map((ch) => (
                  <label key={ch.id} className={multiOptionCls(form.chapterIds.includes(ch.id))}>
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={form.chapterIds.includes(ch.id)}
                      onChange={() => toggleId('chapterIds', ch.id)}
                    />
                    {ch.title}
                  </label>
                ))}
              </div>
            ) : (
              <p className="text-xs italic text-muted-foreground">暂无章节可关联</p>
            )}
          </div>

          {/* 错误提示 */}
          {error && (
            <p className="rounded border border-primary/40 bg-primary/8 px-3 py-2 text-xs text-primary">
              {error}
            </p>
          )}

          {/* 操作区 */}
          <div className="flex items-center justify-between gap-2 pt-2">
            <div>
              {isEditing && (
                <Button
                  variant="ghost"
                  size="md"
                  icon={<Trash2 className="h-4 w-4" aria-hidden="true" />}
                  onClick={() => void handleDelete()}
                  disabled={submitting || deleting}
                  className="text-primary hover:bg-primary hover:text-primary-foreground"
                >
                  删除场景
                </Button>
              )}
            </div>
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
                {isEditing ? '保存修改' : '创建场景'}
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
          cancelDelete();
        }}
        onConfirm={handleDeleteConfirm}
        title="删除场景"
        message={`确认永久删除场景「${scene?.name ?? ''}」？此操作不可撤销。`}
        impactDetails={deleteImpact}
        confirmText="永久删除"
        danger
      />
    </>
  );
}

export default SceneForm;
