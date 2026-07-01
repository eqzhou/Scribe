/**
 * ChapterTree 章节树
 *
 * 左侧栏：卷宗折叠分组，章节按 order 排序。
 * - 章节状态圆点：draft 铜金 / writing 朱砂红 / done 墨绿 / archived 灰
 * - 点击状态圆点弹出状态切换菜单
 * - @dnd-kit/sortable 拖拽排序章节（更新 order）
 * - 新建章节 / 卷宗按钮
 * - 选中章节高亮（对齐 editorStore.currentChapterId）
 * - 章节项显示大纲摘要（前 30 字）作为副标题
 */
import { useState, useRef, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Plus, ChevronRight, BookPlus, FilePlus, Trash2, Check } from 'lucide-react';
import { db } from '../../lib/db';
import { chapterRepository, volumeRepository } from '../../lib/repositories';
import { checkReferences } from '../../lib/referenceChecker';
import type { Chapter, ChapterStatus, Volume } from '../../types';
import type { ImpactInfo } from '../../components/ui';
import { useEditorStore, useToastStore } from '../../stores';
import { cn } from '../../utils/cn';
import { Button, ConfirmDialog } from '../../components/ui';

export interface ChapterTreeProps {
  bookId: string;
}

/** 章节状态 → 圆点颜色 */
const STATUS_DOT: Record<ChapterStatus, string> = {
  draft: 'bg-secondary',
  writing: 'bg-primary',
  done: 'bg-moss',
  archived: 'bg-muted-foreground/30',
};

/** 章节状态 → 中文标签 */
const STATUS_LABEL: Record<ChapterStatus, string> = {
  draft: '草稿',
  writing: '写作中',
  done: '已完成',
  archived: '已归档',
};

/** 可切换的状态顺序（用于状态菜单展示） */
const STATUS_ORDER: ChapterStatus[] = ['draft', 'writing', 'done', 'archived'];

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

/**
 * 章节树：卷宗分组 + 拖拽排序 + 新建。
 */
