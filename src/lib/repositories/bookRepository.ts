/**
 * 作品 Repository
 *
 * 特殊：Book 为最顶层实体，无 bookId 字段，list 返回全部作品。
 */
import { db } from '../db';
import type { Book } from '../../types';
import { createRepository, type Repository } from './baseRepository';

export type BookRepository = Repository<Book>;

/**
 * 作品 Repository 单例。
 * list 忽略 bookId 参数，返回数据库中的全部作品。
 */
export const bookRepository: BookRepository = createRepository<Book>(
  db.books,
  async () => {
    // 返回全部作品，按 updatedAt 倒序排列（最近更新的在前）
    return db.books.orderBy('updatedAt').reverse().toArray();
  },
);
