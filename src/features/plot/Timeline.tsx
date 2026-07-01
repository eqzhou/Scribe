/**
 * Timeline 时间线视图
 *
 * 双模式：
 *   - 主线轨道（默认）：所有节点按 timelineOrder 排列在单条横向轨道上，支持拖拽重排
 *   - 支线分泳道：按剧情线分组，每条剧情线一条独立轨道，便于区分主线/支线脉络
 *
 * 拖拽重排：使用 @dnd-kit 实现水平排序；拖拽结束后调用 onReorder 回调持久化新的 timelineOrder。
 * 节点按剧情线类型着色（主线 primary / 支线 moss / 未知 secondary）。
 * 无剧情节点时显示 EmptyState。
 */
import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Layers, GitBranch } from 'lucide-react';
import type { Chapter, PlotLine, PlotPoint, PlotLineType } from '../../types';
import { cn } from '../../utils/cn';
import { EmptyState, Button } from '../../components/ui';

export interface TimelineProps {
  /** 当前作品的全部剧情节点 */
  plotPoints: PlotPoint[];
  /** 当前作品的全部剧情线（用于节点颜色判定与分泳道） */
  plotLines: PlotLine[];
  /** 当前作品的全部章节（按 order 升序，用于章节号计算与名称查询） */
  chapters: Chapter[];
  /** 拖拽重排回调：传入新的节点顺序（仅包含同一轨道内的节点），由父组件持久化 timelineOrder */
  onReorder?: (reordered: PlotPoint[]) => void;
}

/**
 * 根据剧情线类型返回节点边框色类。
 */
function nodeBorderColor(type: PlotLineType | undefined): string {
  if (type === 'main') return 'border-primary';
  if (type === 'sub') return 'border-moss';
  return 'border-secondary';
}

/** 可拖拽的时间线节点（标签上下交替：偶数索引在上方，奇数索引在下方） */
function SortableTimelineNode({
  point,
  lineType,
  chapterInfo,
  index,
}: {
  point: PlotPoint;
  lineType: PlotLineType | undefined;
  chapterInfo: { number: number; title: string } | undefined;
  index: number;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: point.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const borderColor = nodeBorderColor(lineType);
  const labelAbove = index % 2 === 0;

  const label = (
    <div className="w-[130px] text-center">
      <div className="text-sm font-semibold leading-tight text-foreground">
        {point.title || '未命名节点'}
      </div>
      <div className="mt-0.5 text-[12px] text-muted-foreground">
        {chapterInfo ? `第${chapterInfo.number}章` : '未关联章节'}
      </div>
    </div>
  );

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="relative flex flex-col items-center"
      {...attributes}
      {...listeners}
    >
      {labelAbove ? (
        <>
          {label}
          <motion.div
            whileHover={{ scale: 1.3 }}
            transition={{ type: 'spring', stiffness: 400, damping: 18 }}
            className={cn(
              'mt-2 h-[18px] w-[18px] cursor-grab rounded-full border-[3px] bg-background',
              'shadow-soft transition-colors active:cursor-grabbing',
              borderColor,
            )}
            title={point.title}
          />
        </>
      ) : (
        <>
          <motion.div
            whileHover={{ scale: 1.3 }}
            transition={{ type: 'spring', stiffness: 400, damping: 18 }}
            className={cn(
              'h-[18px] w-[18px] cursor-grab rounded-full border-[3px] bg-background',
              'shadow-soft transition-colors active:cursor-grabbing',
              borderColor,
            )}
            title={point.title}
          />
          <div className="mt-2">{label}</div>
        </>
      )}
    </div>
  );
}

/**
 * 时间线视图。
 */
