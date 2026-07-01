/**
 * 角色姓名变更同步提示弹窗
 *
 * 从 CharacterForm.tsx 提取：保存后若章节中存在该角色的提及节点，
 * 提示用户同步提及节点的显示名快照。
 */
import { Button, Modal } from '../../components/ui';

/** 姓名变更信息 */
export interface NameChangeInfo {
  oldName: string;
  newName: string;
  mentionCount: number;
  charId: string;
}

interface NameChangeNoticeModalProps {
  nameChangeInfo: NameChangeInfo | null;
  onClose: () => void;
  onSync: () => void;
}

export function NameChangeNoticeModal({
  nameChangeInfo,
  onClose,
  onSync,
}: NameChangeNoticeModalProps) {
  return (
    <Modal
      open={nameChangeInfo !== null}
      onClose={onClose}
      title="检测到角色姓名变更"
      width="460px"
    >
      <div className="flex flex-col gap-4">
        <p className="font-serif text-sm leading-relaxed text-foreground">
          角色姓名已由「{nameChangeInfo?.oldName}」改为「{nameChangeInfo?.newName}」。
          该角色在 {nameChangeInfo?.mentionCount} 个章节的正文存在提及节点（@{nameChangeInfo?.oldName}）。
        </p>
        <p className="text-xs text-muted-foreground">
          提及节点存储了显示名快照，不会随角色档案自动更新。是否立即同步这些节点的显示名？
        </p>
        <div className="flex justify-end gap-2 border-t border-border/60 pt-3">
          <Button variant="ghost" size="md" onClick={onClose}>
            稍后手动处理
          </Button>
          <Button variant="primary" size="md" onClick={onSync}>
            立即同步
          </Button>
        </div>
      </div>
    </Modal>
  );
}
