/**
 * Scribe · Novel Crafting System - TypeScript 类型定义
 *
 * 依据《技术架构文档》第 4 章 API 定义（数据服务接口）实现。
 * 所有状态枚举使用 type 而非 enum 定义，便于树摇与类型推导。
 */

/* ========================================================================== */
/* 一、状态枚举类型                                                            */
/* ========================================================================== */

/** 章节状态：草稿 / 写作中 / 已完成 / 已归档 */
export type ChapterStatus = 'draft' | 'writing' | 'done' | 'archived';

/** 伏笔状态：待埋设 / 已埋设 / 已回收 / 已废弃 */
export type ForeshadowStatus = 'pending' | 'planted' | 'paidoff' | 'abandoned';

/** 剧情线状态：规划中 / 写作中 / 已完成 / 搁置 */
export type PlotLineStatus = 'planning' | 'writing' | 'done' | 'shelved';

/** 角色定位：主角 / 配角 / 反派 / 次要 */
export type CharacterRole = 'protagonist' | 'supporting' | 'antagonist' | 'minor';

/** 剧情线类型：主线 / 支线 */
export type PlotLineType = 'main' | 'sub';

/** 世界观条目分类：地理 / 历史 / 阵营 / 体系 / 文化 / 物品 */
export type WorldviewCategory =
  | 'geography'
  | 'history'
  | 'faction'
  | 'system'
  | 'culture'
  | 'item';

/** 角色关系类型：亲属 / 朋友 / 对手 / 恋人 / 师徒 / 上下级 / 其他 */
export type RelationType =
  | 'family'
  | 'friend'
  | 'rival'
  | 'lover'
  | 'mentor'
  | 'subordinate'
  | 'other';

/** 设定侧栏激活 Tab：角色 / 世界观 / 场景 / AI 助手 */
export type SettingSidebarTab = 'character' | 'worldview' | 'scene' | 'ai';

/** 主题模式：明亮 / 暗夜 */
export type ThemeMode = 'light' | 'dark';

/** 色彩主题：蓝调 / 朱砂红 / 墨绿 / 紫调 / 铜金 / 玫瑰 */
export type ColorTheme = 'blue' | 'vermilion' | 'moss' | 'purple' | 'gold' | 'rose';

/** 自动保存状态：空闲 / 保存中 / 已保存 / 失败 */
export type SaveStatus = 'idle' | 'saving' | 'saved' | 'failed';

/**
 * 大模型服务商
 *
 * 所有服务商均通过 OpenAI 兼容接口调用，仅提供默认 baseUrl 与展示信息。
 */
export type ModelProvider =
  | 'openai'
  | 'anthropic'
  | 'deepseek'
  | 'qwen'
  | 'doubao'
  | 'glm'
  | 'moonshot'
  | 'custom';

/** 模型类型：聊天补全 / 文本补全（主流均为 chat） */
export type ModelType = 'chat' | 'completion';

/** 模型能力标签（用于任务匹配与 UI 展示） */
export type ModelCapability =
  | 'continue'
  | 'rewrite'
  | 'polish'
  | 'expand'
  | 'outline'
  | 'fulltext'
  | 'dialogue'
  | 'worldview';

/* ========================================================================== */
/* 二、辅助类型（字段语义化别名）                                              */
/* ========================================================================== */

/** 作品 ID */
export type BookId = string;

/** 实体 ID 通用别名 */
export type EntityId = string;

/** 时间戳（Unix 毫秒） */
export type Timestamp = number;

/** 日期字符串，格式 YYYY-MM-DD */
export type DateString = string;

/** 富文本 HTML 内容 */
export type RichTextHTML = string;

/* ========================================================================== */
/* 三、实体接口（按技术架构文档第 4 章字段定义）                                */
/* ========================================================================== */

