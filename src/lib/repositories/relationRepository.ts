/**
 * 角色关系 Repository
 *
 * list 按 bookId 过滤；额外提供 listByCharacter 查询包含指定角色的全部关系。
 */
import { apiGet } from '../api';
import type { CharacterRelation } from '../../types';
import { createApiRepository, type Repository } from './baseRepository';

/** 角色关系 Repository 接口：扩展 listByCharacter 双向查询 */
export interface RelationRepository extends Repository<CharacterRelation> {
  /** 查询包含指定角色的全部关系（fromId 或 toId 命中） */
  listByCharacter(charId: string): Promise<CharacterRelation[]>;
}

export const relationRepository: RelationRepository = {
  ...createApiRepository<CharacterRelation>({
    entityPath: (id) => `/api/relations/${id}`,
    collectionPath: (bookId) => `/api/books/${bookId}/relations`,
  }),

  // 覆盖 list：默认按 bookId 列出
  async list(bookId: string): Promise<CharacterRelation[]> {
    const items = await apiGet<CharacterRelation[]>(`/api/books/${bookId}/relations`);
    return items ?? [];
  },

  async listByCharacter(charId: string): Promise<CharacterRelation[]> {
    // 后端按 fromId/toId 双向查询：GET /api/characters/:charId/relations
    const items = await apiGet<CharacterRelation[]>(
      `/api/characters/${charId}/relations`,
    );
    return items ?? [];
  },
};
