/**
 * 作品 Repository
 *
 * 特殊：Book 为最顶层实体，无 bookId 字段，list 返回全部作品。
 */
import { apiGet } from '../api';
import type { Book } from '../../types';
import { createApiRepository, type Repository } from './baseRepository';

export interface BookRepository extends Omit<Repository<Book>, 'list'> {
  /** Book 为顶层实体，list 不需要 bookId 参数 */
  list(): Promise<Book[]>;
}

/** 将 ISO 时间字符串转换为 Unix 毫秒；非字符串或非法值原样返回 */
function toMs(v: unknown): unknown {
  if (typeof v === 'string' && v.length > 0) {
    const ms = new Date(v).getTime();
    if (!Number.isNaN(ms)) return ms;
  }
  return v;
}

export const bookRepository: BookRepository = {
  ...createApiRepository<Book>({
    entityPath: (id) => `/api/books/${id}`,
    collectionPath: () => '/api/books',
    // Book 为顶层实体，POST /api/books 即可
    createPath: () => '/api/books',
  }),

  // 覆盖 list：Book 顶层实体，bookId 参数无意义，返回全部作品
  async list(): Promise<Book[]> {
    const items = await apiGet<Book[]>('/api/books');
    return (items ?? []).map((b) => {
      const r = { ...b } as Record<string, unknown>;
      r.createdAt = toMs(r.createdAt);
      r.updatedAt = toMs(r.updatedAt);
      return r as unknown as Book;
    });
  },
};
