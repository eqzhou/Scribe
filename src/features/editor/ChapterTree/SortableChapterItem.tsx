/**
 * SortableChapterItem 可拖拽章节项
 *
 * 从 ChapterTree.tsx 拆分而来，仅承担单个章节项的渲染与交互：
 * - 拖拽手柄（@dnd-kit/sortable）
 * - 状态圆点 + 切换菜单（使用共享 CHAPTER_STATUS_CONFIG / CHAPTER_STATUS_ORDER）
 * - 大纲摘要副标题（前 30 字）
 * - 悬停删除按钮
 */
import { useState, useRef, useEffect } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Check, Trash2 } from 'lucide-react';
import type { Chapter, ChapterStatus } from '../../../types';
import { cn } from '../../../utils/cn';
import { CHAPTER_STATUS_CONFIG, CHAPTER_STATUS_ORDER } from '../constants';

/** 大纲摘要最大字数 */
const OUTLINE_SUMMARY_LENGTH = 30;

/**
 * 获取章节大纲摘要（优先使用 outline，其次使用 summary，取前 30 字）
 */
function getChapterOutlineSummary(chapter: Chapter): string {
  const text = chapter.outline ?? chapter.summary ?? '';
  if (!text) return '';
  const firstLine = text.split('\n')[0] ?? text;
  return firstLine.length > OUTLINE_SUMMARY_LENGTH
    ? firstLine.slice(0, OUTLINE_SUMMARY_LENGTH) + '...'
    : firstLine;
}

/** 可拖拽的章节项 */
export interface SortableChapterItemProps {
  chapter: Chapter;
  active: boolean;
  onClick: () => void;
  onDelete: () => void;
  onStatusChange: (status: ChapterStatus) => void;
}

export function SortableChapterItem({
  chapter,
  active,
  onClick,
  onDelete,
  onStatusChange,
}: SortableChapterItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: chapter.id,
  });

  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭状态菜单
  useEffect(() => {
    if (!statusMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setStatusMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [statusMenuOpen]);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleStatusDotClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setStatusMenuOpen((prev) => !prev);
  };

  const handleStatusSelect = (status: ChapterStatus) => {
    onStatusChange(status);
    setStatusMenuOpen(false);
  };

  const outlineSummary = getChapterOutlineSummary(chapter);

  return (
    <li ref={setNodeRef} style={style} className="group/chapter relative">
      <button
        type="button"
        onClick={onClick}
        {...attributes}
        {...listeners}
        className={cn(
          'flex w-full items-start gap-2 rounded px-2 py-1.5 text-left pr-7',
          'transition-colors duration-150',
          active
            ? 'bg-primary/12 text-primary'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground',
          chapter.status === 'archived' && 'opacity-50',
        )}
      >
        {/* 状态圆点 + 菜单 */}
        <div className="relative mt-1" ref={menuRef}>
          <button
            type="button"
            onClick={handleStatusDotClick}
            className={cn(
              'h-2 w-2 shrink-0 rounded-full transition-transform hover:scale-150',
              CHAPTER_STATUS_CONFIG[chapter.status].dot,
            )}
            title={`${CHAPTER_STATUS_CONFIG[chapter.status].label}（点击切换）`}
            aria-label={`${CHAPTER_STATUS_CONFIG[chapter.status].label}，点击切换状态`}
          />
          {/* 状态切换下拉菜单 */}
          {statusMenuOpen && (
            <div className="absolute left-1/2 top-full z-50 mt-1.5 w-28 -translate-x-1/2 rounded-lg border border-border bg-background py-1 shadow-lifted">
              {CHAPTER_STATUS_ORDER.map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => handleStatusSelect(status)}
                  className={cn(
                    'flex w-full items-center gap-2 px-2.5 py-1.5 text-left transition-colors hover:bg-muted',
                    chapter.status === status ? 'text-foreground' : 'text-muted-foreground',
                  )}
                >
                  <span
                    className={cn(
                      'h-1.5 w-1.5 shrink-0 rounded-full',
                      CHAPTER_STATUS_CONFIG[status].dot,
                    )}
                  />
                  <span className="flex-1 text-[11px]">{CHAPTER_STATUS_CONFIG[status].label}</span>
                  {chapter.status === status && (
                    <Check className="h-3 w-3 text-moss" aria-hidden="true" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{chapter.title}</span>
          {outlineSummary && (
            <span
              className={cn(
                'mt-0.5 block truncate text-[12px]',
                active ? 'text-primary' : 'text-muted-foreground',
              )}
            >
              {outlineSummary}
            </span>
          )}
        </div>
        {chapter.wordCount > 0 && (
          <span className="mt-0.5 shrink-0 font-mono text-[12px] text-muted-foreground">
            {(chapter.wordCount / 1000).toFixed(1)}k
          </span>
        )}
      </button>
      {/* 删除按钮（悬停时显示） */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        title="删除章节"
        aria-label={`删除章节「${chapter.title}」`}
        className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground opacity-0 transition-all hover:bg-primary/10 hover:text-primary focus-visible:opacity-100 group-hover/chapter:opacity-100"
      >
        <Trash2 className="h-3 w-3" aria-hidden="true" />
      </button>
    </li>
  );
}

export default SortableChapterItem;
