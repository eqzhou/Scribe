/**
 * 章节 Repository
 *
 * list 按 bookId 过滤，按 order 升序排序；额外提供 listByVolume 查询指定卷宗下的章节。
 */
import { db } from '../db';
import type { Chapter } from '../../types';
import { createRepository, type Repository } from './baseRepository';

/** 章节 Repository 接口：扩展 listByVolume 分组查询 */
export interface ChapterRepository extends Repository<Chapter> {
  /** 查询指定卷宗下的全部章节（按 order 升序） */
  listByVolume(volumeId: string): Promise<Chapter[]>;
}

export const chapterRepository: ChapterRepository = {
  ...createRepository<Chapter>(db.chapters, async bookId => {
    // 按 order 升序返回章节列表
    return db.chapters.where('bookId').equals(bookId).sortBy('order');
  }),

  async listByVolume(volumeId: string): Promise<Chapter[]> {
    // volumeId 已建立索引，按 order 升序返回章节
    return db.chapters.where('volumeId').equals(volumeId).sortBy('order');
  },
};
