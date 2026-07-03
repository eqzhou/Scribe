/**
 * 剧情线 Repository
 *
 * list 按 bookId 过滤，支持按 type（主线/支线）二级过滤。
 */
import { apiGet } from '../api';
import type { PlotLine, PlotLineType } from '../../types';
import { createApiRepository, type Repository } from './baseRepository';

/** 剧情线 Repository 接口：扩展 list 以支持 type 二级过滤 */
export interface PlotLineRepository extends Repository<PlotLine> {
  list(bookId: string, type?: PlotLineType): Promise<PlotLine[]>;
}

export const plotLineRepository: PlotLineRepository = {
  ...createApiRepository<PlotLine>({
    entityPath: (id) => `/api/plotLines/${id}`,
    collectionPath: (bookId) => `/api/books/${bookId}/plotLines`,
  }),

  // 覆盖 list：支持按 type 二级过滤
  async list(bookId: string, type?: PlotLineType): Promise<PlotLine[]> {
    const path = type
      ? `/api/books/${bookId}/plotLines?type=${encodeURIComponent(type)}`
      : `/api/books/${bookId}/plotLines`;
    const items = await apiGet<PlotLine[]>(path);
    return items ?? [];
  },
};