export function ChapterTree({ bookId }: ChapterTreeProps) {
  const currentChapterId = useEditorStore((s) => s.currentChapterId);
  const setCurrentChapter = useEditorStore((s) => s.setCurrentChapter);

  // 实时监听卷宗（按 order 升序）
  const volumes = useLiveQuery(
    async () => {
      if (!bookId) return [] as Volume[];
      return db.volumes.where('bookId').equals(bookId).sortBy('order');
    },
    [bookId],
    [] as Volume[],
  );

  // 实时监听章节（按 order 升序）
  const chapters = useLiveQuery(
    async () => {
      if (!bookId) return [] as Chapter[];
      return db.chapters.where('bookId').equals(bookId).sortBy('order');
    },
    [bookId],
    [] as Chapter[],
  );

  const [collapsedVolumes, setCollapsedVolumes] = useState<Set<string>>(new Set());

  // 删除章节状态
  const [confirmDelete, setConfirmDelete] = useState<Chapter | null>(null);
  const [deleteImpact, setDeleteImpact] = useState<ImpactInfo | null>(null);
  const pushToast = useToastStore.getState().pushToast;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  /** 切换卷宗折叠 */
  const toggleVolume = (volumeId: string) => {
    setCollapsedVolumes((prev) => {
      const next = new Set(prev);
      if (next.has(volumeId)) next.delete(volumeId);
      else next.add(volumeId);
      return next;
    });
  };

  /** 新建卷宗 */
  const handleNewVolume = async (): Promise<void> => {
    const nextOrder = volumes.length === 0 ? 0 : Math.max(...volumes.map((v) => v.order)) + 1;
    await volumeRepository.create({
      bookId,
      title: `第${volumes.length + 1}卷`,
      order: nextOrder,
    });
  };

  /** 新建章节（默认归入第一个卷宗或无卷宗） */
  const handleNewChapter = async (volumeId?: string): Promise<void> => {
    const volId = volumeId ?? volumes[0]?.id;
    const siblingChapters = volId
      ? chapters.filter((c) => c.volumeId === volId)
      : chapters.filter((c) => !c.volumeId);
    const nextOrder =
      siblingChapters.length === 0
        ? 0
        : Math.max(...siblingChapters.map((c) => c.order)) + 1;
    const chapter = await chapterRepository.create({
      bookId,
      volumeId: volId,
      title: `第${chapters.length + 1}章`,
      content: '',
      summary: '',
      status: 'draft',
      wordCount: 0,
      order: nextOrder,
    });
    setCurrentChapter(chapter.id);
  };

  /** 拖拽结束：更新章节 order */
  const handleDragEnd = async (event: DragEndEvent): Promise<void> => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const activeChapter = chapters.find((c) => c.id === active.id);
    const overChapter = chapters.find((c) => c.id === over.id);
    if (!activeChapter || !overChapter) return;
    // 仅允许同一卷宗内排序
    if (activeChapter.volumeId !== overChapter.volumeId) return;

    const siblings = chapters
      .filter((c) => c.volumeId === activeChapter.volumeId)
      .sort((a, b) => a.order - b.order);
    const oldIndex = siblings.findIndex((c) => c.id === activeChapter.id);
    const newIndex = siblings.findIndex((c) => c.id === overChapter.id);
    if (oldIndex === -1 || newIndex === -1) return;

    // 重新分配 order
    const reordered = [...siblings];
    const [moved] = reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, moved);
    await db.transaction('rw', db.chapters, async () => {
      for (let i = 0; i < reordered.length; i++) {
        if (reordered[i].order !== i) {
          await chapterRepository.update(reordered[i].id, { order: i });
        }
      }
    });
  };

  /** 打开删除确认：调用 checkReferences 检测引用影响 */
  const handleDeleteClick = async (chapter: Chapter): Promise<void> => {
    setConfirmDelete(chapter);
    const impact = await checkReferences('chapter', chapter.id, bookId);
    setDeleteImpact(impact);
  };

  /** 确认删除章节 */
  const handleConfirmDelete = async (): Promise<void> => {
    if (!confirmDelete) return;
    const targetId = confirmDelete.id;
    const targetTitle = confirmDelete.title;
    // 删除前选好相邻章节（避免删除后无选中）
    const idx = chapters.findIndex((c) => c.id === targetId);
    const neighbor =
      idx > 0
        ? chapters[idx - 1]
        : idx < chapters.length - 1
          ? chapters[idx + 1]
          : null;
    await chapterRepository.delete(targetId);
    if (neighbor) {
      setCurrentChapter(neighbor.id);
    } else {
      setCurrentChapter(null);
    }
    pushToast('success', `已删除章节「${targetTitle}」`);
  };

  /** 切换章节状态 */
  const handleStatusChange = async (chapter: Chapter, newStatus: ChapterStatus): Promise<void> => {
    if (chapter.status === newStatus) return;
    await chapterRepository.update(chapter.id, { status: newStatus });
    pushToast('success', `章节「${chapter.title}」已切换为「${STATUS_LABEL[newStatus]}」`);
  };

  // 按卷宗分组（无卷宗的章节归入"未分卷"组）
  const groupedChapters = (volumes: Volume[], allChapters: Chapter[]) => {
    const groups: Array<{ volume: Volume | null; items: Chapter[] }> = [];
    for (const vol of volumes) {
      groups.push({
        volume: vol,
        items: allChapters.filter((c) => c.volumeId === vol.id),
      });
    }
    const ungrouped = allChapters.filter((c) => !c.volumeId);
    if (ungrouped.length > 0 || groups.length === 0) {
      groups.push({ volume: null, items: ungrouped });
    }
    return groups;
  };

  const groups = groupedChapters(volumes, chapters);

  return (
    <aside className="flex h-full w-[240px] flex-col border-r border-border bg-muted/50">
      {/* 头部：标题 + 新建按钮 */}
      <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
        <span className="font-serif text-sm font-semibold tracking-wide text-foreground">章节</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => handleNewChapter()}
            title="新建章节"
            aria-label="新建章节"
            className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <FilePlus className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={handleNewVolume}
            title="新建卷宗"
            aria-label="新建卷宗"
            className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <BookPlus className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* 章节列表 */}
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {chapters.length === 0 && volumes.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-4 py-8 text-center">
            <p className="text-xs text-muted-foreground">暂无章节</p>
            <Button
              variant="primary"
              size="sm"
              icon={<Plus className="h-3.5 w-3.5" aria-hidden="true" />}
              onClick={() => handleNewChapter()}
            >
              新建章节
            </Button>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            {groups.map((group) => {
              const volId = group.volume?.id ?? '__ungrouped__';
              const isCollapsed = collapsedVolumes.has(volId);
              return (
                <div key={volId} className="mb-2">
                  {/* 卷宗头 */}
                  <button
                    type="button"
                    onClick={() => toggleVolume(volId)}
                    className="flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-left transition-colors hover:bg-muted"
                  >
                    <ChevronRight
                      className={cn(
                        'h-3 w-3 text-muted-foreground transition-transform',
                        !isCollapsed && 'rotate-90',
                      )}
                      aria-hidden="true"
                    />
                    <span className="flex-1 truncate text-sm font-semibold text-foreground">
                      {group.volume?.title ?? '未分卷'}
                    </span>
                    <span className="font-mono text-[12px] text-muted-foreground">
                      {group.items.length}
                    </span>
                  </button>

                  {/* 章节列表 */}
                  {!isCollapsed && (
                    <SortableContext
                      items={group.items.map((c) => c.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <ul className="ml-2 border-l border-border/60 pl-2">
                        {group.items.map((chapter) => (
                          <SortableChapterItem
                            key={chapter.id}
                            chapter={chapter}
                            active={chapter.id === currentChapterId}
                            onClick={() => setCurrentChapter(chapter.id)}
                            onDelete={() => void handleDeleteClick(chapter)}
                            onStatusChange={(status) => void handleStatusChange(chapter, status)}
                          />
                        ))}
                      </ul>
                    </SortableContext>
                  )}

                  {/* 卷宗内新建章节 */}
                  {!isCollapsed && group.volume && (
                    <button
                      type="button"
                      onClick={() => handleNewChapter(group.volume!.id)}
                      className="ml-4 mt-1 flex items-center gap-1 rounded px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      <Plus className="h-3 w-3" aria-hidden="true" />
                      新建章节
                    </button>
                  )}
                </div>
              );
            })}
          </DndContext>
        )}
      </div>

      {/* 删除章节确认 */}
      <ConfirmDialog
        open={confirmDelete !== null}
        title="删除章节"
        message={`确认删除章节「${confirmDelete?.title ?? ''}」？该章正文将被永久删除，且操作不可撤销。`}
        impactDetails={deleteImpact}
        confirmText="删除"
        cancelText="取消"
        danger
        onConfirm={() => void handleConfirmDelete()}
        onClose={() => {
          setConfirmDelete(null);
          setDeleteImpact(null);
        }}
      />
    </aside>
  );
}