/** 作品：Scribe 中的最顶层实体，承载书籍元信息与创作目标 */
export interface Book {
  id: BookId;
  title: string;
  subtitle: string;
  synopsis: string;
  genre: string;          // 玄幻/都市/历史/科幻...
  targetWords: number;
  coverColor: string;     // 主题色
  dailyGoal: number;      // 每日字数目标，默认 3000
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/** 世界观条目：六大分类下的设定条目，可与角色、场景互引 */
export interface WorldviewEntry {
  id: EntityId;
  bookId: BookId;
  category: WorldviewCategory;
  title: string;
  content: RichTextHTML;        // 富文本 HTML
  tags: string[];
  relatedCharacterIds: string[];
  relatedSceneIds: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/** 角色：作品中的登场人物档案，含外貌、性格、背景与成长线 */
export interface Character {
  id: EntityId;
  bookId: BookId;
  name: string;
  alias: string;                // 别名/称号
  faction: string;              // 阵营
  role: CharacterRole;
  appearance: string;
  personality: string;
  background: string;
  arc: string;                  // 成长线
  birthday?: DateString;        // 生日 YYYY-MM-DD
  age?: number;                 // 年龄
  appearanceColor: string;      // 头像主题色（默认取自阵营色）
  tags: string[];
  relatedWorldviewIds?: string[]; // 关联的世界观条目 ID（与 WorldviewEntry.relatedCharacterIds 双向同步）
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/** 角色关系：描述两个角色之间的单向关系，支持双向查询 */
export interface CharacterRelation {
  id: EntityId;
  bookId: BookId;
  fromId: EntityId;
  toId: EntityId;
  type: RelationType;
  description: string;
}

/** 剧情线：作品的主线或支线，包含若干剧情节点 */
export interface PlotLine {
  id: EntityId;
  bookId: BookId;
  title: string;
  type: PlotLineType;           // 主线/支线
  synopsis: string;
  status: PlotLineStatus;
  order: number;
}

/**
 * 剧情节点：剧情线下的具体节点。
 * 注：order 用于剧情线内排序；timelineOrder 用于全局时间线排序，二者独立维护。
 */
export interface PlotPoint {
  id: EntityId;
  bookId: BookId;
  plotLineId: EntityId;
  title: string;
  description: string;
  chapterId?: EntityId;         // 所属章节
  characterIds: string[];
  order: number;
  timelineOrder: number;        // 时间线显式排序（独立于 order，用于时间线视图）
}

/** 伏笔：需埋设与回收的悬念追踪条目 */
export interface Foreshadowing {
  id: EntityId;
  bookId: BookId;
  title: string;
  description: string;
  setupChapterId?: EntityId;    // 埋设章节
  payoffChapterId?: EntityId;   // 回收章节
  status: ForeshadowStatus;
}

/** 场景：故事发生的空间设定，关联地理、世界观与登场角色 */
export interface Scene {
  id: EntityId;
  bookId: BookId;
  name: string;
  description: string;
  atmosphere: string[];         // 氛围标签
  geography?: string;           // 所属地理区域，关联世界观条目 ID
  worldviewEntryIds: string[];
  characterIds: string[];
  chapterIds: string[];
}

/** 卷宗：章节的分组容器，用于按卷组织章节树 */
export interface Volume {
  id: EntityId;
  bookId: BookId;
  title: string;
  order: number;
}

/** 章节：作品的正文单元，承载富文本内容与字数统计 */
export interface Chapter {
  id: EntityId;
  bookId: BookId;
  volumeId?: EntityId;
  title: string;
  content: RichTextHTML;        // 富文本 HTML
  summary: string;              // 章节大纲（旧字段，保留兼容）
  outline?: string;             // 章节大纲（新字段，多行文本）
  status: ChapterStatus;
  wordCount: number;
  order: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/** 灵感卡片：素材库中的碎片化创意记录 */
export interface Inspiration {
  id: EntityId;
  bookId: BookId;
  title: string;
  content: string;
  tags: string[];
  category: string;
  createdAt: Timestamp;
}

/** 写作记录：用于热力图与日字数统计的单日记录 */
export interface WritingLog {
  id: EntityId;
  bookId: BookId;
  date: DateString;             // YYYY-MM-DD
  wordCount: number;            // 当日/本次会话总字数
  duration: number;             // 写作时长（秒）
  createdAt: Timestamp;
}

/* ========================================================================== */
/* 九、AI 大模型管理                                                           */
/* ========================================================================== */

/**
 * AI 大模型配置
 *
 * 持久化在服务端（server/data/models.json），前端通过 /api/models 同步。
 * API Key 仅存于服务端，前端展示时掩码处理。
 * 所有服务商均通过 OpenAI 兼容接口调用。
 */
export interface AIModel {
  id: string;
  name: string;                 // 显示名，如 "GPT-4o"
  provider: ModelProvider;      // 服务商
  modelId: string;              // 模型 ID，如 "gpt-4o-mini"
  type: ModelType;              // 模型类型
  capabilities: ModelCapability[]; // 支持的能力
  apiKey: string;               // API Key
  baseUrl: string;              // API 基础地址（不含 /chat/completions）
  temperature: number;          // 默认温度 0.7
  maxTokens: number;            // 最大输出 token，0 表示不限制
  enabled: boolean;             // 是否启用
  isDefault: boolean;           // 是否为默认模型
  sortOrder: number;            // 排序
  createdAt: number;
  updatedAt: number;
}

/** 服务商元信息：默认 baseUrl、品牌色、中文名 */
export interface ProviderMeta {
  label: string;                // 中文名
  defaultBaseUrl: string;       // 默认 baseUrl
  color: string;                // 品牌色（用于 UI 点缀）
  officialModels: string[];     // 常用模型 ID 建议
}

/* ========================================================================== */
/* 十、用户账号与认证                                                           */
/* ========================================================================== */

/** 用户账号 */
export interface User {
  id: string;
  username: string;
  displayName: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/** 认证响应 */
export interface AuthResponse {
  token: string;
  user: User;
}
