/**
 * GoalRing 每日目标环
 *
 * 参考HTML原型 .goal-ring 样式：
 * - SVG 环形进度条（120x120）
 * - 使用 settingStore.dailyGoal 作为目标
 * - 当日已写字数（从 writingLogs 获取今日记录）
 * - 中心显示百分比
 * - Framer Motion 入场动画（stroke-dashoffset 动画）
 * - 旁边显示目标信息与连续写作天数
 */
import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useLiveQuery } from 'dexie-react-hooks';
import { Flame } from 'lucide-react';
import { db } from '../../lib/db';
import { useSettingStore } from '../../stores';
import { todayDate, formatDate, getHeatmapDates } from '../../utils/date';
import { formatWordCount } from '../../utils/wordCount';
import { cn } from '../../utils/cn';

export interface GoalRingProps {
  /** 当前作品 ID；为空时显示占位 */
  bookId: string | null;
}

/** 环形 SVG 半径与描边宽度（与原型 .ring svg 一致） */
const RING_SIZE = 120;
const RING_RADIUS = 52;
const STROKE_WIDTH = 10;
// 周长 = 2 * π * r ≈ 326.7
const CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

/**
 * 每日目标环：SVG 进度环 + 中心百分比 + 连续天数信息。
 */
export function GoalRing({ bookId }: GoalRingProps) {
  const dailyGoal = useSettingStore((s) => s.dailyGoal);

  // 实时监听当前作品的全部写作记录（用于计算今日字数与连续天数）
  const logs = useLiveQuery(
    async () => {
      if (!bookId) return [];
      return db.writingLogs.where('bookId').equals(bookId).toArray();
    },
    [bookId],
    [],
  );

  // 计算今日字数、进度百分比、连续写作天数
  const { todayWords, percent, streak } = useMemo(() => {
    const today = todayDate();
    // 日期 → 字数 映射
    const map = new Map<string, number>();
    if (logs) {
      for (const log of logs) {
        map.set(log.date, (map.get(log.date) ?? 0) + log.wordCount);
      }
    }
    const todayWords = map.get(today) ?? 0;
    const percent =
      dailyGoal > 0 ? Math.min(100, Math.round((todayWords / dailyGoal) * 100)) : 0;

    // 计算连续写作天数：从今日向前回溯，遇到有字数的天即 +1，遇到空天即中断
    let streakCount = 0;
    const recent = getHeatmapDates(60); // 取最近 60 天用于回溯
    for (let i = recent.length - 1; i >= 0; i--) {
      const w = map.get(recent[i]) ?? 0;
      if (w > 0) {
        streakCount++;
      } else {
        // 今日若未写则不中断（容许今日刚开始）
        if (i === recent.length - 1) continue;
        break;
      }
    }
    return { todayWords, percent, streak: streakCount };
  }, [logs, dailyGoal]);

  // 进度条偏移：100% 时 offset 为 0
  const offset = CIRCUMFERENCE * (1 - percent / 100);

  return (
    <div className="flex items-center gap-5">
      {/* SVG 环 */}
      <div className="relative h-[120px] w-[120px] shrink-0">
        <svg width={RING_SIZE} height={RING_SIZE} style={{ transform: 'rotate(-90deg)' }}>
          <defs>
            <linearGradient id="ringGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="rgb(var(--primary))" />
              <stop offset="100%" stopColor="rgb(var(--warning))" />
            </linearGradient>
          </defs>
          {/* 背景环 */}
          <circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RING_RADIUS}
            fill="none"
            stroke="rgb(var(--muted) / 0.6)"
            strokeWidth={STROKE_WIDTH}
          />
          {/* 进度环：Framer Motion stroke-dashoffset 动画 */}
          <motion.circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RING_RADIUS}
            fill="none"
            stroke="url(#ringGradient)"
            strokeWidth={STROKE_WIDTH}
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            initial={{ strokeDashoffset: CIRCUMFERENCE }}
            animate={{ strokeDashoffset: offset }}
            transition={{ type: 'spring', stiffness: 60, damping: 18, duration: 1 }}
          />
        </svg>
        {/* 中心百分比 */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <b className="font-serif text-2.5xl font-bold text-foreground leading-none">{percent}%</b>
          <small className="text-[12px] tracking-wider text-muted-foreground mt-1.5">
            {formatWordCount(todayWords)} / {formatWordCount(dailyGoal)}
          </small>
        </div>
      </div>

      {/* 目标信息区 */}
      <div className="flex flex-1 flex-col">
        <h4 className="mb-1.5 text-[13px] tracking-wider text-foreground">
          今日目标 {formatWordCount(dailyGoal)} 字
        </h4>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          连续写作{' '}
          <b className="font-serif text-primary">{streak}</b> 天，
          {percent >= 100
            ? '已达成今日目标，江湖未完，再接再厉。'
            : `距目标还差 ${formatWordCount(Math.max(0, dailyGoal - todayWords))} 字。`}
        </p>
        {/* 线性进度条 */}
        <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-muted">
          <motion.div
            className="h-full rounded-full"
            style={{
              background: 'linear-gradient(90deg, rgb(var(--primary)), rgb(var(--warning))',
            }}
            initial={{ width: 0 }}
            animate={{ width: `${percent}%` }}
            transition={{ type: 'spring', stiffness: 60, damping: 18, duration: 1 }}
          />
        </div>
        {/* 火焰连续天数标识 */}
        <div
          className={cn(
            'mt-2 inline-flex items-center gap-1 self-start rounded-full px-2 py-0.5',
            streak > 0 ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
          )}
          title={`今日 ${formatDate(Date.now())}`}
        >
          <Flame className="h-3 w-3" aria-hidden="true" />
          <span className="text-[11px]">{streak} 天连击</span>
        </div>
      </div>
    </div>
  );
}

export default GoalRing;
