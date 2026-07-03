/**
 * 世界观条目 Repository
 *
 * list 按 bookId 过滤，支持按 category 二级过滤。
 */
import { apiGet } from '../api';
import type { WorldviewEntry, WorldviewCategory } from '../../types';
import { createApiRepository, type Repository } from './baseRepository';

/** 世界观 Repository 接口：扩展 list 以支持 category 二级过滤 */
export interface WorldviewRepository extends Repository<WorldviewEntry> {
  list(bookId: string, category?: WorldviewCategory): Promise<WorldviewEntry[]>;
}

export const worldviewRepository: WorldviewRepository = {
  ...createApiRepository<WorldviewEntry>({
    entityPath: (id) => `/api/worldview/${id}`,
    collectionPath: (bookId) => `/api/books/${bookId}/worldview`,
  }),

  // 覆盖 list：支持按 category 二级过滤
  async list(bookId: string, category?: WorldviewCategory): Promise<WorldviewEntry[]> {
    const path = category
      ? `/api/books/${bookId}/worldview?category=${encodeURIComponent(category)}`
      : `/api/books/${bookId}/worldview`;
    const items = await apiGet<WorldviewEntry[]>(path);
    return items ?? [];
  },
};
