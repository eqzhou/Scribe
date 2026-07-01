/**
 * 写作记录 Repository
 *
 * list 按 bookId 过滤；额外提供 listByDateRange 查询指定日期范围内的记录（用于热力图）。
 */
import { db } from '../db';
import type { WritingLog } from '../../types';
import { createRepository, type Repository } from './baseRepository';

/** 写作记录 Repository 接口：扩展 listByDateRange 范围查询 */
export interface WritingLogRepository extends Repository<WritingLog> {
  /** 查询指定作品在 [startDate, endDate] 日期范围内的写作记录 */
  listByDateRange(bookId: string, startDate: string, endDate: string): Promise<WritingLog[]>;
}

export const writingLogRepository: WritingLogRepository = {
  ...createRepository<WritingLog>(db.writingLogs, async bookId =>
    db.writingLogs.where('bookId').equals(bookId).toArray(),
  ),

  async listByDateRange(
    bookId: string,
    startDate: string,
    endDate: string,
  ): Promise<WritingLog[]> {
    // date 为 YYYY-MM-DD 字符串，按字典序比较等价于按日期比较
    return db.writingLogs
      .where('bookId')
      .equals(bookId)
      .and(item => item.date >= startDate && item.date <= endDate)
      .toArray();
  },
};
