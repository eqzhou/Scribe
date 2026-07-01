/**
 * 场景 Repository
 *
 * list 按 bookId 过滤。
 */
import { db } from '../db';
import type { Scene } from '../../types';
import { createRepository, type Repository } from './baseRepository';

export type SceneRepository = Repository<Scene>;

export const sceneRepository: SceneRepository = createRepository<Scene>(
  db.scenes,
  async bookId => db.scenes.where('bookId').equals(bookId).toArray(),
);
