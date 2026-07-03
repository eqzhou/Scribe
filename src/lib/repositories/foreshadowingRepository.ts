/**
 * 伏笔 Repository
 *
 * list 按 bookId 过滤，支持按 status（状态）二级过滤。
 */
import { apiGet } from '../api';
import type { Foreshadowing, ForeshadowStatus } from '../../types';
import { createApiRepository, type Repository } from './baseRepository';

/** 伏笔 Repository 接口：扩展 list 以支持 status 二级过滤 */
export interface ForeshadowingRepository extends Repository<Foreshadowing> {
  list(bookId: string, status?: ForeshadowStatus): Promise<Foreshadowing[]>;
}

export const foreshadowingRepository: ForeshadowingRepository = {
  ...createApiRepository<Foreshadowing>({
    entityPath: (id) => `/api/foreshadowing/${id}`,
    collectionPath: (bookId) => `/api/books/${bookId}/foreshadowing`,
  }),

  // 覆盖 list：支持按 status 二级过滤
  async list(bookId: string, status?: ForeshadowStatus): Promise<Foreshadowing[]> {
    const path = status
      ? `/api/books/${bookId}/foreshadowing?status=${encodeURIComponent(status)}`
      : `/api/books/${bookId}/foreshadowing`;
    const items = await apiGet<Foreshadowing[]>(path);
    return items ?? [];
  },
};
