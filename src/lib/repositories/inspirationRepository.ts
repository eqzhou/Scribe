/**
 * 灵感卡片 Repository
 *
 * list 按 bookId 过滤，按 createdAt 倒序排列（最新创意在前）。
 */
import { db } from '../db';
import type { Inspiration } from '../../types';
import { createRepository, type Repository } from './baseRepository';

export type InspirationRepository = Repository<Inspiration>;

export const inspirationRepository: InspirationRepository = createRepository<Inspiration>(
  db.inspiration,
  async bookId => {
    // createdAt 升序排序后反转，得到倒序（最新在前）
    const items = await db.inspiration
      .where('bookId')
      .equals(bookId)
      .sortBy('createdAt');
    return items.reverse();
  },
);
