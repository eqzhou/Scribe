/**
 * 剧情线 Repository
 *
 * list 按 bookId 过滤，支持按 type（主线/支线）二级过滤。
 */
import { db } from '../db';
import type { PlotLine, PlotLineType } from '../../types';
import { createRepository, type Repository } from './baseRepository';

/** 剧情线 Repository 接口：扩展 list 以支持 type 二级过滤 */
export interface PlotLineRepository extends Repository<PlotLine> {
  list(bookId: string, type?: PlotLineType): Promise<PlotLine[]>;
}

/** 按 bookId 列出剧情线，可选按类型过滤 */
async function listPlotLines(
  bookId: string,
  type?: PlotLineType,
): Promise<PlotLine[]> {
  let collection = db.plotLines.where('bookId').equals(bookId);
  if (type) {
    collection = collection.and(item => item.type === type);
  }
  return collection.toArray();
}

export const plotLineRepository: PlotLineRepository = {
  ...createRepository<PlotLine>(db.plotLines, bookId => listPlotLines(bookId)),
  async list(bookId: string, type?: PlotLineType): Promise<PlotLine[]> {
    return listPlotLines(bookId, type);
  },
};
