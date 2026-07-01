/**
 * 作品 Store
 *
 * 管理当前选中作品 ID 与作品列表缓存。
 * 依据技术架构文档第 8.1 节定义。
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Book } from '../types';
import { bookRepository } from '../lib/repositories';

export interface BookStore {
  /** 当前选中作品 ID */
  currentBookId: string | null;
  /** 作品列表缓存 */
  books: Book[];
  /** 设置当前选中作品 */
  setCurrentBook: (id: string) => void;
  /** 从仓库刷新作品列表，并修正 currentBookId 的合法性 */
  refreshBooks: () => Promise<void>;
  /** 根据 ID 从缓存中查找作品 */
  getBook: (id: string) => Book | undefined;
}

export const useBookStore = create<BookStore>()(
  persist(
    (set, get) => ({
      currentBookId: null,
      books: [],
      setCurrentBook: (id) => set({ currentBookId: id }),
      refreshBooks: async () => {
        // Book 为顶层实体，bookRepository.list 忽略 bookId 参数返回全部作品，
        // 此处传空串仅为满足 Repository<T> 的统一签名
        const books = await bookRepository.list('');
        set({ books });
        // 若当前无选中作品且有作品，默认选第一个
        if (!get().currentBookId && books.length > 0) {
          set({ currentBookId: books[0].id });
        }
        // 若当前选中作品已被删除，清空或回退到第一个
        if (get().currentBookId && !books.find((b) => b.id === get().currentBookId)) {
          set({ currentBookId: books[0]?.id ?? null });
        }
      },
      getBook: (id) => get().books.find((b) => b.id === id),
    }),
    { name: 'scribe-book' },
  ),
);
