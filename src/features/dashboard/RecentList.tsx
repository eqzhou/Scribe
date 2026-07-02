/**
 * RecentList 最近编辑列表
 *
 * 参考HTML原型 .recent-list 样式：
 * - 查询当前作品最近 5 个更新的章节（按 updatedAt 倒序）
 * - 每项：左侧色彩条（chapter=foreground）、标题、副信息（状态 + 字数）、相对时间
 * - 点击跳转到编辑器
 */
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../lib/db';
import type { Chapter, ChapterStatus } from '../../types';
import { getRelativeTime } from '../../utils/date';
import { formatWordCount } from '../../utils/wordCount';
import { cn } from '../../utils/cn';

export interface RecentListProps {
  /** 当前作品 ID；为空时返回占位 */
  bookId: string | null;
}

/** 章节状态 → 中文标签 */
const STATUS_LABEL: Record<ChapterStatus, string> = {
  draft: '草稿',
  writing: '写作中',
  done: '已完成',
  archived: '已归档',
};

/** 显示的最近条目数 */
const LIMIT = 5;

/**
 * 最近编辑列表：展示当前作品最近更新的章节，点击跳转编辑器。
 */
export function RecentList({ bookId }: RecentListProps) {
  const navigate = useNavigate();

  // 实时监听当前作品的章节，按 updatedAt 倒序取前 5
  const chapters = useLiveQuery(
    async (): Promise<Chapter[]> => {
      if (!bookId) return [];
      const all = await db.chapters.where('bookId').equals(bookId).toArray();
      // 按 updatedAt 倒序排序后截取前 LIMIT 条
      return all
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, LIMIT);
    },
    [bookId],
    [],
  );

  // 渲染条目（统一为章节类型；color 标识固定为 chapter=foreground）
  const items = useMemo(() => {
    if (!chapters) return [];
    return chapters.map((c) => ({
      id: c.id,
      title: c.title,
      status: c.status,
      wordCount: c.wordCount,
      updatedAt: c.updatedAt,
    }));
  }, [chapters]);

  if (items.length === 0) {
    return (
      <div className="px-2 py-10 text-center font-serif text-sm text-muted-foreground">
        暂无最近编辑记录
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0.5">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => navigate('/editor')}
          className={cn(
            'flex items-center gap-3.5 rounded-md px-2 py-3 text-left',
            'transition-colors duration-200 hover:bg-muted',
          )}
        >
          {/* 左侧色彩条：章节统一为墨黑 */}
          <span
            className="h-8 w-1 shrink-0 rounded-sm bg-foreground"
            aria-hidden="true"
          />
          {/* 标题 + 副信息 */}
          <div className="flex min-w-0 flex-1 flex-col">
            <b className="block truncate text-[13px] font-medium text-foreground">
              {item.title}
            </b>
            <small className="text-[11px] text-muted-foreground">
              章节 · {STATUS_LABEL[item.status]} · {formatWordCount(item.wordCount)} 字
            </small>
          </div>
          {/* 相对时间 */}
          <span className="shrink-0 font-mono text-[12px] opacity-70 text-muted-foreground">
            {getRelativeTime(item.updatedAt)}
          </span>
        </button>
      ))}
    </div>
  );
}

export default RecentList;
