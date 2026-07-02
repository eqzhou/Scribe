/**
 * EditorToolbar 编辑器工具栏
 *
 * 包含：
 * - 富文本格式按钮（加粗 / 斜体 / 引文块 / 场景分隔符）
 * - 插入角色提及 / 世界观引用按钮
 * - AI 写作工具组（续写 / 改写 / 润色 / 扩写 / 全文生成，或生成中显示「取消生成」）
 */
import {
  Bold,
  Italic,
  Quote,
  Minus,
  AtSign,
  Hash,
  Loader2,
  Sparkles,
  Wand2,
  Feather,
  Expand,
  FileText,
} from 'lucide-react';
import { ToolbarButton } from './ToolbarButton';

export interface EditorToolbarProps {
  onToggleBold: () => void;
  onToggleItalic: () => void;
  onToggleBlockquote: () => void;
  onInsertDivider: () => void;
  onPickCharacter: () => void;
  onPickWorldview: () => void;
  aiBusy: boolean;
  onAIContinue: () => void;
  onAIRewriteAction: (action: 'rewrite' | 'polish' | 'expand') => void;
  onAIFulltext: () => void;
  onAICancel: () => void;
}

export function EditorToolbar({
  onToggleBold,
  onToggleItalic,
  onToggleBlockquote,
  onInsertDivider,
  onPickCharacter,
  onPickWorldview,
  aiBusy,
  onAIContinue,
  onAIRewriteAction,
  onAIFulltext,
  onAICancel,
}: EditorToolbarProps) {
  return (
    <div className="flex shrink-0 items-center gap-1.5 border-b border-border/50 bg-muted/25 backdrop-blur px-6 py-2 z-10 shadow-sm">
      <ToolbarButton onClick={onToggleBold} title="加粗 (Ctrl+B)" icon={Bold} />
      <ToolbarButton onClick={onToggleItalic} title="斜体 (Ctrl+I)" icon={Italic} />
      <ToolbarButton onClick={onToggleBlockquote} title="引文块 (Ctrl+Shift+K)" icon={Quote} />
      <ToolbarButton onClick={onInsertDivider} title="场景分隔符 (Ctrl+Enter)" icon={Minus} />
      <div className="mx-1.5 h-4 w-px bg-border/60" />
      <ToolbarButton onClick={onPickCharacter} title="插入角色提及" icon={AtSign} />
      <ToolbarButton onClick={onPickWorldview} title="插入世界观引用" icon={Hash} />
      <div className="mx-1.5 h-4 w-px bg-border/60" />
      {/* AI 写作工具组 */}
      {aiBusy ? (
        <button
          type="button"
          onClick={onAICancel}
          className="flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/5 px-2.5 py-1 text-[11px] text-primary hover:bg-primary/10 transition-all font-semibold"
          aria-label="取消 AI 请求"
        >
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
          取消生成
        </button>
      ) : (
        <div className="flex items-center gap-1">
          <ToolbarButton
            onClick={onAIContinue}
            title="AI 续写（光标处续写下文）"
            icon={Sparkles}
          />
          <ToolbarButton
            onClick={() => onAIRewriteAction('rewrite')}
            title="AI 改写（选中文本）"
            icon={Wand2}
          />
          <ToolbarButton
            onClick={() => onAIRewriteAction('polish')}
            title="AI 润色（选中文本）"
            icon={Feather}
          />
          <ToolbarButton
            onClick={() => onAIRewriteAction('expand')}
            title="AI 扩写（选中文本）"
            icon={Expand}
          />
          <ToolbarButton
            onClick={onAIFulltext}
            title="AI 全文生成（根据大纲生成整章正文）"
            icon={FileText}
          />
        </div>
      )}
    </div>
  );
}

export default EditorToolbar;
