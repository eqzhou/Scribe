/**
 * 角色 Repository
 *
 * list 按 bookId 过滤，支持按 faction（阵营）二级过滤。
 */
import { db } from '../db';
import type { Character } from '../../types';
import { createRepository, type Repository } from './baseRepository';

/** 角色 Repository 接口：扩展 list 以支持 faction 二级过滤 */
export interface CharacterRepository extends Repository<Character> {
  list(bookId: string, faction?: string): Promise<Character[]>;
}

/** 按 bookId 列出角色，可选按阵营过滤 */
async function listCharacters(
  bookId: string,
  faction?: string,
): Promise<Character[]> {
  let collection = db.characters.where('bookId').equals(bookId);
  if (faction) {
    collection = collection.and(item => item.faction === faction);
  }
  return collection.toArray();
}

export const characterRepository: CharacterRepository = {
  ...createRepository<Character>(db.characters, bookId => listCharacters(bookId)),
  async list(bookId: string, faction?: string): Promise<Character[]> {
    return listCharacters(bookId, faction);
  },
};
