/**
 * Toast 通知系统
 *
 * 固定定位右上角，根据类型显示不同左侧色条与图标。
 * Framer Motion 入场：从右滑入 + 淡入；出场反向。
 * 时长由调用方控制，组件只负责展示与 dismiss 回调。
 */
import { AnimatePresence, motion } from 'framer-motion';
import {
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  Info,
  X,
} from 'lucide-react';
import { cn } from '../../utils/cn';

/** 单条 Toast 项 */
export interface ToastItem {
  id: string;
  /** 类型 */
  type: 'success' | 'error' | 'warning' | 'info';
  /** 文案 */
  message: string;
}

/** Toast 容器 Props */
export interface ToastContainerProps {
  toasts: ToastItem[];
  /** 关闭单条 Toast 的回调 */
  onDismiss: (id: string) => void;
}

/** 类型 -> 图标与左边框色映射 */
const typeConfig: Record<
  ToastItem['type'],
  {
    Icon: typeof CheckCircle;
    borderCls: string;
    iconCls: string;
    label: string;
  }
> = {
  success: {
    Icon: CheckCircle,
    borderCls: 'border-l-moss',
    iconCls: 'text-moss',
    label: '成功',
  },
  error: {
    Icon: AlertCircle,
    borderCls: 'border-l-primary',
    iconCls: 'text-primary',
    label: '错误',
  },
  warning: {
    Icon: AlertTriangle,
    borderCls: 'border-l-secondary',
    iconCls: 'text-secondary',
    label: '警告',
  },
  info: {
    Icon: Info,
    borderCls: 'border-l-foreground',
    iconCls: 'text-foreground',
    label: '提示',
  },
};

/**
 * Toast 容器：固定定位右上角，渲染 toasts 列表。
 */
export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  return (
    <div
      className="fixed top-4 right-4 z-[60] flex w-80 flex-col gap-2"
      role="region"
      aria-label="通知"
    >
      <AnimatePresence initial={false}>
        {toasts.map((toast) => {
          const cfg = typeConfig[toast.type];
          const { Icon } = cfg;
          return (
            <motion.div
              key={toast.id}
              layout
              className={cn(
                'flex items-start gap-2.5 rounded border border-border border-l-4',
                'bg-background px-3 py-2.5 shadow-lifted',
                cfg.borderCls,
              )}
              initial={{ opacity: 0, x: 60, scale: 0.96 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 60, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 320, damping: 26 }}
              role="status"
              aria-live={toast.type === 'error' ? 'assertive' : 'polite'}
            >
              <Icon
                className={cn('mt-0.5 h-4 w-4 shrink-0', cfg.iconCls)}
                aria-hidden="true"
              />
              <p className="flex-1 font-serif text-sm text-foreground leading-relaxed">
                {toast.message}
              </p>
              <button
                type="button"
                onClick={() => onDismiss(toast.id)}
                className={cn(
                  'shrink-0 rounded p-0.5 text-muted-foreground transition-all duration-200',
                  'hover:bg-muted hover:text-foreground',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                )}
                aria-label="关闭通知"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

export default ToastContainer;
