/**
 * Heatmap 写作热力图
 *
 * 优化：
 * - 格子圆角与轻微渐变
 * - 使用 React 状态驱动的浮动 HTML Tooltip 取底原生 title 提示，提高视觉品质
 * - Framer Motion 微动效
 */
import { useMemo, useState } from 'react';
import { writingLogRepository } from '../../lib/repositories';
import { useApiQuery } from '../../hooks/useApiQuery';
import { todayDate } from '../../utils/date';
import { formatWordCount } from '../../utils/wordCount';
import { cn } from '../../utils/cn';

export interface HeatmapProps {
  /** 当前作品 ID；为空时返回空图 */
  bookId: string | null;
}

const COLS = 26;
const ROWS = 7;
const TOTAL_CELLS = COLS * ROWS;

type Level = 0 | 1 | 2 | 3 | 4;

const LEVEL_COLORS: Record<Level, string> = {
  0: 'rgb(var(--muted) / 0.5)',
  1: '#ebdcb6',
  2: '#deb66a',
  3: 'rgb(var(--primary) / 0.85)',
  4: 'rgb(var(--primary-deep))',
};

function levelOf(words: number): Level {
  if (words <= 0) return 0;
  if (words < 1000) return 1;
  if (words < 2000) return 2;
  if (words < 3000) return 3;
  return 4;
}

function shiftDate(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() - days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function Heatmap({ bookId }: HeatmapProps) {
  const [hoveredCell, setHoveredCell] = useState<{
    date: string;
    words: number;
    x: number;
    y: number;
  } | null>(null);

  const logs = useApiQuery(
    async () => {
      if (!bookId) return [];
      // 后端按 bookId 列出全部写作记录；前端再过滤最近 TOTAL_CELLS 天
      const end = todayDate();
      const start = shiftDate(end, TOTAL_CELLS - 1);
      const all = await writingLogRepository.list(bookId);
      return all.filter((l) => l.date >= start && l.date <= end);
    },
    [bookId],
  ) ?? [];

  const cells = useMemo(() => {
    const map = new Map<string, number>();
    for (const log of logs) {
      map.set(log.date, (map.get(log.date) ?? 0) + log.wordCount);
    }
    const today = todayDate();
    const result: { date: string; words: number; level: Level }[] = [];
    for (let i = TOTAL_CELLS - 1; i >= 0; i--) {
      const date = shiftDate(today, i);
      const words = map.get(date) ?? 0;
      result.push({ date, words, level: levelOf(words) });
    }
    return result;
  }, [logs]);

  const handleMouseEnter = (e: React.MouseEvent<HTMLDivElement>, cell: typeof cells[0]) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const parentEl = e.currentTarget.parentElement;
    if (parentEl) {
      const parentRect = parentEl.getBoundingClientRect();
      setHoveredCell({
        date: cell.date,
        words: cell.words,
        x: rect.left - parentRect.left + rect.width / 2,
        y: rect.top - parentRect.top,
      });
    }
  };

  const handleMouseLeave = () => {
    setHoveredCell(null);
  };

  return (
    <div className="relative flex flex-col gap-3">
      {/* 热力图主体：26 列 × 7 行 */}
      <div
        className="grid gap-[4px] relative"
        style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)` }}
      >
        {cells.map((cell, idx) => (
          <div
            key={idx}
            onMouseEnter={(e) => handleMouseEnter(e, cell)}
            onMouseLeave={handleMouseLeave}
            className={cn(
              'aspect-square rounded-[3px] transition-all duration-150 cursor-pointer',
              'hover:scale-[1.3] hover:z-10 hover:shadow-soft',
            )}
            style={{ 
              backgroundColor: LEVEL_COLORS[cell.level],
              border: cell.level === 0 ? '1px solid rgb(var(--border) / 0.15)' : 'none'
            }}
          />
        ))}

        {/* 动态 HTML Tooltip */}
        {hoveredCell && (
          <div
            className="absolute z-50 pointer-events-none rounded-lg border border-border bg-background/95 px-3 py-2 shadow-lifted text-left transition-all duration-75"
            style={{
              left: `${hoveredCell.x}px`,
              top: `${hoveredCell.y - 12}px`,
              transform: 'translate(-50%, -100%)',
            }}
          >
            <div className="font-serif text-[10.5px] font-bold text-secondary uppercase tracking-wider">
              {hoveredCell.date}
            </div>
            <div className="text-[12px] text-foreground mt-0.5 whitespace-nowrap">
              当日已写 <span className="font-mono font-semibold text-primary">{formatWordCount(hoveredCell.words)}</span> 字
            </div>
            {/* 三角小尾巴 */}
            <div className="absolute left-1/2 bottom-[-4.5px] h-2.5 w-2.5 -translate-x-1/2 rotate-45 border-r border-b border-border bg-background" />
          </div>
        )}
      </div>

      {/* 图例：少 → 多 */}
      <div className="flex items-center justify-end gap-1.5 text-[11px] text-muted-foreground">
        <span>少</span>
        {([0, 1, 2, 3, 4] as Level[]).map((lv) => (
          <span
            key={lv}
            className="h-3 w-3 rounded-[2px]"
            style={{ 
              backgroundColor: LEVEL_COLORS[lv],
              border: lv === 0 ? '1px solid rgb(var(--border) / 0.2)' : 'none'
            }}
            aria-hidden="true"
          />
        ))}
        <span>多</span>
      </div>
    </div>
  );
}

export default Heatmap;
