/**
 * 卷宗 Repository
 *
 * list 按 bookId 过滤，按 order 升序排序。
 */
import { apiGet } from '../api';
import type { Volume } from '../../types';
import { createApiRepository, type Repository } from './baseRepository';

export type VolumeRepository = Repository<Volume>;

/** 按 order 升序排序 */
function sortByOrder(items: Volume[]): Volume[] {
  return [...items].sort((a, b) => a.order - b.order);
}

export const volumeRepository: VolumeRepository = {
  ...createApiRepository<Volume>({
    entityPath: (id) => `/api/volumes/${id}`,
    collectionPath: (bookId) => `/api/books/${bookId}/volumes`,
  }),

  // 覆盖 list：按 order 升序
  async list(bookId: string): Promise<Volume[]> {
    const items = await apiGet<Volume[]>(`/api/books/${bookId}/volumes`);
    return sortByOrder(items ?? []);
  },
};
