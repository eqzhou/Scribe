/**
 * 写作记录 Repository
 *
 * list 按 bookId 过滤；额外提供 listByDateRange 查询指定日期范围内的记录（用于热力图）。
 */
import { apiGet } from '../api';
import type { WritingLog } from '../../types';
import { createApiRepository, type Repository } from './baseRepository';

/** 写作记录 Repository 接口：扩展 listByDateRange 范围查询 */
export interface WritingLogRepository extends Repository<WritingLog> {
  /** 查询指定作品在 [startDate, endDate] 日期范围内的写作记录 */
  listByDateRange(bookId: string, startDate: string, endDate: string): Promise<WritingLog[]>;
}

/** 将 ISO 时间字符串转换为 Unix 毫秒；非字符串或非法值原样返回 */
function toMs(v: unknown): unknown {
  if (typeof v === 'string' && v.length > 0) {
    const ms = new Date(v).getTime();
    if (!Number.isNaN(ms)) return ms;
  }
  return v;
}

export const writingLogRepository: WritingLogRepository = {
  ...createApiRepository<WritingLog>({
    entityPath: (id) => `/api/writing-logs/${id}`,
    collectionPath: (bookId) => `/api/books/${bookId}/writing-logs`,
  }),

  // 覆盖 list：默认按 bookId 列出
  async list(bookId: string): Promise<WritingLog[]> {
    const items = await apiGet<WritingLog[]>(`/api/books/${bookId}/writing-logs`);
    return (items ?? []).map((w) => {
      const r = { ...w } as Record<string, unknown>;
      r.createdAt = toMs(r.createdAt);
      return r as unknown as WritingLog;
    });
  },

  async listByDateRange(
    bookId: string,
    startDate: string,
    endDate: string,
  ): Promise<WritingLog[]> {
    // date 为 YYYY-MM-DD 字符串，按字典序比较等价于按日期比较
    const path = `/api/books/${bookId}/writing-logs?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`;
    const items = await apiGet<WritingLog[]>(path);
    return (items ?? []).map((w) => {
      const r = { ...w } as Record<string, unknown>;
      r.createdAt = toMs(r.createdAt);
      return r as unknown as WritingLog;
    });
  },
};
