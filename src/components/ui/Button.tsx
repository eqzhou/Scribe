/**
 * Button 通用按钮组件
 *
 * 设计规范：
 * - 圆角：rounded-md (6px)
 * - 字体：font-sans + font-medium
 * - 过渡：transition-all duration-200
 * - 变体：primary / secondary / ghost / outline / danger / link
 * - 尺寸：sm / md / lg
 * - 按下微缩放：active:scale-95
 */
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../utils/cn';

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger' | 'link';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: ReactNode;
}

const variantStyles: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary:
    'bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 active:scale-95',
  secondary:
    'bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80 active:scale-95',
  ghost:
    'bg-transparent text-foreground hover:bg-accent hover:text-accent-foreground active:scale-95',
  outline:
    'border border-border bg-background text-foreground hover:bg-accent hover:text-accent-foreground active:scale-95',
  danger:
    'bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90 active:scale-95',
  link:
    'bg-transparent text-primary hover:text-primary-deep underline-offset-4 hover:underline',
};

const sizeStyles: Record<NonNullable<ButtonProps['size']>, string> = {
  sm: 'h-7 px-2.5 text-xs gap-1.5',
  md: 'h-9 px-4 text-sm gap-2',
  lg: 'h-11 px-6 text-base gap-2.5',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  className,
  children,
  disabled,
  ...rest
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <button
      type="button"
      className={cn(
        'inline-flex items-center justify-center rounded-md font-sans font-medium',
        'transition-all duration-200 ease-out',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        'disabled:cursor-not-allowed disabled:opacity-60',
        'select-none',
        variantStyles[variant],
        sizeStyles[size],
        className,
      )}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
      {!loading && icon}
      {children}
    </button>
  );
}

export default Button;
