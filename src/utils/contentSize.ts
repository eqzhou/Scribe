/**
 * 章节内容大小工具
 *
 * 用于估算章节内容字节数与判定容量等级，
 * 供 WritingCanvas 顶栏的容量徽章显示使用。
 */

/** 内容容量等级 */
export type CapacityLevel = 'normal' | 'warning' | 'danger';

/** 章节内容大小上限（字节） */
export const CONTENT_SIZE_LIMIT = 100 * 1024;
/** 警告阈值（字节）：80KB */
export const CONTENT_WARNING_THRESHOLD = 80 * 1024;

/**
 * 计算章节内容大小（KB，保留 1 位小数）
 * 使用 UTF-16 码元估算：content.length * 2
 */
export function getContentSizeKB(content: string): number {
  const bytes = content.length * 2;
  return Math.round((bytes / 1024) * 10) / 10;
}

/**
 * 获取容量等级：normal / warning / danger
 */
export function getCapacityLevel(content: string): CapacityLevel {
  const bytes = content.length * 2;
  if (bytes > CONTENT_SIZE_LIMIT) return 'danger';
  if (bytes > CONTENT_WARNING_THRESHOLD) return 'warning';
  return 'normal';
}
