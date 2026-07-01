/**
 * OutlinePanel 章节大纲面板
 *
 * 右侧抽屉式大纲编辑器：宽度动画 0 → 280px。
 * 内含自动保存状态指示（保存中 / 已保存）与关闭按钮。
 */
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';

export interface OutlinePanelProps {
  open: boolean;
  outlineText: string;
  onOutlineTextChange: (value: string) => void;
  onClose: () => void;
  outlineSaving: boolean;
  outlineSaved: boolean;
}

export function OutlinePanel({
  open,
  outlineText,
  onOutlineTextChange,
  onClose,
  outlineSaving,
  outlineSaved,
}: OutlinePanelProps) {
  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.aside
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 280, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ duration: 0.25, ease: 'easeInOut' }}
          className="flex-shrink-0 overflow-hidden border-l border-border bg-muted/50"
        >
          <div className="flex h-full w-[280px] flex-col">
            {/* 大纲头部 */}
            <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
              <span className="font-serif text-sm font-semibold tracking-wide text-foreground">
                章节大纲
              </span>
              <div className="flex items-center gap-1">
                {outlineSaving && (
                  <span className="font-mono text-[12px] text-muted-foreground">保存中...</span>
                )}
                {outlineSaved && (
                  <span className="font-mono text-[12px] text-moss">已保存</span>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label="关闭大纲"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            </div>

            {/* 大纲编辑器 */}
            <div className="flex-1 overflow-y-auto p-3">
              <textarea
                value={outlineText}
                onChange={(e) => onOutlineTextChange(e.target.value)}
                placeholder="在此编写本章大纲...&#10;&#10;例如：&#10;1. 开场：主角在森林中迷路&#10;2. 发展：偶遇神秘老者&#10;3. 高潮：得知身世之谜&#10;4. 结尾：决定踏上旅程"
                className="h-full min-h-[400px] w-full resize-none rounded-lg border border-border bg-background px-3 py-2.5 font-serif text-sm text-foreground leading-relaxed placeholder:text-muted-foreground focus:border-secondary/50 focus:outline-none"
                aria-label="章节大纲"
              />
            </div>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

export default OutlinePanel;
