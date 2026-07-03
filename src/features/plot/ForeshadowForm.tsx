/**
 * ForeshadowForm 伏笔编辑表单
 *
 * 基于 Modal 实现：
 * - 标题、描述（Textarea）
 * - 埋设章节（select）、回收章节（select，可选）
 * - 状态根据埋设/回收章节自动推断，支持手动标记废弃（需填理由）
 *   - 未选埋设章节 → pending
 *   - 选了埋设章节未选回收 → planted
 *   - 选了回收章节 → paidoff
 *   - 手动标记废弃 → abandoned（理由前置写入 description）
 * - 保存：foreshadowingRepository.create / update
 * - 删除：ConfirmDialog
 *
 * 注：Foreshadowing 类型未单独声明「废弃理由」字段，
 * 故将废弃理由以「【废弃理由】xxx\n\n」前缀写入 description，编辑时解析回填。
 */
import { useEffect, useMemo, useState } from 'react';
import { Trash2, XCircle, RotateCcw } from 'lucide-react';
import { chapterRepository, foreshadowingRepository } from '../../lib/repositories';
import { useApiQuery } from '../../hooks/useApiQuery';
import type { Chapter, Foreshadowing, ForeshadowStatus } from '../../types';
import { cn } from '../../utils/cn';
import { Modal, Button, Input, Textarea, ConfirmDialog } from '../../components/ui';

export interface ForeshadowFormProps {
  /** 是否打开 */
  open: boolean;
  /** 关闭回调 */
  onClose: () => void;
  /** 编辑目标伏笔；为 null 时表示新建 */
  foreshadowing: Foreshadowing | null;
  /** 当前作品 ID */
  bookId: string;
  /** 保存成功回调 */
  onSaved?: (foreshadowing: Foreshadowing) => void;
  /** 删除成功回调 */
  onDeleted?: (id: string) => void;
}

/** 废弃理由前缀标记，用于在 description 中存取 */
const ABANDON_REASON_PREFIX = '【废弃理由】';
/** 前缀与正文之间的分隔 */
const ABANDON_REASON_SEP = '\n\n';

/** select 通用样式 */
const selectCls = cn(
  'w-full rounded border border-border bg-muted px-3 py-2',
  'font-serif text-sm text-foreground',
  'transition-all duration-200',
  'focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary/25',
);

/** 表单状态 */
interface ForeshadowFormState {
  title: string;
  description: string;
  setupChapterId: string;
  payoffChapterId: string;
  /** 是否手动标记废弃 */
  abandoned: boolean;
  /** 废弃理由（仅 abandoned 为 true 时有效） */
  abandonReason: string;
}

/** 默认表单值 */
const DEFAULT_FORM: ForeshadowFormState = {
  title: '',
  description: '',
  setupChapterId: '',
  payoffChapterId: '',
  abandoned: false,
  abandonReason: '',
};

/**
 * 从已存储的 description 中解析出废弃理由与正文。
 * 若不含前缀，则 reason 为空、body 为原文。
 */
function parseDescription(raw: string): { reason: string; body: string } {
  if (!raw.startsWith(ABANDON_REASON_PREFIX)) {
    return { reason: '', body: raw };
  }
  const rest = raw.slice(ABANDON_REASON_PREFIX.length);
  const sepIdx = rest.indexOf(ABANDON_REASON_SEP);
  if (sepIdx === -1) {
    return { reason: rest, body: '' };
  }
  return {
    reason: rest.slice(0, sepIdx),
    body: rest.slice(sepIdx + ABANDON_REASON_SEP.length),
  };
}

/**
 * 根据表单字段推断伏笔状态。
 */
function inferStatus(form: ForeshadowFormState): ForeshadowStatus {
  if (form.abandoned) return 'abandoned';
  if (form.payoffChapterId) return 'paidoff';
  if (form.setupChapterId) return 'planted';
  return 'pending';
}

/** 状态 → 中文标签 */
const STATUS_LABEL: Record<ForeshadowStatus, string> = {
  pending: '待埋设',
  planted: '已埋设',
  paidoff: '已回收',
  abandoned: '已废弃',
};

/**
 * 伏笔编辑表单。
 */
