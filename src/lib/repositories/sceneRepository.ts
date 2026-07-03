/**
 * 场景 Repository
 *
 * list 按 bookId 过滤。
 */
import { apiGet } from '../api';
import type { Scene } from '../../types';
import { createApiRepository, type Repository } from './baseRepository';

export type SceneRepository = Repository<Scene>;

export const sceneRepository: SceneRepository = {
  ...createApiRepository<Scene>({
    entityPath: (id) => `/api/scenes/${id}`,
    collectionPath: (bookId) => `/api/books/${bookId}/scenes`,
  }),

  // 覆盖 list：默认按 bookId 列出
  async list(bookId: string): Promise<Scene[]> {
    const items = await apiGet<Scene[]>(`/api/books/${bookId}/scenes`);
    return items ?? [];
  },
};
