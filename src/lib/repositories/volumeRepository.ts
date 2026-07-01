/**
 * 卷宗 Repository
 *
 * list 按 bookId 过滤，按 order 升序排序。
 */
import { db } from '../db';
import type { Volume } from '../../types';
import { createRepository, type Repository } from './baseRepository';

export type VolumeRepository = Repository<Volume>;

export const volumeRepository: VolumeRepository = createRepository<Volume>(
  db.volumes,
  async bookId => {
    // 按 order 升序返回卷宗列表
    return db.volumes.where('bookId').equals(bookId).sortBy('order');
  },
);
