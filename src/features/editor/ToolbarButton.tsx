/**
 * ToolbarButton 工具栏按钮
 *
 * 带悬停/按下微动效的图标按钮，用于编辑器工具栏（加粗 / 斜体 / AI 操作等）。
 */
import { motion } from 'framer-motion';
import { Bold } from 'lucide-react';

export interface ToolbarButtonProps {
  onClick: () => void;
  title: string;
  icon: typeof Bold;
}

export function ToolbarButton({ onClick, title, icon: Icon }: ToolbarButtonProps) {
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

export default ToolbarButton;