export function Timeline({ plotPoints, plotLines, chapters, onReorder }: TimelineProps) {
  const [swimlane, setSwimlane] = useState(false);

  // 按 timelineOrder 升序排序节点
  const sortedPoints = useMemo(() => {
    return [...plotPoints].sort((a, b) => a.timelineOrder - b.timelineOrder);
  }, [plotPoints]);

  // 剧情线 id → type 映射
  const plotLineTypeMap = useMemo(() => {
    const m = new Map<string, PlotLineType>();
    for (const pl of plotLines) m.set(pl.id, pl.type);
    return m;
  }, [plotLines]);

  // 章节 id → 在升序章节列表中的序号（1-based）+ 章节标题
  const chapterInfoMap = useMemo(() => {
    const m = new Map<string, { number: number; title: string }>();
    chapters.forEach((c, idx) => {
      m.set(c.id, { number: idx + 1, title: c.title });
    });
    return m;
  }, [chapters]);

  // 分泳道：按 plotLineId 分组
  const lanes = useMemo(() => {
    const m = new Map<string, PlotPoint[]>();
    for (const p of sortedPoints) {
      const arr = m.get(p.plotLineId) ?? [];
      arr.push(p);
      m.set(p.plotLineId, arr);
    }
    // 按剧情线 order 排序泳道（主线在前）
    const sortedPlotLines = [...plotLines].sort((a, b) => {
      if (a.type === 'main' && b.type !== 'main') return -1;
      if (a.type !== 'main' && b.type === 'main') return 1;
      return a.order - b.order;
    });
    return sortedPlotLines
      .filter((pl) => m.has(pl.id))
      .map((pl) => ({ plotLine: pl, points: m.get(pl.id)! }));
  }, [sortedPoints, plotLines]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  /** 拖拽结束：重排 timelineOrder 并回调 */
  const handleDragEnd = (event: DragEndEvent): void => {
    const { active, over } = event;
    if (!over || active.id === over.id || !onReorder) return;
    const oldIndex = sortedPoints.findIndex((p) => p.id === active.id);
    const newIndex = sortedPoints.findIndex((p) => p.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = [...sortedPoints];
    const [moved] = reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, moved);
    // 重新分配 timelineOrder（从 0 开始递增）
    const withNewOrder = reordered.map((p, idx) => ({ ...p, timelineOrder: idx }));
    onReorder(withNewOrder);
  };

  // 空状态
  if (sortedPoints.length === 0) {
    return (
      <EmptyState
        glyph="轴"
        title="尚无剧情节点"
        description="时间线空空如也。先在剧情线中编排节点，此处将按时间顺序铺展你的故事脉络。"
      />
    );
  }

  return (
    <div className="py-6">
      {/* 面板标题 + 模式切换 */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="font-serif text-sm font-semibold tracking-wide text-secondary">
            § 剧情时间线
          </h3>
          <span className="text-xs text-muted-foreground">
            （共 {sortedPoints.length} 个节点{onReorder ? '，可拖拽重排' : ''}）
          </span>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-border bg-muted p-0.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSwimlane(false)}
            className={cn(
              'rounded-md px-2.5 py-1 text-xs',
              !swimlane ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground',
            )}
            icon={<GitBranch className="h-3 w-3" aria-hidden="true" />}
          >
            单轨道
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSwimlane(true)}
            className={cn(
              'rounded-md px-2.5 py-1 text-xs',
              swimlane ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground',
            )}
            icon={<Layers className="h-3 w-3" aria-hidden="true" />}
          >
            分泳道
          </Button>
        </div>
      </div>

      {!swimlane ? (
        /* ============ 单轨道模式 ============ */
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <div className="mx-5 my-[60px] overflow-x-auto">
            <div className="relative min-w-[600px]">
              {/* 轨道线 */}
              <div className="absolute left-0 right-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-border" />
              <span
                className="absolute left-0 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground"
                aria-hidden="true"
              />
              <span
                className="absolute right-0 top-1/2 h-3 w-3 translate-x-1/2 -translate-y-1/2 rounded-full bg-primary"
                aria-hidden="true"
              />
              {/* 节点容器 */}
              <SortableContext
                items={sortedPoints.map((p) => p.id)}
                strategy={horizontalListSortingStrategy}
              >
                <div className="relative flex items-center justify-between py-[60px]">
                  {sortedPoints.map((point, idx) => {
                    const lineType = plotLineTypeMap.get(point.plotLineId);
                    const chapterInfo = point.chapterId
                      ? chapterInfoMap.get(point.chapterId)
                      : undefined;
                    return (
                      <SortableTimelineNode
                        key={point.id}
                        point={point}
                        lineType={lineType}
                        chapterInfo={chapterInfo}
                        index={idx}
                      />
                    );
                  })}
                </div>
              </SortableContext>
            </div>
          </div>
        </DndContext>
      ) : (
        /* ============ 分泳道模式 ============ */
        <div className="flex flex-col gap-8">
          {lanes.length === 0 ? (
            <p className="text-xs text-muted-foreground">暂无可分泳道的剧情线。</p>
          ) : (
            lanes.map(({ plotLine, points }) => {
              const lineType = plotLine.type;
              const borderColor = nodeBorderColor(lineType);
              return (
                <div key={plotLine.id} className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        'h-2.5 w-2.5 rounded-full border-2',
                        borderColor,
                      )}
                      aria-hidden="true"
                    />
                    <span className="text-sm font-semibold text-foreground">
                      {plotLine.title}
                    </span>
                    <span className="text-[12px] text-muted-foreground">
                      （{points.length} 个节点）
                    </span>
                  </div>
                  <div className="relative mx-5 overflow-x-auto">
                    <div className="relative min-w-[400px]">
                      <div className="absolute left-0 right-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-border" />
                      <div className="relative flex items-center justify-between py-[50px]">
                        {points.map((point) => {
                          const chapterInfo = point.chapterId
                            ? chapterInfoMap.get(point.chapterId)
                            : undefined;
                          return (
                            <div
                              key={point.id}
                              className="relative flex flex-col items-center"
                            >
                              <motion.div
                                initial={{ opacity: 0, scale: 0 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ type: 'spring', stiffness: 320, damping: 20 }}
                                whileHover={{ scale: 1.3 }}
                                className={cn(
                                  'h-[18px] w-[18px] rounded-full border-[3px] bg-background',
                                  'shadow-soft transition-colors',
                                  borderColor,
                                )}
                                title={point.title}
                              />
                              <div className="mt-2 w-[120px] text-center">
                                <div className="text-sm font-semibold leading-tight text-foreground">
                                  {point.title || '未命名节点'}
                                </div>
                                <div className="mt-0.5 text-[12px] text-muted-foreground">
                                  {chapterInfo ? `第${chapterInfo.number}章` : '未关联章节'}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        {points.length === 1 && (
                          <div className="flex flex-col items-center">
                            <div
                              className={cn(
                                'h-[18px] w-[18px] rounded-full border-[3px] bg-background',
                                'shadow-soft',
                                borderColor,
                              )}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* 图例 */}
      <div className="mt-8 flex items-center justify-center gap-6 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full border-2 border-primary" />
          主线节点
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full border-2 border-moss" />
          支线节点
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full border-2 border-secondary" />
          其他节点
        </span>
      </div>
    </div>
  );
}

export default Timeline;