export function ForeshadowForm({
  open,
  onClose,
  foreshadowing,
  bookId,
  onSaved,
  onDeleted,
}: ForeshadowFormProps) {
  const [form, setForm] = useState<ForeshadowFormState>(DEFAULT_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [abandonDialogOpen, setAbandonDialogOpen] = useState(false);
  const [abandonDialogReason, setAbandonDialogReason] = useState('');
  const [abandonDialogError, setAbandonDialogError] = useState<string | null>(null);

  const isEditing = Boolean(foreshadowing);

  // 实时拉取当前作品的章节列表（chapterRepository.list 已按 order 升序），供埋设/回收章节选择
  const chapters = useApiQuery<Chapter[]>(
    async () => (bookId ? chapterRepository.list(bookId) : []),
    [bookId],
  ) ?? [];

  // 弹窗打开或目标变化时同步表单
  useEffect(() => {
    if (!open) return;
    if (foreshadowing) {
      const { reason, body } = parseDescription(foreshadowing.description);
      setForm({
        title: foreshadowing.title,
        description: body,
        setupChapterId: foreshadowing.setupChapterId ?? '',
        payoffChapterId: foreshadowing.payoffChapterId ?? '',
        abandoned: foreshadowing.status === 'abandoned',
        abandonReason: reason,
      });
    } else {
      setForm(DEFAULT_FORM);
    }
    setError(null);
  }, [open, foreshadowing]);

  /** 通用字段更新 */
  const updateField = <K extends keyof ForeshadowFormState>(
    key: K,
    value: ForeshadowFormState[K],
  ): void => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  /** 选择回收章节时校验：不能早于埋设章节 */
  const handlePayoffChange = (value: string): void => {
    if (value && form.setupChapterId) {
      const setupOrder = chapters.find((c) => c.id === form.setupChapterId)?.order;
      const payoffOrder = chapters.find((c) => c.id === value)?.order;
      if (setupOrder != null && payoffOrder != null && payoffOrder < setupOrder) {
        setError('回收章节不应早于埋设章节');
        return;
      }
    }
    setError(null);
    updateField('payoffChapterId', value);
  };

  // 当前推断状态（用于实时展示）
  const inferredStatus = useMemo(() => inferStatus(form), [form]);

  /** 打开放弃回收弹窗 */
  const handleOpenAbandonDialog = (): void => {
    setAbandonDialogReason(form.abandonReason);
    setAbandonDialogError(null);
    setAbandonDialogOpen(true);
  };

  /** 确认放弃回收 */
  const handleConfirmAbandon = (): void => {
    if (!abandonDialogReason.trim()) {
      setAbandonDialogError('请填写放弃理由');
      return;
    }
    updateField('abandoned', true);
    updateField('abandonReason', abandonDialogReason.trim());
    setAbandonDialogOpen(false);
  };

  /** 取消放弃回收 */
  const handleCancelAbandon = (): void => {
    updateField('abandoned', false);
    updateField('abandonReason', '');
  };

  /** 提交保存：校验 + Repository 写入 */
  const handleSubmit = async (): Promise<void> => {
    if (!form.title.trim()) {
      setError('请填写伏笔标题');
      return;
    }
    if (form.abandoned && !form.abandonReason.trim()) {
      setError('标记废弃时需填写理由');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      // 废弃时将理由前缀写入 description
      const description = form.abandoned
        ? `${ABANDON_REASON_PREFIX}${form.abandonReason.trim()}${ABANDON_REASON_SEP}${form.description.trim()}`
        : form.description.trim();

      const payload = {
        bookId,
        title: form.title.trim(),
        description,
        setupChapterId: form.setupChapterId || undefined,
        payoffChapterId: form.payoffChapterId || undefined,
        status: inferredStatus,
      };

      const saved = foreshadowing
        ? await foreshadowingRepository.update(foreshadowing.id, payload)
        : await foreshadowingRepository.create(payload);

      onSaved?.(saved);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSubmitting(false);
    }
  };

  /** 触发删除确认 */
  const handleDelete = (): void => {
    setConfirmOpen(true);
  };

  /** 确认删除 */
  const handleDeleteConfirm = async (): Promise<void> => {
    if (!foreshadowing) return;
    setDeleting(true);
    try {
      await foreshadowingRepository.delete(foreshadowing.id);
      onDeleted?.(foreshadowing.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败');
    } finally {
      setDeleting(false);
    }
  };

  const title = foreshadowing ? '编辑伏笔' : '新建伏笔';

  return (
    <>
      <Modal open={open} onClose={onClose} title={title} width="560px">
        <div className="flex flex-col gap-4">
          {/* 标题 */}
          <Input
            label="伏笔标题"
            name="title"
            value={form.title}
            onChange={(e) => updateField('title', e.target.value)}
            placeholder="如：玉佩裂纹"
            required
          />

          {/* 描述 */}
          <Textarea
            label="描述"
            name="description"
            value={form.description}
            onChange={(e) => updateField('description', e.target.value)}
            placeholder="详述伏笔的埋设细节、暗示与回收时的揭示点…"
            rows={4}
          />

          {/* 埋设章节 + 回收章节 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col">
              <label className="mb-1.5 block font-serif text-sm text-foreground">
                埋设章节
              </label>
              <select
                value={form.setupChapterId}
                onChange={(e) => updateField('setupChapterId', e.target.value)}
                className={selectCls}
              >
                <option value="">未埋设</option>
                {chapters.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col">
              <label className="mb-1.5 block font-serif text-sm text-foreground">
                回收章节
              </label>
              <select
                value={form.payoffChapterId}
                onChange={(e) => handlePayoffChange(e.target.value)}
                className={selectCls}
              >
                <option value="">未回收</option>
                {chapters.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 放弃回收 / 取消放弃 按钮 */}
          <div className="flex items-center gap-2">
            {form.abandoned ? (
              <Button
                variant="outline"
                size="sm"
                icon={<RotateCcw className="h-4 w-4" aria-hidden="true" />}
                onClick={handleCancelAbandon}
                disabled={submitting || deleting}
              >
                取消放弃
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                icon={<XCircle className="h-4 w-4" aria-hidden="true" />}
                onClick={handleOpenAbandonDialog}
                disabled={submitting || deleting}
                className="text-muted-foreground"
              >
                放弃回收
              </Button>
            )}
            {form.abandoned && form.abandonReason && (
              <span className="text-xs text-muted-foreground">
                理由：{form.abandonReason}
              </span>
            )}
          </div>

          {/* 当前推断状态展示 */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>当前状态：</span>
            <span
              className={cn(
                'inline-flex items-center rounded-full px-2 py-0.5 font-medium',
                inferredStatus === 'pending' && 'bg-gold/15 text-gold',
                inferredStatus === 'planted' && 'bg-foreground/10 text-foreground',
                inferredStatus === 'paidoff' && 'bg-moss/15 text-moss',
                inferredStatus === 'abandoned' && 'bg-muted text-muted-foreground',
              )}
            >
              {STATUS_LABEL[inferredStatus]}
            </span>
            <span className="text-muted-foreground">
              （由埋设/回收章节自动推断）
            </span>
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
              {isEditing && (
                <Button
                  variant="ghost"
                  size="md"
                  icon={<Trash2 className="h-4 w-4" aria-hidden="true" />}
                  onClick={handleDelete}
                  disabled={submitting || deleting}
                  className="text-primary hover:bg-primary hover:text-primary-foreground"
                >
                  删除伏笔
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
                {isEditing ? '保存修改' : '创建伏笔'}
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      {/* 放弃回收弹窗 */}
      <Modal
        open={abandonDialogOpen}
        onClose={() => setAbandonDialogOpen(false)}
        title="放弃回收"
        width="420px"
      >
        <div className="flex flex-col gap-4">
          <p className="font-serif text-sm text-muted-foreground">
            确定要放弃这条伏笔的回收吗？请填写放弃理由，以便日后回顾。
          </p>
          <Textarea
            label="放弃理由"
            name="abandonDialogReason"
            value={abandonDialogReason}
            onChange={(e) => {
              setAbandonDialogReason(e.target.value);
              setAbandonDialogError(null);
            }}
            placeholder="请填写放弃理由（必填）"
            rows={3}
          />
          {abandonDialogError && (
            <p className="rounded border border-primary/40 bg-primary/8 px-3 py-2 text-xs text-primary">
              {abandonDialogError}
            </p>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <Button
              variant="ghost"
              size="md"
              onClick={() => setAbandonDialogOpen(false)}
            >
              取消
            </Button>
            <Button variant="primary" size="md" onClick={handleConfirmAbandon}>
              确认放弃
            </Button>
          </div>
        </div>
      </Modal>

      {/* 删除确认 */}
      <ConfirmDialog
        open={confirmOpen}
        onClose={() => (deleting ? undefined : setConfirmOpen(false))}
        onConfirm={handleDeleteConfirm}
        title="删除伏笔"
        message={`确认永久删除伏笔「${foreshadowing?.title ?? ''}」？此操作不可撤销。`}
        confirmText="永久删除"
        danger
      />
    </>
  );
}

export default ForeshadowForm;
