/**
 * Tag 胶囊标签
 *
 * 设计规范：
 * - 圆角：rounded-full
 * - 字体：font-sans + font-medium
 * - 变体：default / primary / secondary / moss / gold / danger / outline
 */
import type { ReactNode } from 'react';
import { cn } from '../../utils/cn';

export interface TagProps {
  children: ReactNode;
  variant?: 'default' | 'primary' | 'secondary' | 'moss' | 'gold' | 'danger' | 'outline';
  size?: 'sm' | 'md';
  className?: string;
}

const variantStyles: Record<NonNullable<TagProps['variant']>, string> = {
  default: 'bg-muted text-muted-foreground',
  primary: 'bg-primary/12 text-primary',
  secondary: 'bg-secondary text-secondary-foreground',
  moss: 'bg-moss/12 text-moss',
  gold: 'bg-gold/12 text-gold',
  danger: 'bg-destructive/12 text-destructive',
  outline: 'border border-border text-foreground bg-transparent',
};

const sizeStyles: Record<NonNullable<TagProps['size']>, string> = {
  sm: 'px-2 py-0.5 text-[11px]',
  md: 'px-2.5 py-1 text-xs',
};

export function Tag({
  children,
  variant = 'default',
  size = 'md',
  className,
}: TagProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-full font-sans font-medium',
        'transition-colors duration-200',
        variantStyles[variant],
        sizeStyles[size],
        className,
      )}
    >
      {children}
    </span>
  );
}

export default Tag;
