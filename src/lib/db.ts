/**
 * Scribe · Novel Crafting System - Dexie 数据库定义
 *
 * 依据《技术架构文档》第 6.2 节 Dexie Schema 实现。
 * v1 schema 已包含全部字段索引；非查询字段（如 Character.birthday/age、
 * PlotPoint.timelineOrder、Scene.geography、Book.dailyGoal、WritingLog.duration）
 * 不建立索引，以减少索引开销。
 */
import Dexie, { type Table } from 'dexie';
import type {
  Book,
  WorldviewEntry,
  Character,
  CharacterRelation,
  PlotLine,
  PlotPoint,
  Foreshadowing,
  Scene,
  Volume,
  Chapter,
  Inspiration,
  WritingLog,
} from '../types';

/**
 * Scribe 数据库实例。
 * 继承 Dexie，声明 12 张表的强类型 Table 句柄。
 */
class ScribeDB extends Dexie {
  // 作品：最顶层实体，承载书籍元信息
  books!: Table<Book, string>;
  // 世界观条目：六大分类下的设定条目
  worldview!: Table<WorldviewEntry, string>;
  // 角色：作品中的登场人物档案
  characters!: Table<Character, string>;
  // 角色关系：描述两个角色之间的单向关系
  relations!: Table<CharacterRelation, string>;
  // 剧情线：作品的主线或支线
  plotLines!: Table<PlotLine, string>;
  // 剧情节点：剧情线下的具体节点
  plotPoints!: Table<PlotPoint, string>;
  // 伏笔：需埋设与回收的悬念追踪条目
  foreshadowing!: Table<Foreshadowing, string>;
  // 场景：故事发生的空间设定
  scenes!: Table<Scene, string>;
  // 卷宗：章节的分组容器
  volumes!: Table<Volume, string>;
  // 章节：作品的正文单元
  chapters!: Table<Chapter, string>;
  // 灵感卡片：素材库中的碎片化创意记录
  inspiration!: Table<Inspiration, string>;
  // 写作记录：用于热力图与日字数统计
  writingLogs!: Table<WritingLog, string>;

  constructor() {
    super('scribe');
    // v1 schema：声明各表的索引字段（主键 + 用于查询的二级索引）
    this.version(1).stores({
      books: 'id, title, updatedAt',
      worldview: 'id, bookId, category, updatedAt',
      characters: 'id, bookId, name, faction, updatedAt',
      relations: 'id, bookId, fromId, toId',
      plotLines: 'id, bookId, type, order',
      plotPoints: 'id, bookId, plotLineId, chapterId, order',
      foreshadowing: 'id, bookId, status, setupChapterId, payoffChapterId',
      scenes: 'id, bookId, name',
      volumes: 'id, bookId, order',
      chapters: 'id, bookId, volumeId, order, updatedAt',
      inspiration: 'id, bookId, category, createdAt',
      writingLogs: 'id, bookId, date',
    });
  }
}

/** 全局数据库单例 */
export const db = new ScribeDB();

export default db;
