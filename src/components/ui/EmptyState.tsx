/**
 * EmptyState 空状态
 *
 * 设计规范：
 * - 居中布局，py-12 px-6
 * - 大字符图标（glyph）作为视觉锚点，text-muted/30
 * - 标题 font-semibold，描述 muted-foreground
 * - Framer Motion 淡入动效
 */
import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Feather } from 'lucide-react';
import { Button } from './Button';

export interface EmptyStateProps {
  /** 保留兼容旧调用，不再渲染字符 */
  glyph?: string;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  className?: string;
  children?: ReactNode;
}

export function EmptyState({
  glyph: _glyph,
  title,
  description,
  action,
  className,
  children,
}: EmptyStateProps) {
  return (
    <motion.div
      className={`flex flex-col items-center justify-center px-6 py-12 text-center ${className ?? ''}`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
    >
      <Feather className="mb-4 h-10 w-10 text-muted-foreground/40" aria-hidden="true" />
      <h3 className="font-sans text-lg font-semibold text-foreground mb-2">{title}</h3>
      {description && (
        <p className="font-sans text-sm text-muted-foreground max-w-md leading-relaxed mb-6">
          {description}
        </p>
      )}
      {action && (
        <Button variant="primary" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
      {children}
    </motion.div>
  );
}

export default EmptyState;