/** 可拖拽的章节项 */
interface SortableChapterItemProps {
  chapter: Chapter;
  active: boolean;
  onClick: () => void;
  onDelete: () => void;
  onStatusChange: (status: ChapterStatus) => void;
}

function SortableChapterItem({ chapter, active, onClick, onDelete, onStatusChange }: SortableChapterItemProps) {
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
              STATUS_DOT[chapter.status],
            )}
            title={`${STATUS_LABEL[chapter.status]}（点击切换）`}
            aria-label={`${STATUS_LABEL[chapter.status]}，点击切换状态`}
          />
          {/* 状态切换下拉菜单 */}
          {statusMenuOpen && (
            <div className="absolute left-1/2 top-full z-50 mt-1.5 w-28 -translate-x-1/2 rounded-lg border border-border bg-background py-1 shadow-lifted">
              {STATUS_ORDER.map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => handleStatusSelect(status)}
                  className={cn(
                    'flex w-full items-center gap-2 px-2.5 py-1.5 text-left transition-colors hover:bg-muted',
                    chapter.status === status ? 'text-foreground' : 'text-muted-foreground',
                  )}
                >
                  <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', STATUS_DOT[status])} />
                  <span className="flex-1 text-[11px]">{STATUS_LABEL[status]}</span>
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
                active ? 'text-primary/70' : 'text-muted-foreground/70',
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

export default ChapterTree;
