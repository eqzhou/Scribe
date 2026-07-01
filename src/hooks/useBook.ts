/**
 * 当前作品 Hook
 *
 * 返回 store 中当前选中作品的对象。
 * 当 currentBookId 为空或对应作品已被删除时返回 undefined。
 */
import { useBookStore } from '../stores/bookStore';
import type { Book } from '../types';

/**
 * 获取当前选中的作品。
 *
 * @returns 当前作品对象，未选中或不存在时返回 undefined
 */
export function useBook(): Book | undefined {
  const currentBookId = useBookStore((s) => s.currentBookId);
  const books = useBookStore((s) => s.books);
  return books.find((b) => b.id === currentBookId);
}
