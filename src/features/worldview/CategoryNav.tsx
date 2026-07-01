import { motion } from 'framer-motion';
import { Plus, Globe, History, Shield, Cpu, BookOpen, Package } from 'lucide-react';
import type { WorldviewCategory } from '../../types';
import { cn } from '../../utils/cn';
import { Button } from '../../components/ui';

/** 六大分类元信息：key / 现代图标 / 中文名 */
const CATEGORY_LIST = [
  { key: 'geography', icon: Globe, label: '地理' },
  { key: 'history', icon: History, label: '历史' },
  { key: 'faction', icon: Shield, label: '势力' },
  { key: 'system', icon: Cpu, label: '体系' },
  { key: 'culture', icon: BookOpen, label: '文化' },
  { key: 'item', icon: Package, label: '物品' },
] as const;

/** 分类计数映射：分类 → 条目数 */
export type CategoryCounts = Record<WorldviewCategory, number>;

export interface CategoryNavProps {
  /** 当前激活分类 */
  active: WorldviewCategory;
  /** 切换分类回调 */
  onChange: (cat: WorldviewCategory) => void;
  /** 各分类条目计数（实时更新） */
  counts: CategoryCounts;
  /** 新建条目回调 */
  onNew: () => void;
  /** 附加类名 */
  className?: string;
}

/**
 * 分类导航：竖排列表 + 顶部新建按钮。
 */
export function CategoryNav({
  active,
  onChange,
  counts,
  onNew,
  className,
}: CategoryNavProps) {
  return (
    <nav
      className={cn('flex flex-col gap-3', className)}
      aria-label="世界观分类导航"
    >
      {/* 新建条目按钮 */}
      <Button
        variant="primary"
        size="md"
        icon={<Plus className="h-4 w-4" aria-hidden="true" />}
        onClick={onNew}
        className="w-full"
      >
        新建条目
      </Button>

      {/* 分类列表 */}
      <ul className="flex flex-col gap-1 relative z-10" role="list">
        {CATEGORY_LIST.map(({ key, icon: Icon, label }) => {
          const isActive = key === active;
          const count = counts[key] ?? 0;
          return (
            <li key={key} className="relative">
              <button
                type="button"
                onClick={() => onChange(key)}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'group flex w-full items-center gap-3.5 rounded-lg px-4 py-3 relative',
                  'font-sans text-sm transition-colors duration-200 z-10',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
                  isActive
                    ? 'text-primary font-bold'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {/* 液体背景滑块 */}
                {isActive && (
                  <motion.span
                    layoutId="activeCategoryBg"
                    className="absolute inset-0 z-[-1] rounded-lg bg-primary/10 border-l-[3px] border-primary"
                    transition={{ type: 'spring', stiffness: 350, damping: 25 }}
                  />
                )}

                {/* 现代分类图标 */}
                <Icon
                  className={cn(
                    'h-4 w-4 text-primary transition-all duration-150 flex-shrink-0',
                    !isActive && 'opacity-60 group-hover:opacity-100 group-hover:scale-105',
                  )}
                  aria-hidden="true"
                />
                {/* 中文名 */}
                <span className="tracking-[2px]">{label}</span>
                {/* 右侧计数 */}
                <span
                  className="ml-auto font-mono text-[11px] text-muted-foreground group-hover:text-muted-foreground"
                  aria-label={`${label}条目数 ${count}`}
                >
                  {count}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export default CategoryNav;
