/**
 * 角色 Repository
 *
 * list 按 bookId 过滤，支持按 faction（阵营）二级过滤。
 */
import { apiGet } from '../api';
import type { Character } from '../../types';
import { createApiRepository, type Repository } from './baseRepository';

/** 角色 Repository 接口：扩展 list 以支持 faction 二级过滤 */
export interface CharacterRepository extends Repository<Character> {
  list(bookId: string, faction?: string): Promise<Character[]>;
}

export const characterRepository: CharacterRepository = {
  ...createApiRepository<Character>({
    entityPath: (id) => `/api/characters/${id}`,
    collectionPath: (bookId) => `/api/books/${bookId}/characters`,
  }),

  // 覆盖 list：支持按 faction 二级过滤
  async list(bookId: string, faction?: string): Promise<Character[]> {
    const path = faction
      ? `/api/books/${bookId}/characters?faction=${encodeURIComponent(faction)}`
      : `/api/books/${bookId}/characters`;
    const items = await apiGet<Character[]>(path);
    return items ?? [];
  },
};
