/**
 * 剧情页面
 *
 * 顶部欢迎区：大标题「剧情 · 线索经纬」+ 副文案。
 * 三 Tab 切换：剧情线 / 时间线 / 伏笔追踪，激活项 border-b-2 primary。
 * 数据：useBook 获取当前作品；useApiQuery 轮询 plotLines / plotPoints /
 * foreshadowing / chapters，分别交由子视图渲染。
 */
import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  plotLineRepository,
  plotPointRepository,
  foreshadowingRepository,
  chapterRepository,
} from '../lib/repositories';
import { useApiQuery } from '../hooks/useApiQuery';
import { useBook } from '../hooks';
import { useToastStore } from '../stores';
import type {
  Chapter,
  Foreshadowing,
  ForeshadowStatus,
  PlotLine,
  PlotPoint,
} from '../types';
import { cn } from '../utils/cn';
import { EmptyState } from '../components/ui';
import { PlotLineList } from '../features/plot/PlotLineList';
import { Timeline } from '../features/plot/Timeline';
import { ForeshadowList } from '../features/plot/ForeshadowList';

/** Tab 类型：剧情线 / 时间线 / 伏笔追踪 */
type PlotTab = 'lines' | 'timeline' | 'foreshadow';

/** Tab 配置 */
const TABS: ReadonlyArray<{ key: PlotTab; label: string }> = [
  { key: 'lines', label: '剧情线' },
  { key: 'timeline', label: '时间线' },
  { key: 'foreshadow', label: '伏笔追踪' },
];

/** 伏笔状态排序优先级：待埋设 → 已埋设 → 已回收 → 已废弃 */
const FORESHADOW_STATUS_ORDER: Record<ForeshadowStatus, number> = {
  pending: 0,
  planted: 1,
  paidoff: 2,
  abandoned: 3,
};

/** 伏笔筛选选项 */
const FORESHADOW_FILTERS: ReadonlyArray<{ key: ForeshadowStatus | 'all'; label: string }> = [
  { key: 'all', label: '全部' },
  { key: 'pending', label: '待埋设' },
  { key: 'planted', label: '已埋设' },
  { key: 'paidoff', label: '已回收' },
  { key: 'abandoned', label: '已废弃' },
];

/**
 * 剧情页面：欢迎区 + Tab 切换 + 三个子视图。
 */
export default function PlotPage() {
  const book = useBook();
  const bookId = book?.id ?? null;

  // 实时监听当前作品的剧情线（按 order 升序）
  const plotLines = useApiQuery<PlotLine[]>(
    async () => (bookId ? plotLineRepository.list(bookId) : []),
    [bookId],
  ) ?? [];

  // 实时监听当前作品的剧情节点（用于时间线视图）
  const plotPoints = useApiQuery<PlotPoint[]>(
    async () => (bookId ? plotPointRepository.list(bookId) : []),
    [bookId],
  ) ?? [];

  // 实时监听当前作品的伏笔（按状态优先级排序）
  const foreshadowing = useApiQuery<Foreshadowing[]>(
    async () => {
      if (!bookId) return [];
      const list = await foreshadowingRepository.list(bookId);
      return list.sort(
        (a, b) =>
          FORESHADOW_STATUS_ORDER[a.status] - FORESHADOW_STATUS_ORDER[b.status],
      );
    },
    [bookId],
  ) ?? [];

  // 实时监听当前作品的章节（按 order 升序）
  const chapters = useApiQuery<Chapter[]>(
    async () => (bookId ? chapterRepository.list(bookId) : []),
    [bookId],
  ) ?? [];

  const [tab, setTab] = useState<PlotTab>('lines');
  const [foreshadowFilter, setForeshadowFilter] = useState<ForeshadowStatus | 'all'>('all');

  /** 按状态筛选后的伏笔列表 */
  const filteredForeshadowing = useMemo(() => {
    if (foreshadowFilter === 'all') return foreshadowing;
    return foreshadowing.filter((f) => f.status === foreshadowFilter);
  }, [foreshadowing, foreshadowFilter]);

  /** 时间线拖拽重排：批量更新 timelineOrder */
  const handleTimelineReorder = async (reordered: PlotPoint[]): Promise<void> => {
    try {
      // 后端无事务支持，循环 update；通过 get 比对避免无效写入
      for (const p of reordered) {
        const current = await plotPointRepository.get(p.id);
        if (current && p.timelineOrder !== current.timelineOrder) {
          await plotPointRepository.update(p.id, { timelineOrder: p.timelineOrder });
        }
      }
      useToastStore.getState().pushToast('success', '时间线顺序已更新');
    } catch (err) {
      useToastStore
        .getState()
        .pushToast('error', `顺序更新失败：${err instanceof Error ? err.message : String(err)}`);
    }
  };

  return (
    <div className="px-8 py-6">
      {/* 欢迎区 */}
      <header className="mb-6">
        <h1 className="font-serif text-3xl font-bold tracking-wider text-foreground">
          剧情
        </h1>
        <p className="mt-1.5 font-serif text-sm text-muted-foreground">
          管理剧情线、时间线节点与伏笔追踪。
        </p>
      </header>

      {/* Tab 切换 */}
      <div
        className="mb-6 flex gap-6 border-b border-border/60"
        role="tablist"
        aria-label="剧情视图切换"
      >
        {TABS.map((t) => {
          const active = t.key === tab;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.key)}
              className={cn(
                'relative px-1 pb-3 font-serif text-sm tracking-[2px]',
                'transition-colors duration-200 focus:outline-none',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
                active
                  ? 'font-semibold text-primary'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {t.label}
              {active && (
                <motion.span
                  layoutId="plotActiveTabLine"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full"
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* 内容区 */}
      {!bookId ? (
        <EmptyState
          glyph="卷"
          title="尚未选择作品"
          description="请在项目页选择或创建一部作品后，再管理其剧情线索。"
        />
      ) : (
        <>
          {tab === 'lines' && (
            <PlotLineList plotLines={plotLines} bookId={bookId} />
          )}
          {tab === 'timeline' && (
            <Timeline
              plotPoints={plotPoints}
              plotLines={plotLines}
              chapters={chapters}
              onReorder={(reordered) => void handleTimelineReorder(reordered)}
            />
          )}
          {tab === 'foreshadow' && (
            <>
              {/* 状态筛选器 */}
              <div className="mb-4 flex items-center gap-1">
                {FORESHADOW_FILTERS.map((filter) => {
                  const active = foreshadowFilter === filter.key;
                  const count = filter.key === 'all'
                    ? foreshadowing.length
                    : foreshadowing.filter((f) => f.status === filter.key).length;
                  return (
                    <button
                      key={filter.key}
                      type="button"
                      onClick={() => setForeshadowFilter(filter.key)}
                      className={cn(
                        'rounded-md px-3 py-1.5 text-xs transition-all duration-200',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
                        active
                          ? 'bg-primary/10 text-primary font-medium'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                      )}
                    >
                      {filter.label}
                      <span className="ml-1.5 text-[12px] text-muted-foreground">
                        ({count})
                      </span>
                    </button>
                  );
                })}
              </div>

              <ForeshadowList
                foreshadowing={filteredForeshadowing}
                chapters={chapters}
                bookId={bookId}
              />
            </>
          )}
        </>
      )}
    </div>
  );
}
