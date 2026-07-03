/**
 * 章节 Repository
 *
 * list 按 bookId 过滤，按 order 升序排序；额外提供 listByVolume 查询指定卷宗下的章节。
 */
import { apiGet } from '../api';
import type { Chapter } from '../../types';
import { createApiRepository, type Repository } from './baseRepository';

/** 章节 Repository 接口：扩展 listByVolume 分组查询 */
export interface ChapterRepository extends Repository<Chapter> {
  /** 查询指定卷宗下的全部章节（按 order 升序） */
  listByVolume(volumeId: string): Promise<Chapter[]>;
}

/** 按 order 升序排序 */
function sortByOrder(items: Chapter[]): Chapter[] {
  return [...items].sort((a, b) => a.order - b.order);
}

export const chapterRepository: ChapterRepository = {
  ...createApiRepository<Chapter>({
    entityPath: (id) => `/api/chapters/${id}`,
    collectionPath: (bookId) => `/api/books/${bookId}/chapters`,
  }),

  // 覆盖 list：按 order 升序
  async list(bookId: string): Promise<Chapter[]> {
    const items = await apiGet<Chapter[]>(`/api/books/${bookId}/chapters`);
    return sortByOrder(items ?? []);
  },

  async listByVolume(volumeId: string): Promise<Chapter[]> {
    // 后端按 volumeId 过滤：GET /api/volumes/:volumeId/chapters
    const items = await apiGet<Chapter[]>(`/api/volumes/${volumeId}/chapters`);
    return sortByOrder(items ?? []);
  },
};
