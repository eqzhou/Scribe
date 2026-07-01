/**
 * Input / Textarea 输入框与文本域
 *
 * 设计规范：
 * - 圆角：rounded-md (6px)
 * - 字体：font-sans
 * - 高度：h-9 (36px) 标准输入框
 * - 边框：border-border，focus 时 border-ring + ring-2 ring-ring/20
 * - 错误态：border-destructive + text-destructive
 */
import type {
  InputHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';
import { forwardRef } from 'react';
import { cn } from '../../utils/cn';

export interface InputProps
  extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export interface TextareaProps
  extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

const labelCls = 'block font-sans text-sm font-medium text-foreground mb-1.5';
const errorCls = 'mt-1 text-xs text-destructive font-sans';

function inputBaseCls(hasError: boolean): string {
  return cn(
    'w-full h-9 rounded-md border bg-background px-3 py-2 font-sans text-sm text-foreground',
    'transition-all duration-200 ease-out',
    'placeholder:text-muted-foreground',
    'focus:outline-none focus-visible:outline-none',
    hasError
      ? 'border-destructive focus:border-destructive focus:ring-2 focus:ring-destructive/20'
      : 'border-border focus:border-ring focus:ring-2 focus:ring-ring/20',
    'disabled:cursor-not-allowed disabled:opacity-60',
  );
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, className, id, ...rest },
  ref,
) {
  const inputId = id || rest.name || undefined;
  return (
    <div className="w-full">
      {label && (
        <label htmlFor={inputId} className={labelCls}>
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        className={cn(inputBaseCls(Boolean(error)), className)}
        aria-invalid={error ? true : undefined}
        {...rest}
      />
      {error && <p className={errorCls}>{error}</p>}
    </div>
  );
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea(
    { label, error, className, id, ...rest },
    ref,
  ) {
    const inputId = id || rest.name || undefined;
    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className={labelCls}>
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={inputId}
          className={cn(
            inputBaseCls(Boolean(error)),
            'min-h-[96px] h-auto py-2 resize-y leading-relaxed',
            className,
          )}
          aria-invalid={error ? true : undefined}
          {...rest}
        />
        {error && <p className={errorCls}>{error}</p>}
      </div>
    );
  },
);

export default Input;
