/**
 * 编辑器模块共享常量
 *
 * 章节状态配置原先分散在 WritingCanvas.tsx 和 ChapterTree.tsx，
 * 现统一导出，确保单一来源。
 */
import type { ChapterStatus } from '../../types';

/** 章节状态 → 完整配置（标签 + 圆点颜色 + 徽章样式 + 排序权重） */
export const CHAPTER_STATUS_CONFIG: Record<
  ChapterStatus,
  { label: string; dot: string; badgeCls: string }
> = {
  draft: {
    label: '草稿',
    dot: 'bg-secondary',
    badgeCls: 'bg-secondary/15 text-secondary',
  },
  writing: {
    label: '写作中',
    dot: 'bg-primary',
    badgeCls: 'bg-primary/15 text-primary',
  },
  done: {
    label: '已完成',
    dot: 'bg-moss',
    badgeCls: 'bg-moss/15 text-moss',
  },
  archived: {
    label: '已归档',
    dot: 'bg-muted-foreground/30',
    badgeCls: 'bg-muted-foreground/15 text-muted-foreground',
  },
};

/** 可切换的状态顺序（用于状态菜单展示） */
export const CHAPTER_STATUS_ORDER: ChapterStatus[] = [
  'draft',
  'writing',
  'done',
  'archived',
];
