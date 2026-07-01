/**
 * Repository 层统一出口
 *
 * 集中导出全部 12 个实体 Repository 单例，便于上层按需引入。
 */
export { bookRepository, type BookRepository } from './bookRepository';
export { worldviewRepository, type WorldviewRepository } from './worldviewRepository';
export { characterRepository, type CharacterRepository } from './characterRepository';
export { relationRepository, type RelationRepository } from './relationRepository';
export { plotLineRepository, type PlotLineRepository } from './plotLineRepository';
export { plotPointRepository, type PlotPointRepository } from './plotPointRepository';
export { foreshadowingRepository, type ForeshadowingRepository } from './foreshadowingRepository';
export { sceneRepository, type SceneRepository } from './sceneRepository';
export { volumeRepository, type VolumeRepository } from './volumeRepository';
export { chapterRepository, type ChapterRepository } from './chapterRepository';
export { inspirationRepository, type InspirationRepository } from './inspirationRepository';
export { writingLogRepository, type WritingLogRepository } from './writingLogRepository';

// 通用接口与工厂函数，供自定义 Repository 复用
export { type Repository, createRepository } from './baseRepository';
