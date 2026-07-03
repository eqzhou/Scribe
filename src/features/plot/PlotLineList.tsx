/**
 * PlotLineList 剧情线列表
 *
 * 纵向排列，每条剧情线一张横向卡片。
 * 左侧 60px 标识区：毛笔字「主/支」+ 状态文字。
 * 右侧主体：标题 / 简介（2 行截断）/ 进度条 + 百分比。
 * 悬停上浮 + 阴影；点击进入编辑；右上角「新建剧情线」按钮。
 */
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Star, GitBranch } from 'lucide-react';
import type { PlotLine, PlotLineStatus } from '../../types';
import { cn } from '../../utils/cn';
import { Button, EmptyState } from '../../components/ui';
import { PlotLineForm } from './PlotLineForm';

export interface PlotLineListProps {
  /** 当前作品的剧情线列表 */
  plotLines: PlotLine[];
  /** 当前作品 ID */
  bookId: string;
}

/** 状态 → 中文标签 */
const STATUS_LABEL: Record<PlotLineStatus, string> = {
  planning: '规划中',
  writing: '写作中',
  done: '已完成',
  shelved: '搁置',
};

/** 状态 → 进度百分比映射 */
const STATUS_PROGRESS: Record<PlotLineStatus, number> = {
  planning: 10,
  writing: 50,
  done: 100,
  shelved: 30,
};

/** 状态 → 进度条填充色 */
const STATUS_BAR_COLOR: Record<PlotLineStatus, string> = {
  planning: 'bg-secondary',
  writing: 'bg-primary',
  done: 'bg-moss',
  shelved: 'bg-muted-foreground',
};

/** 状态 → 色标颜色（右上角圆点） */
const STATUS_DOT_COLOR: Record<PlotLineStatus, string> = {
  planning: 'bg-gold',
  writing: 'bg-primary',
  done: 'bg-moss',
  shelved: 'bg-muted-foreground',
};

/**
 * 剧情线列表。
 */
export function PlotLineList({ plotLines, bookId }: PlotLineListProps) {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<PlotLine | null>(null);

  /** 打开新建表单 */
  const handleNew = (): void => {
    setEditing(null);
    setFormOpen(true);
  };

  /** 打开编辑表单 */
  const handleEdit = (plotLine: PlotLine): void => {
    setEditing(plotLine);
    setFormOpen(true);
  };

  /** 关闭表单 */
  const handleClose = (): void => {
    setFormOpen(false);
    setEditing(null);
  };

  // 新建剧情线的排序序号：max(order) + 1，空列表时为 0
  const nextOrder =
    plotLines.length === 0
      ? 0
      : Math.max(...plotLines.map((p) => p.order)) + 1;

  // 空状态
  if (plotLines.length === 0) {
    return (
      <>
        <EmptyState
          glyph="线"
          title="尚无剧情线"
          description="主线如江河，支线如溪流。规划你的第一条剧情线，理清故事脉络。"
          action={{ label: '新建剧情线', onClick: handleNew }}
        />
        <PlotLineForm
          open={formOpen}
          onClose={handleClose}
          plotLine={editing}
          bookId={bookId}
          nextOrder={nextOrder}
        />
      </>
    );
  }

  return (
    <>
      {/* 工具栏：标题 + 新建按钮 */}
      <div className="mb-4 flex items-center justify-between">
        <span className="font-serif text-sm text-muted-foreground">
          共 {plotLines.length} 条剧情线
        </span>
        <Button
          variant="primary"
          size="md"
          icon={<Plus className="h-4 w-4" aria-hidden="true" />}
          onClick={handleNew}
        >
          新建剧情线
        </Button>
      </div>

      {/* 剧情线卡片列表 */}
      <ul className="flex flex-col gap-4">
        {plotLines.map((plotLine) => (
          <PlotLineCard
            key={plotLine.id}
            plotLine={plotLine}
            onClick={() => handleEdit(plotLine)}
          />
        ))}
      </ul>

      {/* 编辑表单 */}
      <PlotLineForm
        open={formOpen}
        onClose={handleClose}
        plotLine={editing}
        bookId={bookId}
        nextOrder={nextOrder}
      />
    </>
  );
}

/** 单条剧情线卡片 */
interface PlotLineCardProps {
  plotLine: PlotLine;
  onClick: () => void;
}

function PlotLineCard({ plotLine, onClick }: PlotLineCardProps) {
  const isMain = plotLine.type === 'main';
  const progress = STATUS_PROGRESS[plotLine.status];
  const barColor = STATUS_BAR_COLOR[plotLine.status];
  const dotColor = STATUS_DOT_COLOR[plotLine.status];

  return (
    <motion.li
      whileHover={{ y: -3 }}
      transition={{ type: 'spring', stiffness: 320, damping: 24 }}
      onClick={onClick}
      className={cn(
        'group relative flex cursor-pointer items-stretch gap-4',
        'rounded-lg border border-border bg-muted p-5',
        'transition-shadow duration-300 hover:shadow-lifted',
      )}
    >
      {/* 右上角状态色标 */}
      <div
        className={cn(
          'absolute top-3 right-3 flex items-center gap-1.5',
        )}
      >
        <span
          className={cn(
            'h-2 w-2 rounded-full',
            dotColor,
            plotLine.status === 'writing' && 'animate-pulse',
          )}
          aria-hidden="true"
        />
        <span className="text-[12px] tracking-wide text-muted-foreground">
          {STATUS_LABEL[plotLine.status]}
        </span>
      </div>

      {/* 左侧标识区：主/支线标识 + 状态 */}
      <div className="flex w-[60px] shrink-0 flex-col items-center justify-start pt-1">
        {isMain ? (
          <Star className="h-5 w-5 text-primary" aria-label="主线" />
        ) : (
          <GitBranch className="h-5 w-5 text-moss" aria-label="支线" />
        )}
        <span className="mt-2 text-[11px] tracking-[1px] text-muted-foreground">
          {STATUS_LABEL[plotLine.status]}
        </span>
      </div>

      {/* 右侧主体 */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* 标题 */}
        <h3 className="font-serif text-base font-semibold leading-snug text-foreground pr-20">
          {plotLine.title || '未命名剧情线'}
        </h3>

        {/* 简介：2 行截断 */}
        {plotLine.synopsis ? (
          <p
            className="mt-1.5 text-xs leading-relaxed text-muted-foreground"
            style={{
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {plotLine.synopsis}
          </p>
        ) : (
          <p className="mt-1.5 text-xs italic leading-relaxed text-muted-foreground">
            尚无简介，点击补充。
          </p>
        )}

        {/* 进度条 + 百分比 */}
        <div className="mt-3 flex items-center gap-3">
          <div className="h-[5px] flex-1 overflow-hidden rounded-full bg-muted">
            <motion.div
              className={cn('h-full rounded-full', barColor)}
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
            />
          </div>
          <span className="font-mono text-[11px] text-muted-foreground">
            {progress}%
          </span>
        </div>
      </div>
    </motion.li>
  );
}

export default PlotLineList;
