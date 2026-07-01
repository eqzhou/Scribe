/**
 * 通用编辑弹窗底部操作区
 *
 * 从 CharacterForm 和 EntryEditor 中提取的公共底部模式：
 * 左侧删除按钮（仅编辑态）+ 右侧取消/保存按钮 + 删除确认对话框。
 */
import { Trash2 } from 'lucide-react';
import { Button } from './Button';
import { ConfirmDialog } from './ConfirmDialog';
import type { ImpactInfo } from './ConfirmDialog';

export interface EditModalFooterProps {
  /** 是否处于编辑态（编辑态才显示删除按钮） */
  isEditing: boolean;
  /** 删除按钮文案 */
  deleteLabel: string;
  /** 保存按钮文案 */
  submitLabel: string;
  /** 提交中状态 */
  submitting: boolean;
  /** 删除中状态 */
  deleting: boolean;
  /** 取消回调 */
  onCancel: () => void;
  /** 提交回调 */
  onSubmit: () => void;
  /** 触发删除确认 */
  onDelete: () => void;
  /** 确认删除回调 */
  onConfirmDelete: () => void;
  /** 关闭删除确认对话框 */
  onCancelDelete: () => void;
  /** 删除确认对话框是否打开 */
  confirmOpen: boolean;
  /** 删除影响信息 */
  deleteImpact: ImpactInfo | null;
  /** 删除确认对话框标题 */
  deleteTitle: string;
  /** 删除确认对话框消息 */
  deleteMessage: string;
}

export function EditModalFooter({
  isEditing,
  deleteLabel,
  submitLabel,
  submitting,
  deleting,
  onCancel,
  onSubmit,
  onDelete,
  onConfirmDelete,
  onCancelDelete,
  confirmOpen,
  deleteImpact,
  deleteTitle,
  deleteMessage,
}: EditModalFooterProps) {
  return (
    <>
      {/* 操作区 */}
      <div className="flex items-center justify-between gap-2 pt-2">
        {/* 左侧：删除（仅编辑态） */}
        <div>
          {isEditing && (
            <Button
              variant="ghost"
              size="md"
              icon={<Trash2 className="h-4 w-4" aria-hidden="true" />}
              onClick={onDelete}
              disabled={submitting || deleting}
              className="text-primary hover:bg-primary hover:text-primary-foreground"
            >
              {deleteLabel}
            </Button>
          )}
        </div>
        {/* 右侧：取消 + 保存 */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="md"
            onClick={onCancel}
            disabled={submitting || deleting}
          >
            取消
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={onSubmit}
            loading={submitting}
            disabled={deleting}
          >
            {submitLabel}
          </Button>
        </div>
      </div>

      {/* 删除确认 */}
      <ConfirmDialog
        open={confirmOpen}
        onClose={onCancelDelete}
        onConfirm={onConfirmDelete}
        title={deleteTitle}
        message={deleteMessage}
        impactDetails={deleteImpact}
        confirmText="永久删除"
        danger
      />
    </>
  );
}
