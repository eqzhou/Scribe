/**
 * 灵感卡片 Repository
 *
 * list 按 bookId 过滤，按 createdAt 倒序排列（最新创意在前）。
 */
import { apiGet } from '../api';
import type { Inspiration } from '../../types';
import { createApiRepository, type Repository } from './baseRepository';

export type InspirationRepository = Repository<Inspiration>;

/** 将 ISO 时间字符串转换为 Unix 毫秒；非字符串或非法值原样返回 */
function toMs(v: unknown): unknown {
  if (typeof v === 'string' && v.length > 0) {
    const ms = new Date(v).getTime();
    if (!Number.isNaN(ms)) return ms;
  }
  return v;
}

export const inspirationRepository: InspirationRepository = {
  ...createApiRepository<Inspiration>({
    entityPath: (id) => `/api/inspiration/${id}`,
    collectionPath: (bookId) => `/api/books/${bookId}/inspiration`,
  }),

  // 覆盖 list：按 createdAt 倒序排列（最新在前）
  async list(bookId: string): Promise<Inspiration[]> {
    const items = await apiGet<Inspiration[]>(`/api/books/${bookId}/inspiration`);
    const normalized = (items ?? []).map((i) => {
      const r = { ...i } as Record<string, unknown>;
      r.createdAt = toMs(r.createdAt);
      return r as unknown as Inspiration;
    });
    return normalized.sort((a, b) => Number(b.createdAt) - Number(a.createdAt));
  },
};
