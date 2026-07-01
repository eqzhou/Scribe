/**
 * 伏笔 Repository
 *
 * list 按 bookId 过滤，支持按 status（状态）二级过滤。
 */
import { db } from '../db';
import type { Foreshadowing, ForeshadowStatus } from '../../types';
import { createRepository, type Repository } from './baseRepository';

/** 伏笔 Repository 接口：扩展 list 以支持 status 二级过滤 */
export interface ForeshadowingRepository extends Repository<Foreshadowing> {
  list(bookId: string, status?: ForeshadowStatus): Promise<Foreshadowing[]>;
}

/** 按 bookId 列出伏笔，可选按状态过滤 */
async function listForeshadowing(
  bookId: string,
  status?: ForeshadowStatus,
): Promise<Foreshadowing[]> {
  let collection = db.foreshadowing.where('bookId').equals(bookId);
  if (status) {
    collection = collection.and(item => item.status === status);
  }
  return collection.toArray();
}

export const foreshadowingRepository: ForeshadowingRepository = {
  ...createRepository<Foreshadowing>(db.foreshadowing, bookId =>
    listForeshadowing(bookId),
  ),
  async list(bookId: string, status?: ForeshadowStatus): Promise<Foreshadowing[]> {
    return listForeshadowing(bookId, status);
  },
};
