/**
 * EditorTopBar 编辑器顶栏
 *
 * 包含：章节标题输入、大纲开关、状态徽章、字数统计、容量徽章、保存状态，
 * 以及根据章节状态显示的「标记完成 / 归档 / 恢复写作」操作按钮。
 */
import { Archive, RotateCcw, BookOpen, HardDrive } from 'lucide-react';
import { Button } from '../../components/ui';
import { cn } from '../../utils/cn';
import { formatWordCount } from '../../utils/wordCount';
import type { CapacityLevel } from '../../utils/contentSize';
import type { ChapterStatus } from '../../types';
import { CHAPTER_STATUS_CONFIG } from './constants';
import type { SaveStatusDisplay } from './hooks/useSaveStatusDisplay';

export interface EditorTopBarProps {
  title: string;
  onTitleChange: (value: string) => void;
  onTitleBlur: () => void;
  outlineOpen: boolean;
  onOutlineOpen: () => void;
  status: ChapterStatus;
  wordCount: number;
  sizeKB: number;
  capacityLevel: CapacityLevel;
  capacityBadgeCls: string;
  capacityTooltip: string;
  saveDisplay: SaveStatusDisplay;
  onMarkDone: () => void;
  onArchive: () => void;
  onRestore: () => void;
}

export function EditorTopBar({
  title,
  onTitleChange,
  onTitleBlur,
  outlineOpen,
  onOutlineOpen,
  status,
  wordCount,
  sizeKB,
  capacityLevel,
  capacityBadgeCls,
  capacityTooltip,
  saveDisplay,
  onMarkDone,
  onArchive,
  onRestore,
}: EditorTopBarProps) {
  const SaveIcon = saveDisplay.icon;
  const statusBadge = CHAPTER_STATUS_CONFIG[status];

  return (
    <div className="flex shrink-0 items-center gap-4 border-b border-border/60 bg-background/75 backdrop-blur-md px-6 py-3 z-10 shadow-sm">
      {/* 章节标题（可编辑，带有雅致焦点边框） */}
      <input
        type="text"
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
        onBlur={onTitleBlur}
        className="min-w-0 flex-1 bg-transparent font-serif text-base font-bold text-foreground border-b border-transparent focus:border-secondary/50 pb-0.5 outline-none transition-all placeholder:text-muted-foreground focus:outline-none"
        placeholder="未命名章节"
        aria-label="章节标题"
      />

      {/* 大纲按钮 */}
      <Button
        variant="ghost"
        size="sm"
        onClick={onOutlineOpen}
        className={cn(
          'text-foreground border-border hover:bg-muted rounded-md text-xs font-semibold py-1 shadow-sm',
          outlineOpen && 'bg-primary/10 border-primary/40 text-primary',
        )}
        icon={<BookOpen className="h-3 w-3" aria-hidden="true" />}
      >
        大纲
      </Button>

      {/* 状态徽章 */}
      <span
        className={cn(
          'rounded-full px-2.5 py-0.5 text-[12px] tracking-widest font-semibold border border-transparent shadow-sm scale-95',
          statusBadge.badgeCls,
          status === 'done'
            ? 'border-moss/30'
            : status === 'writing'
              ? 'border-primary/30'
              : 'border-secondary/30',
        )}
      >
        {statusBadge.label}
      </span>

      {/* 字数统计 */}
      <span className="font-mono text-xs text-muted-foreground border-l border-border-soft/60 pl-3">
        {formatWordCount(wordCount)} 字
      </span>

      {/* 容量显示徽章 */}
      <span
        className={cn(
          'flex items-center gap-1 font-mono text-[12px] rounded-full px-2 py-0.5 border shadow-sm scale-95',
          capacityBadgeCls,
          capacityLevel === 'danger' && 'animate-pulse',
        )}
        title={capacityTooltip}
      >
        <HardDrive className="h-3 w-3" aria-hidden="true" />
        {sizeKB} KB / 100KB
      </span>

      {/* 保存状态 */}
      <span
        className={cn(
          'flex items-center gap-1.5 font-mono text-[12px] border-l border-border-soft/60 pl-3',
          saveDisplay.cls,
        )}
      >
        <SaveIcon
          className={cn('h-3.5 w-3.5', saveDisplay.spin && 'animate-spin')}
          aria-hidden="true"
        />
        {saveDisplay.text}
      </span>

      {/* 标记完成按钮（仅 writing/draft 状态显示） */}
      {(status === 'draft' || status === 'writing') && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onMarkDone}
          className="text-moss border-moss/45 hover:bg-moss hover:text-white rounded-md text-xs font-semibold py-1 ml-2 shadow-sm"
        >
          标记完成
        </Button>
      )}

      {/* 归档按钮（仅 done 状态显示） */}
      {status === 'done' && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onArchive}
          className="text-muted-foreground border-border hover:bg-muted hover:text-foreground rounded-md text-xs font-semibold py-1 ml-2 shadow-sm"
          icon={<Archive className="h-3 w-3" aria-hidden="true" />}
        >
          归档
        </Button>
      )}

      {/* 恢复写作按钮（仅 archived 状态显示） */}
      {status === 'archived' && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onRestore}
          className="text-primary border-primary/45 hover:bg-primary hover:text-white rounded-md text-xs font-semibold py-1 ml-2 shadow-sm"
          icon={<RotateCcw className="h-3 w-3" aria-hidden="true" />}
        >
          恢复写作
        </Button>
      )}
    </div>
  );
}

export default EditorTopBar;
