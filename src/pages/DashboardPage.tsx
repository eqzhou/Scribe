/**
 * 工作台页面
 *
 * 创作总览：欢迎区 + 4 列统计卡片 + 双栏（热力图 + 每日目标环）+ 最近编辑。
 *
 * 布局：
 * - 顶部：欢迎区（大标题 + 日期标签 + 今日字数副文案）
 * - 4 列统计卡片网格：累计字数 / 已完成章节 / 角色数 / 世界观条目
 * - 双栏：左侧热力图（1.6fr） + 右侧每日目标环（1fr）
 * - 全宽：最近编辑面板
 *
 * 数据：useApiQuery 轮询当前作品的 chapters / characters / worldview / writingLogs。
 */
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, FileText, Users, Globe } from 'lucide-react';
import {
  chapterRepository,
  characterRepository,
  worldviewRepository,
  writingLogRepository,
} from '../lib/repositories';
import { useApiQuery } from '../hooks/useApiQuery';
import { useBook } from '../hooks';
import { useSettingStore } from '../stores';
import { todayDate } from '../utils/date';
import { formatWordCount } from '../utils/wordCount';
import { EmptyState } from '../components/ui';
import { StatCard } from '../features/dashboard/StatCard';
import { Heatmap } from '../features/dashboard/Heatmap';
import { GoalRing } from '../features/dashboard/GoalRing';
import { RecentList } from '../features/dashboard/RecentList';

/**
 * 工作台页面：当前作品的创作总览。
 */
export default function DashboardPage() {
  const navigate = useNavigate();
  const book = useBook();
  const dailyGoal = useSettingStore((s) => s.dailyGoal);

  const bookId = book?.id ?? null;

  // 实时监听当前作品的章节（用于统计累计字数与已完成章节数）
  const chapters = useApiQuery(
    async () => (bookId ? chapterRepository.list(bookId) : []),
    [bookId],
  ) ?? [];

  // 实时监听当前作品的角色数
  const characters = useApiQuery(
    async () => (bookId ? characterRepository.list(bookId) : []),
    [bookId],
  ) ?? [];

  // 实时监听当前作品的世界观条目
  const worldview = useApiQuery(
    async () => (bookId ? worldviewRepository.list(bookId) : []),
    [bookId],
  ) ?? [];

  // 实时监听当前作品的写作记录（用于欢迎区今日字数）
  const writingLogs = useApiQuery(
    async () => (bookId ? writingLogRepository.list(bookId) : []),
    [bookId],
  ) ?? [];

  // 聚合统计数据（archived 章节不计入主进度统计）
  const stats = useMemo(() => {
    const activeChapters = chapters.filter((c) => c.status !== 'archived');
    const totalWords = activeChapters.reduce((sum, c) => sum + c.wordCount, 0);
    const doneChapters = activeChapters.filter((c) => c.status === 'done').length;
    const characterCount = characters.length;
    const worldviewCount = worldview.length;
    return { totalWords, doneChapters, characterCount, worldviewCount };
  }, [chapters, characters, worldview]);

  // 今日字数与距目标差距
  const todayWords = useMemo(() => {
    const today = todayDate();
    return writingLogs
      .filter((l) => l.date === today)
      .reduce((sum, l) => sum + l.wordCount, 0);
  }, [writingLogs]);

  const remaining = Math.max(0, dailyGoal - todayWords);

  // 日期标签：YYYY.MM.DD
  const dateTag = useMemo(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}.${m}.${day}`;
  }, []);

  // 无作品时显示空状态
  if (!book) {
    return (
      <div className="px-8 py-6">
        <EmptyState
          glyph="墨"
          title="尚未选择作品"
          description="前往项目页面创建或选择一部作品，开始你的创作之旅。"
          action={{ label: '前往项目', onClick: () => navigate('/projects') }}
        />
      </div>
    );
  }

  return (
    <div className="px-8 py-6">
      {/* ============ 欢迎区 ============ */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="mb-2 text-2xl font-bold text-foreground">
            工作台
          </h1>
          <p className="text-sm text-muted-foreground">
            {todayWords > 0
              ? `今日已写作 ${formatWordCount(todayWords)} 字，${
                  remaining > 0
                    ? `距日目标还差 ${formatWordCount(remaining)} 字`
                    : '已达成今日目标，再接再厉'
                }。`
              : `今日尚未开笔，距日目标 ${formatWordCount(dailyGoal)} 字。`}
          </p>
        </div>
        <div className="inline-flex items-center rounded-lg border border-border bg-card px-3 py-1 shadow-sm">
          <span className="text-xs font-medium text-foreground">{dateTag}</span>
        </div>
      </div>

      {/* ============ 4 列统计卡片 ============ */}
      <div
        className="mb-7 grid gap-[18px]"
        style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}
      >
        <StatCard
          icon={BookOpen}
          variant="foreground"
          value={formatWordCount(stats.totalWords)}
          unit="字"
          label="累计字数"
        />
        <StatCard
          icon={FileText}
          variant="primary"
          value={stats.doneChapters}
          unit="章"
          label="已完成章节"
        />
        <StatCard
          icon={Users}
          variant="moss"
          value={stats.characterCount}
          unit="位"
          label="角色档案"
        />
        <StatCard
          icon={Globe}
          variant="secondary"
          value={stats.worldviewCount}
          unit="条"
          label="世界观设定"
        />
      </div>

      {/* ============ 双栏：热力图 + 每日目标环 ============ */}
      <div
        className="mb-6 grid gap-5"
        style={{ gridTemplateColumns: '1.6fr 1fr' }}
      >
        {/* 左：写作热力图 */}
        <section className="rounded-xl border border-border bg-card p-6 shadow-sm transition-all duration-300 hover:shadow-md">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-base font-semibold text-foreground">
              近半年写作热力
            </h3>
          </div>
          <Heatmap bookId={bookId} />
        </section>

        {/* 右：每日目标环 */}
        <section className="rounded-xl border border-border bg-card p-6 shadow-sm transition-all duration-300 hover:shadow-md">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-base font-semibold text-foreground">
              每日目标
            </h3>
          </div>
          <GoalRing bookId={bookId} />
        </section>
      </div>

      {/* ============ 最近编辑面板（全宽） ============ */}
      <section className="rounded-xl border border-border bg-card p-6 shadow-sm transition-all duration-300 hover:shadow-md">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-foreground">
            最近编辑
          </h3>
          <button
            type="button"
            onClick={() => navigate('/editor')}
            className="text-sm font-medium text-muted-foreground transition-colors duration-200 hover:text-primary"
          >
            全部记录 ›
          </button>
        </div>
        <RecentList bookId={bookId} />
      </section>
    </div>
  );
}
