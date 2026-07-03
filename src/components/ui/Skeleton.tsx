/**
 * Skeleton 骨架屏
 *
 * 用于数据加载态的占位渲染，替代纯文本「加载中…」。
 * 采用 shimmer 微光扫描动画（背景渐变滑动），尊重 prefers-reduced-motion。
 *
 * 设计：
 * - Skeleton：基础块，可自定义宽高与圆角
 * - SkeletonCard：通用卡片骨架（封面色块 + 标题行 + 简介行 + 统计行），
 *   对齐 BookCard / CharacterCard / SceneCard 等卡片布局
 * - SkeletonGrid：骨架卡片网格，columns 自适应
 */
import type { CSSProperties } from 'react';
import { cn } from '../../utils/cn';

export interface SkeletonProps {
  /** 宽度，支持数字（px）或字符串（如 '100%'、'12rem'） */
  width?: number | string;
  /** 高度，支持数字（px）或字符串 */
  height?: number | string;
  /** 圆角，默认 'md'（6px） */
  rounded?: 'none' | 'sm' | 'md' | 'lg' | 'xl' | 'full';
  /** 附加类名 */
  className?: string;
  /** 内联样式（用于覆盖） */
  style?: CSSProperties;
}

const ROUNDED_MAP: Record<NonNullable<SkeletonProps['rounded']>, string> = {
  none: '',
  sm: 'rounded-sm',
  md: 'rounded-md',
  lg: 'rounded-lg',
  xl: 'rounded-xl',
  full: 'rounded-full',
};

/**
 * 基础骨架块：shimmer 微光扫描背景。
 * motion-reduce:animate-none 尊重 prefers-reduced-motion。
 */
export function Skeleton({
  width = '100%',
  height = 16,
  rounded = 'md',
  className,
  style,
}: SkeletonProps) {
  return (
    <div
      role="status"
      aria-label="加载中"
      className={cn(
        'animate-shimmer bg-gradient-to-r from-muted/40 via-muted to-muted/40',
        'bg-[length:200%_100%] motion-reduce:animate-none',
        ROUNDED_MAP[rounded],
        className,
      )}
      style={{ width, height, ...style }}
    />
  );
}

export interface SkeletonCardProps {
  /** 封面高度，默认 126（对齐 BookCard） */
  coverHeight?: number;
  /** 是否渲染封面色块，默认 true */
  showCover?: boolean;
  /** 附加类名 */
  className?: string;
}

/**
 * 通用卡片骨架：封面 + 标题 + 副标题 + 简介两行 + 统计行 + 进度条。
 * 用于 ProjectsPage / CharactersPage / ScenesPage 等卡片网格的加载占位。
 */
export function SkeletonCard({
  coverHeight = 126,
  showCover = true,
  className,
}: SkeletonCardProps) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border border-border bg-card shadow-sm',
        className,
      )}
    >
      {showCover && <Skeleton width="100%" height={coverHeight} rounded="none" />}
      <div className="flex flex-col gap-2.5 p-5">
        {/* 标题 */}
        <Skeleton width="60%" height={18} />
        {/* 副标题 */}
        <Skeleton width="40%" height={12} />
        {/* 简介两行 */}
        <Skeleton width="100%" height={12} />
        <Skeleton width="85%" height={12} />
        {/* 统计行 */}
        <div className="mt-2 flex items-center gap-3 border-t border-border pt-3">
          <Skeleton width={64} height={11} />
          <Skeleton width={64} height={11} />
          <Skeleton width={64} height={11} />
        </div>
        {/* 进度条 */}
        <Skeleton width="100%" height={4} rounded="full" />
      </div>
    </div>
  );
}

export interface SkeletonGridProps {
  /** 卡片数量，默认 6 */
  count?: number;
  /** 最小列宽（CSS minmax 第一个参数），默认 280px */
  minColumnWidth?: number;
  /** 卡片配置 */
  card?: Omit<SkeletonCardProps, 'className'>;
}

/**
 * 骨架卡片网格：grid auto-fill + minmax 布局，对齐各页面的卡片网格。
 */
export function SkeletonGrid({
  count = 6,
  minColumnWidth = 280,
  card,
}: SkeletonGridProps) {
  return (
    <div
      className="grid gap-5"
      style={{
        gridTemplateColumns: `repeat(auto-fill, minmax(${minColumnWidth}px, 1fr))`,
      }}
    >
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} {...card} />
      ))}
    </div>
  );
}

export default Skeleton;
