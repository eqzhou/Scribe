/**
 * BookCard 作品卡片
 *
 * 设计规范：
 * - 圆角：rounded-xl
 * - 背景：bg-card，border border-border
 * - 阴影：默认 shadow-sm，悬停 shadow-md
 * - 悬停：y:-3 + border-primary/40
 * - 封面区：渐变背景 + 书脊效果 + 首字母标识
 * - 底部：border-t border-soft，统计信息
 */
import { motion } from 'framer-motion';
import { Edit3, Trash2 } from 'lucide-react';
import type { Book } from '../../types';
import { cn } from '../../utils/cn';
import { formatWordCount } from '../../utils/wordCount';

export interface BookCardProps {
  book: Book;
  chapterCount: number;
  wordCount: number;
  isActive?: boolean;
  onOpen: (book: Book) => void;
  onEdit: (book: Book) => void;
  onDelete: (book: Book) => void;
}

export function BookCard({
  book,
  chapterCount,
  wordCount,
  isActive = false,
  onOpen,
  onEdit,
  onDelete,
}: BookCardProps) {
  const progress =
    book.targetWords > 0
      ? Math.min(100, Math.round((wordCount / book.targetWords) * 100))
      : 0;

  const stopPropagation = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <motion.article
      whileHover={{ y: -3 }}
      transition={{ type: 'spring', stiffness: 350, damping: 24 }}
      onClick={() => onOpen(book)}
      className={cn(
        'group relative cursor-pointer overflow-hidden rounded-xl border border-border bg-card shadow-sm',
        'transition-all duration-300 hover:shadow-md hover:border-primary/40',
        isActive && 'border-primary ring-1 ring-primary/30',
      )}
    >
      {/* 封面区 */}
      <div
        className="relative flex h-[126px] items-center justify-center overflow-hidden select-none"
        style={{
          background: `linear-gradient(135deg, ${book.coverColor}88 0%, ${book.coverColor}33 100%)`,
        }}
      >
        {/* 书脊效果 */}
        <div
          className="absolute left-0 top-0 bottom-0 w-3.5 bg-black/20 z-10 border-r border-white/5"
          style={{ boxShadow: 'inset -2px 0 4px rgba(0,0,0,0.3)' }}
          aria-hidden="true"
        />

        {/* 分类标签 */}
        <div className="absolute left-4 top-3 bg-black/40 backdrop-blur-sm border border-white/10 text-white/90 px-2 py-0.5 rounded text-[12px] font-sans tracking-wider z-10">
          {book.genre}
        </div>

        {/* 书籍标识：首两字母 */}
        <div className="relative flex items-center justify-center h-12 w-12 rounded-lg border border-white/20 bg-white/10 backdrop-blur-sm shadow-inner">
          <span
            className="font-sans text-[18px] font-bold text-white uppercase tracking-wider"
            style={{ textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}
            aria-hidden="true"
          >
            {book.title.slice(0, 2)}
          </span>
        </div>

        {/* 选中徽章 */}
        {isActive && (
          <span className="absolute right-3 top-3 rounded-md bg-primary px-2 py-0.5 font-sans text-[12px] font-semibold tracking-wide text-primary-foreground shadow-sm">
            执笔中
          </span>
        )}

        {/* 悬停操作按钮 */}
        <div
          className="absolute right-3 bottom-3 flex gap-1.5 opacity-0 transition-all duration-200 group-hover:opacity-100 translate-y-1 group-hover:translate-y-0"
          onClick={stopPropagation}
        >
          <button
            type="button"
            title="编辑作品"
            onClick={() => onEdit(book)}
            className={cn(
              'flex h-7 w-7 items-center justify-center rounded-md shadow-sm border border-border',
              'bg-background/80 text-muted-foreground backdrop-blur-md',
              'transition-all duration-200 hover:bg-background hover:text-primary',
            )}
            aria-label="编辑作品"
          >
            <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          <button
            type="button"
            title="删除作品"
            onClick={() => onDelete(book)}
            className={cn(
              'flex h-7 w-7 items-center justify-center rounded-md shadow-sm border border-border',
              'bg-background/80 text-muted-foreground backdrop-blur-md',
              'transition-all duration-200 hover:bg-destructive hover:text-destructive-foreground hover:border-destructive',
            )}
            aria-label="删除作品"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* 内容区 */}
      <div className="flex flex-col gap-2.5 p-4">
        {/* 书名与副标题 */}
        <div>
          <h3 className="font-sans text-base font-semibold leading-tight text-foreground group-hover:text-primary transition-colors truncate">
            {book.title}
          </h3>
          {book.subtitle ? (
            <p className="font-sans text-xs text-muted-foreground mt-1 truncate">{book.subtitle}</p>
          ) : (
            <p className="h-4 mt-1" />
          )}
        </div>

        {/* 简介：2 行截断 */}
        {book.synopsis ? (
          <p className="text-xs leading-relaxed text-muted-foreground line-clamp-2 h-9">
            {book.synopsis}
          </p>
        ) : (
          <p className="text-xs leading-relaxed text-muted-foreground italic h-9">
            暂无作品简介。
          </p>
        )}

        {/* 统计：字数 / 章节数 / 进度 */}
        <div className="mt-1 flex items-center gap-3 border-t border-border-soft pt-3 text-[11px] text-muted-foreground">
          <span title="累计字数">
            字数 <span className="font-medium text-foreground">{formatWordCount(wordCount)}</span>
          </span>
          <span className="text-border" aria-hidden="true">|</span>
          <span title="章节数">
            章节 <span className="font-medium text-foreground">{chapterCount}</span>
          </span>
          <span className="text-border" aria-hidden="true">|</span>
          <span title="目标进度">
            进度 <span className="font-medium text-primary">{progress}%</span>
          </span>
        </div>

        {/* 进度条 */}
        <div
          className="h-1 w-full overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </motion.article>
  );
}

export default BookCard;
