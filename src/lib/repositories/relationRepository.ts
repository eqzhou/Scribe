/**
 * 角色关系 Repository
 *
 * list 按 bookId 过滤；额外提供 listByCharacter 查询包含指定角色的全部关系。
 */
import { db } from '../db';
import type { CharacterRelation } from '../../types';
import { createRepository, type Repository } from './baseRepository';

/** 角色关系 Repository 接口：扩展 listByCharacter 双向查询 */
export interface RelationRepository extends Repository<CharacterRelation> {
  /** 查询包含指定角色的全部关系（fromId 或 toId 命中） */
  listByCharacter(charId: string): Promise<CharacterRelation[]>;
}

export const relationRepository: RelationRepository = {
  ...createRepository<CharacterRelation>(
    db.relations,
    async bookId => db.relations.where('bookId').equals(bookId).toArray(),
  ),

  async listByCharacter(charId: string): Promise<CharacterRelation[]> {
    // 双向查询：fromId 或 toId 命中 charId 的关系
    return db.relations
      .where('fromId')
      .equals(charId)
      .or('toId')
      .equals(charId)
      .toArray();
  },
};
