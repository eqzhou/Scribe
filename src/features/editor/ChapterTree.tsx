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
 *
 * 单个章节项的渲染与交互（拖拽手柄、状态菜单、删除按钮）已拆分至
 * ./ChapterTree/SortableChapterItem。状态颜色/标签统一来自 ./constants。
 */
import { useState } from 'react';
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
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Plus, ChevronRight, BookPlus, FilePlus } from 'lucide-react';
import { db } from '../../lib/db';
import { chapterRepository, volumeRepository } from '../../lib/repositories';
import type { Chapter, ChapterStatus, Volume } from '../../types';
import { useEditorStore, useToastStore } from '../../stores';
import { useDeleteWithImpact } from '../../hooks/useDeleteWithImpact';
import { cn } from '../../utils/cn';
import { Button, ConfirmDialog } from '../../components/ui';
import { CHAPTER_STATUS_CONFIG } from './constants';
import { SortableChapterItem } from './ChapterTree/SortableChapterItem';

export interface ChapterTreeProps {
  bookId: string;
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

  // 删除章节状态：保留章节对象用于构建确认文案，引用影响检测复用通用 Hook
  const [confirmDelete, setConfirmDelete] = useState<Chapter | null>(null);
  const { deleteImpact, requestDelete, cancelDelete } = useDeleteWithImpact();
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

  /** 打开删除确认：记录章节 + 由 Hook 检测引用影响 */
  const handleDeleteClick = async (chapter: Chapter): Promise<void> => {
    setConfirmDelete(chapter);
    await requestDelete('chapter', chapter.id, bookId);
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
    pushToast(
      'success',
      `章节「${chapter.title}」已切换为「${CHAPTER_STATUS_CONFIG[newStatus].label}」`,
    );
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
              const volume = group.volume;
              const volId = volume?.id ?? '__ungrouped__';
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
                      {volume?.title ?? '未分卷'}
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
                  {!isCollapsed && volume && (
                    <button
                      type="button"
                      onClick={() => handleNewChapter(volume.id)}
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
          cancelDelete();
        }}
      />
    </aside>
  );
}

export default ChapterTree;
