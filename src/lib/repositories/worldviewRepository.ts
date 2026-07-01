/**
 * 世界观条目 Repository
 *
 * list 按 bookId 过滤，支持按 category 二级过滤。
 */
import { db } from '../db';
import type { WorldviewEntry, WorldviewCategory } from '../../types';
import { createRepository, type Repository } from './baseRepository';

/** 世界观 Repository 接口：扩展 list 以支持 category 二级过滤 */
export interface WorldviewRepository extends Repository<WorldviewEntry> {
  list(bookId: string, category?: WorldviewCategory): Promise<WorldviewEntry[]>;
}

/** 按 bookId 列出世界观条目，可选按 category 过滤 */
async function listWorldview(
  bookId: string,
  category?: WorldviewCategory,
): Promise<WorldviewEntry[]> {
  let collection = db.worldview.where('bookId').equals(bookId);
  if (category) {
    // category 已建立索引，但与 bookId 联合过滤时使用 and 在内存中二次过滤
    collection = collection.and(item => item.category === category);
  }
  return collection.toArray();
}

export const worldviewRepository: WorldviewRepository = {
  ...createRepository<WorldviewEntry>(db.worldview, bookId => listWorldview(bookId)),
  async list(bookId: string, category?: WorldviewCategory): Promise<WorldviewEntry[]> {
    return listWorldview(bookId, category);
  },
};
