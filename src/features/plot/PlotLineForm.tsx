/**
 * PlotLineForm 剧情线编辑表单
 *
 * 基于 Modal 实现：
 * - 标题、类型（主线/支线 select）、状态（规划中/写作中/已完成/搁置）、简介（Textarea）
 * - 保存：plotLineRepository.create / update
 * - 删除：ConfirmDialog，显示影响范围（关联的剧情节点数）
 */
import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { db } from '../../lib/db';
import { plotLineRepository, plotPointRepository } from '../../lib/repositories';
import { useDeleteWithImpact } from '../../hooks/useDeleteWithImpact';
import type { PlotLine, PlotLineStatus, PlotLineType } from '../../types';
import { cn } from '../../utils/cn';
import { Modal, Button, Input, Textarea, ConfirmDialog } from '../../components/ui';

export interface PlotLineFormProps {
  /** 是否打开 */
  open: boolean;
  /** 关闭回调 */
  onClose: () => void;
  /** 编辑目标剧情线；为 null 时表示新建 */
  plotLine: PlotLine | null;
  /** 当前作品 ID */
  bookId: string;
  /** 新建时使用的排序序号（由父组件计算 max(order)+1） */
  nextOrder: number;
  /** 保存成功回调 */
  onSaved?: (plotLine: PlotLine) => void;
  /** 删除成功回调 */
  onDeleted?: (id: string) => void;
}

/** 剧情线类型选项：value + 中文标签 */
const TYPE_OPTIONS: ReadonlyArray<{ value: PlotLineType; label: string }> = [
  { value: 'main', label: '主线' },
  { value: 'sub', label: '支线' },
];

/** 剧情线状态选项：value + 中文标签 */
const STATUS_OPTIONS: ReadonlyArray<{ value: PlotLineStatus; label: string }> = [
  { value: 'planning', label: '规划中' },
  { value: 'writing', label: '写作中' },
  { value: 'done', label: '已完成' },
  { value: 'shelved', label: '搁置' },
];

/** select 通用样式 */
const selectCls = cn(
  'w-full rounded border border-border bg-muted px-3 py-2',
  'font-serif text-sm text-foreground',
  'transition-all duration-200',
  'focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary/25',
);

/** 表单状态 */
interface PlotLineFormState {
  title: string;
  type: PlotLineType;
  status: PlotLineStatus;
  synopsis: string;
}

/** 默认表单值 */
const DEFAULT_FORM: PlotLineFormState = {
  title: '',
  type: 'main',
  status: 'planning',
  synopsis: '',
};

/**
 * 剧情线编辑表单。
 */
export function PlotLineForm({
  open,
  onClose,
  plotLine,
  bookId,
  nextOrder,
  onSaved,
  onDeleted,
}: PlotLineFormProps) {
  const [form, setForm] = useState<PlotLineFormState>(DEFAULT_FORM);
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

  const isEditing = Boolean(plotLine);

  // 弹窗打开或目标变化时同步表单
  useEffect(() => {
    if (!open) return;
    if (plotLine) {
      setForm({
        title: plotLine.title,
        type: plotLine.type,
        status: plotLine.status,
        synopsis: plotLine.synopsis,
      });
    } else {
      setForm(DEFAULT_FORM);
    }
    setError(null);
    cancelDelete();
  }, [open, plotLine]);

  /** 通用字段更新 */
  const updateField = <K extends keyof PlotLineFormState>(
    key: K,
    value: PlotLineFormState[K],
  ): void => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  /** 提交保存：校验 + Repository 写入 */
  const handleSubmit = async (): Promise<void> => {
    if (!form.title.trim()) {
      setError('请填写剧情线标题');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        bookId,
        title: form.title.trim(),
        type: form.type,
        status: form.status,
        synopsis: form.synopsis.trim(),
        order: plotLine?.order ?? nextOrder,
      };

      const saved = plotLine
        ? await plotLineRepository.update(plotLine.id, payload)
        : await plotLineRepository.create(payload);

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
    if (!plotLine) return;
    await requestDelete('plotLine', plotLine.id, bookId);
  };

  /** 确认删除：删除关联剧情节点 + 剧情线本身 */
  const handleDeleteConfirm = async (): Promise<void> => {
    if (!plotLine) return;
    setDeleting(true);
    try {
      await db.transaction('rw', [db.plotLines, db.plotPoints], async () => {
        // 1. 删除该剧情线下的全部剧情节点
        const points = await plotPointRepository.listByPlotLine(plotLine.id);
        for (const p of points) {
          await plotPointRepository.delete(p.id);
        }
        // 2. 删除剧情线本身
        await plotLineRepository.delete(plotLine.id);
      });
      onDeleted?.(plotLine.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败');
    } finally {
      setDeleting(false);
    }
  };

  const title = plotLine ? '编辑剧情线' : '新建剧情线';

  return (
    <>
      <Modal open={open} onClose={onClose} title={title} width="560px">
        <div className="flex flex-col gap-4">
          {/* 标题 */}
          <Input
            label="剧情线标题"
            name="title"
            value={form.title}
            onChange={(e) => updateField('title', e.target.value)}
            placeholder="如：玉佩之谜 · 寻身世"
            required
          />

          {/* 类型 + 状态 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col">
              <label className="mb-1.5 block font-serif text-sm text-foreground">
                类型
              </label>
              <select
                value={form.type}
                onChange={(e) =>
                  updateField('type', e.target.value as PlotLineType)
                }
                className={selectCls}
              >
                {TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col">
              <label className="mb-1.5 block font-serif text-sm text-foreground">
                状态
              </label>
              <select
                value={form.status}
                onChange={(e) =>
                  updateField('status', e.target.value as PlotLineStatus)
                }
                className={selectCls}
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 简介 */}
          <Textarea
            label="简介"
            name="synopsis"
            value={form.synopsis}
            onChange={(e) => updateField('synopsis', e.target.value)}
            placeholder="概述该剧情线的起承转合、核心冲突与走向…"
            rows={5}
          />

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
              {isEditing && (
                <Button
                  variant="ghost"
                  size="md"
                  icon={<Trash2 className="h-4 w-4" aria-hidden="true" />}
                  onClick={() => void handleDelete()}
                  disabled={submitting || deleting}
                  className="text-primary hover:bg-primary hover:text-primary-foreground"
                >
                  删除剧情线
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
                {isEditing ? '保存修改' : '创建剧情线'}
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
        title="删除剧情线"
        message={`确认永久删除剧情线「${plotLine?.title ?? ''}」？此操作不可撤销。`}
        impactDetails={deleteImpact}
        confirmText="永久删除"
        danger
      />
    </>
  );
}

export default PlotLineForm;
