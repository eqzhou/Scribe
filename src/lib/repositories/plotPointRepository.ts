/**
 * 剧情节点 Repository
 *
 * list 按 bookId 过滤；额外提供 listByPlotLine 查询指定剧情线下的全部节点。
 */
import { db } from '../db';
import type { PlotPoint } from '../../types';
import { createRepository, type Repository } from './baseRepository';

/** 剧情节点 Repository 接口：扩展 listByPlotLine 关联查询 */
export interface PlotPointRepository extends Repository<PlotPoint> {
  /** 查询指定剧情线下的全部节点（按 order 升序） */
  listByPlotLine(plotLineId: string): Promise<PlotPoint[]>;
}

export const plotPointRepository: PlotPointRepository = {
  ...createRepository<PlotPoint>(
    db.plotPoints,
    async bookId => db.plotPoints.where('bookId').equals(bookId).toArray(),
  ),

  async listByPlotLine(plotLineId: string): Promise<PlotPoint[]> {
    // plotLineId 已建立索引，按 order 升序返回节点
    return db.plotPoints
      .where('plotLineId')
      .equals(plotLineId)
      .sortBy('order');
  },
};
