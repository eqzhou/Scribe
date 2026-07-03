/**
 * 剧情节点 Repository
 *
 * list 按 bookId 过滤；额外提供 listByPlotLine 查询指定剧情线下的全部节点。
 */
import { apiGet } from '../api';
import type { PlotPoint } from '../../types';
import { createApiRepository, type Repository } from './baseRepository';

/** 剧情节点 Repository 接口：扩展 listByPlotLine 关联查询 */
export interface PlotPointRepository extends Repository<PlotPoint> {
  /** 查询指定剧情线下的全部节点（按 order 升序） */
  listByPlotLine(plotLineId: string): Promise<PlotPoint[]>;
}

/** 按 order 升序排序 */
function sortByOrder(items: PlotPoint[]): PlotPoint[] {
  return [...items].sort((a, b) => a.order - b.order);
}

export const plotPointRepository: PlotPointRepository = {
  ...createApiRepository<PlotPoint>({
    entityPath: (id) => `/api/plot-points/${id}`,
    collectionPath: (bookId) => `/api/books/${bookId}/plot-points`,
  }),

  // 覆盖 list：默认按 bookId 列出
  async list(bookId: string): Promise<PlotPoint[]> {
    const items = await apiGet<PlotPoint[]>(`/api/books/${bookId}/plot-points`);
    return items ?? [];
  },

  async listByPlotLine(plotLineId: string): Promise<PlotPoint[]> {
    const items = await apiGet<PlotPoint[]>(`/api/plot-lines/${plotLineId}/plot-points`);
    return sortByOrder(items ?? []);
  },
};
