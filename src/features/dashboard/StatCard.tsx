/**
 * StatCard 工作台统计卡片
 *
 * 参考HTML原型 .stat-card 样式：
 * - 羊皮纸底（bg-muted border border-border rounded-lg）
 * - 多层阴影 shadow-soft，悬停上浮 + 边框转铜金
 * - 图标（不同色彩背景）+ 大数字（font-serif text-3xl）+ 标签
 * - 右上角装饰性光晕（::after 圆形径向渐变）
 * - Framer Motion whileHover y:-3
 */
import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../../utils/cn';

/** 图标色彩变体：对应原型 .stat-icon.{foreground,primary,moss,secondary} */
export type StatIconVariant = 'foreground' | 'primary' | 'moss' | 'secondary';

export interface StatCardProps {
  /** 图标组件 */
  icon: LucideIcon;
  /** 图标色彩变体 */
  variant: StatIconVariant;
  /** 主数值 */
  value: number | string;
  /** 单位（如 "字"、"章"、"位"、"条"） */
  unit?: string;
  /** 卡片标签 */
  label: string;
  /** 右上角附加节点（如趋势 Tag） */
  extra?: ReactNode;
}

/** 图标变体样式映射：背景色 + 文字色 */
const iconVariantStyles: Record<StatIconVariant, string> = {
  foreground: 'bg-foreground text-muted',
  primary: 'bg-primary text-primary-foreground',
  moss: 'bg-moss text-muted',
  secondary: 'bg-secondary text-secondary-foreground',
};

/**
 * 工作台统计卡片：图标 + 大数字 + 标签，悬停上浮动效。
 */
export function StatCard({
  icon: Icon,
  variant,
  value,
  unit,
  label,
  extra,
}: StatCardProps) {
  // 针对变体的动态悬停发光与边框色样式
  const hoverGlowStyles: Record<StatIconVariant, string> = {
    foreground: 'hover:shadow-premium hover:border-foreground/60',
    primary: 'hover:shadow-glow-primary hover:border-primary/50',
    moss: 'hover:shadow-lifted hover:border-moss/50',
    secondary: 'hover:shadow-glow-secondary hover:border-secondary/50',
  };

  return (
    <motion.div
      whileHover={{ y: -4, scale: 1.01 }}
      transition={{ type: 'spring', stiffness: 380, damping: 24 }}
      className={cn(
        'relative overflow-hidden rounded-xl border border-border/60 bg-muted/40 p-5 backdrop-blur-sm',
        'shadow-soft transition-all duration-300',
        hoverGlowStyles[variant],
      )}
    >
      {/* 装饰性光晕背景 */}
      <span
        className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full filter blur-xl opacity-60"
        style={{
          background:
            variant === 'primary'
              ? 'radial-gradient(circle, rgba(200,85,61,0.15) 0%, transparent 70%)'
              : variant === 'secondary'
                ? 'radial-gradient(circle, rgba(176,141,87,0.15) 0%, transparent 70%)'
                : variant === 'moss'
                  ? 'radial-gradient(circle, rgba(61,74,61,0.15) 0%, transparent 70%)'
                  : 'radial-gradient(circle, rgba(26,22,18,0.1) 0%, transparent 70%)',
        }}
        aria-hidden="true"
      />

      {/* 图标与微光 */}
      <div
        className={cn(
          'mb-4 flex h-9.5 w-9.5 items-center justify-center rounded-lg shadow-sm',
          iconVariantStyles[variant],
        )}
      >
        <Icon className="h-5 w-5" strokeWidth={1.5} aria-hidden="true" />
      </div>

      {/* 大数字与单位 */}
      <div className="flex items-baseline gap-1">
        <span className="font-serif text-3.5xl font-semibold leading-none tracking-wide text-foreground">
          {value}
        </span>
        {unit && (
          <small className="text-xs font-normal text-muted-foreground">
            {unit}
          </small>
        )}
      </div>

      {/* 底部标签与趋势 */}
      <div className="mt-2 flex items-center justify-between border-t border-border-soft/40 pt-2">
        <span className="text-[11px] tracking-widest text-muted-foreground uppercase">
          {label}
        </span>
        {extra}
      </div>
    </motion.div>
  );
}

export default StatCard;
