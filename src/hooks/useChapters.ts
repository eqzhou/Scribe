/**
 * 章节列表 Hook
 *
 * 基于 dexie-react-hooks 的 useLiveQuery 实时监听当前作品的章节表，
 * 返回按 order 升序排序的章节数组。当前未选中作品时返回空数组。
 */
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import { useBook } from './useBook';
import type { Chapter } from '../types';

/**
 * 获取当前作品的章节列表（按 order 升序）。
 *
 * @returns 章节数组；数据库查询未完成时返回空数组
 */
export function useChapters(): Chapter[] {
  const book = useBook();
  const chapters = useLiveQuery(
    async () => {
      if (!book) return [] as Chapter[];
      // bookId 已建立索引；sortBy('order') 返回按章节顺序排列的数组
      return db.chapters.where('bookId').equals(book.id).sortBy('order');
    },
    [book?.id],
    [] as Chapter[],
  );
  return chapters;
}
