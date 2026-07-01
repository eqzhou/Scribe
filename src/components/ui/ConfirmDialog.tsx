/**
 * ConfirmDialog 确认对话框
 *
 * 基于 Modal 实现，用于关键操作的二次确认。
 * danger 模式下标题和确认按钮使用破坏性色。
 * 支持引用影响详情：摘要 + 展开查看各类型数量。
 */
import { useState } from 'react';
import { AlertTriangle, ChevronDown } from 'lucide-react';
import { Modal } from './Modal';
import { Button } from './Button';
import { cn } from '../../utils/cn';

/** 引用详情条目 */
export interface ImpactDetail {
  type: string;
  id: string;
  title: string;
}

/** 引用影响统计 */
export interface ImpactInfo {
  count: number;
  details: ImpactDetail[];
}

export interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  message: string;
  impactInfo?: string;
  impactDetails?: ImpactInfo | null;
  impactTypeLabels?: Record<string, string>;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
}

const DEFAULT_TYPE_LABELS: Record<string, string> = {
  chapter: '章节',
  character: '角色',
  worldview: '世界观条目',
  scene: '场景',
  plotLine: '剧情线',
  plotPoint: '剧情节点',
  foreshadowing: '伏笔',
  volume: '卷宗',
  relation: '关系',
};

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  impactInfo,
  impactDetails,
  impactTypeLabels,
  confirmText = '确认',
  cancelText = '取消',
  danger = false,
}: ConfirmDialogProps) {
  const [confirming, setConfirming] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const handleConfirm = async () => {
    if (confirming) return;
    setConfirming(true);
    try {
      await onConfirm();
    } finally {
      setConfirming(false);
      onClose();
    }
  };

  const handleClose = () => {
    if (confirming) return;
    onClose();
  };

  const typeLabels = { ...DEFAULT_TYPE_LABELS, ...(impactTypeLabels ?? {}) };

  const typeCounts = impactDetails?.details
    ? impactDetails.details.reduce((acc, d) => {
        acc[d.type] = (acc[d.type] ?? 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    : null;

  const hasImpactDetails = impactDetails && impactDetails.count > 0 && typeCounts;

  return (
    <Modal open={open} onClose={handleClose} title={title} width="420px">
      <div className="flex flex-col gap-4">
        <p className="font-sans text-sm text-foreground leading-relaxed">
          {message}
        </p>

        {impactInfo && (
          <div className={cn(
            'flex items-start gap-2.5 rounded-lg border px-3 py-2.5',
            danger
              ? 'border-destructive/30 bg-destructive/5'
              : 'border-warning/30 bg-warning/5',
          )}>
            <AlertTriangle
              className={cn(
                'mt-0.5 h-4 w-4 shrink-0',
                danger ? 'text-destructive' : 'text-warning',
              )}
              aria-hidden="true"
            />
            <p className="font-sans text-xs text-muted-foreground leading-relaxed">
              {impactInfo}
            </p>
          </div>
        )}

        {hasImpactDetails && (
          <div className={cn(
            'rounded-lg border',
            danger
              ? 'border-destructive/30 bg-destructive/5'
              : 'border-warning/30 bg-warning/5',
          )}>
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left"
            >
              <AlertTriangle
                className={cn(
                  'h-4 w-4 shrink-0',
                  danger ? 'text-destructive' : 'text-warning',
                )}
                aria-hidden="true"
              />
              <span className="flex-1 font-sans text-xs text-muted-foreground">
                将影响 <span className="font-medium text-foreground">{impactDetails.count}</span> 个实体
              </span>
              <ChevronDown
                className={cn(
                  'h-3.5 w-3.5 text-muted-foreground transition-transform',
                  expanded && 'rotate-180',
                )}
                aria-hidden="true"
              />
            </button>
            {expanded && (
              <div className="border-t border-border/40 px-3 py-2.5">
                <ul className="flex flex-col gap-1.5">
                  {Object.entries(typeCounts).map(([type, count]) => (
                    <li
                      key={type}
                      className="flex items-center justify-between font-sans text-xs"
                    >
                      <span className="text-muted-foreground">
                        {typeLabels[type] ?? type}
                      </span>
                      <span className="font-medium text-foreground">
                        {count}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button
            variant="outline"
            size="md"
            onClick={handleClose}
            disabled={confirming}
          >
            {cancelText}
          </Button>
          <Button
            variant={danger ? 'danger' : 'primary'}
            size="md"
            loading={confirming}
            onClick={handleConfirm}
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export default ConfirmDialog;
