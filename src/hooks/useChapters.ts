/**
 * 章节列表 Hook
 *
 * 基于 useApiQuery 轮询当前作品的章节列表，返回按 order 升序排序的章节数组。
 * 当前未选中作品时返回空数组。
 */
import { useApiQuery } from './useApiQuery';
import { chapterRepository } from '../lib/repositories';
import { useBook } from './useBook';
import type { Chapter } from '../types';

/**
 * 获取当前作品的章节列表（按 order 升序）。
 *
 * @returns 章节数组；查询未完成时返回空数组
 */
export function useChapters(): Chapter[] {
  const book = useBook();
  const chapters = useApiQuery<Chapter[]>(
    async () => {
      if (!book) return [] as Chapter[];
      // chapterRepository.list 已按 order 升序排序
      return chapterRepository.list(book.id);
    },
    [book?.id],
  );
  return chapters ?? [];
}
