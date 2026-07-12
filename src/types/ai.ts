/**
 * AI 写作模块类型定义
 *
 * 覆盖：续写、改写、大纲生成、全文生成、角色对话、世界观构建。
 * 所有 AI 请求通过后端代理 /api/ai/* 转发，前端不直接持有 API Key。
 */

/** AI 任务类型 */
export type AITaskType =
  | 'continue'             // 续写
  | 'rewrite'              // 改写
  | 'polish'               // 润色
  | 'expand'               // 扩写
  | 'outline'              // 章节大纲
  | 'fulltext'             // 全文生成
  | 'dialogue'             // 角色对话
  | 'worldview'            // 世界观构建
  | 'worldview-batch'      // 批量世界观构建（作品创建时）
  | 'project-blueprint'    // 项目蓝图生成（作品创建时）
  | 'chapter-architecture' // 章节结构分析（正文生成后）
  | 'character-generate'   // 角色生成（基于 prompt）
  | 'character-extract';   // 角色提取（从章节正文）

/** 改写风格 */
export type RewriteStyle = '冷峻' | '华丽' | '白描' | '幽默' | '悲怆' | '热血';

/** AI 请求上下文：作品 + 角色 + 世界观摘要 */
export interface AIContext {
  bookTitle: string;
  synopsis: string;
  characters: Array<{ name: string; role: string; personality: string }>;
  worldview: Array<{ title: string; content: string }>;
}

/** 续写请求体 */
export interface ContinueRequest {
  bookId: string;
  chapterId: string;
  beforeText: string;
  afterText: string;
  context: AIContext;
}

/** 改写请求体 */
export interface RewriteRequest {
  text: string;
  action: 'rewrite' | 'polish' | 'expand';
  style?: RewriteStyle;
  context: AIContext;
}

/** 大纲生成请求体 */
export interface OutlineRequest {
  bookId: string;
  volumeTitle?: string;
  plotPoints: Array<{ title: string; description: string }>;
  characters: AIContext['characters'];
  worldview: AIContext['worldview'];
  chapterCount: number;
}

/** 全文生成请求体 */
export interface FulltextRequest {
  bookId: string;
  chapterTitle: string;
  outline: string;
  context: AIContext;
}

/** 角色对话请求体 */
export interface DialogueRequest {
  character: { name: string; personality: string; background: string };
  scene: string;
  topic: string;
  otherCharacters: Array<{ name: string; personality: string }>;
}

/** 世界观构建请求体 */
export interface WorldviewRequest {
  category: string;
  topic: string;
  existing: Array<{ title: string; content: string }>;
}

/** 批量世界观构建请求体（作品创建时一次性生成 6 大分类） */
export interface WorldviewBatchRequest {
  bookTitle: string;
  synopsis: string;
  genre: string;
}

/** 批量世界观条目（生成结果） */
export interface WorldviewBatchItem {
  category: string;
  title: string;
  content: string;
  tags: string[];
}

/** AI 生成的伏笔条目。章节分析通过 action 标识本章是埋设还是回收。 */
export interface AIForeshadowingItem {
  title: string;
  description: string;
  setupChapterTitle?: string;
  payoffChapterTitle?: string;
  status?: string;
  action?: 'plant' | 'payoff';
}

/** 项目蓝图生成请求体 */
export type ProjectStructureLevel = 'simple' | 'standard' | 'detailed';

export interface ProjectBlueprintRequest {
  bookTitle: string;
  subtitle?: string;
  synopsis: string;
  genre: string;
  targetWords: number;
  structureLevel?: ProjectStructureLevel;
}

/** 项目蓝图生成结果 */
export interface ProjectBlueprintResult {
  worldview: WorldviewBatchItem[];
  characters: Array<{
    name: string;
    alias?: string;
    faction?: string;
    role?: string;
    appearance?: string;
    personality?: string;
    background?: string;
    arc?: string;
    tags?: string[];
    relatedWorldviewTitles?: string[];
  }>;
  scenes: Array<{
    name: string;
    description: string;
    atmosphere?: string[];
    characterNames?: string[];
    worldviewTitles?: string[];
    chapterTitles?: string[];
  }>;
  plotLines: Array<{
    title: string;
    type?: string;
    synopsis?: string;
    status?: string;
    order?: number;
  }>;
  plotPoints: Array<{
    plotLineTitle?: string;
    title: string;
    description?: string;
    chapterTitle?: string;
    characterNames?: string[];
    order?: number;
    timelineOrder?: number;
  }>;
  inspirations: Array<{
    title: string;
    content: string;
    tags?: string[];
    category?: string;
  }>;
  foreshadowing: AIForeshadowingItem[];
  chapters: Array<{
    title: string;
    summary?: string;
    outline?: string;
    order?: number;
  }>;
}

/** 角色生成请求体（基于用户 prompt） */
export interface CharacterGenerateRequest {
  prompt: string;
  bookTitle: string;
  synopsis: string;
  genre: string;
  existingCharacters?: Array<{ name: string; role: string }>;
}

/** 角色生成结果（对齐 Character 表字段） */
export interface CharacterGenerateResult {
  name: string;
  alias: string;
  faction: string;
  role: string;
  appearance: string;
  personality: string;
  background: string;
  arc: string;
  tags: string[];
}

/** 角色提取请求体（从章节正文提取） */
export interface CharacterExtractRequest {
  chapterTitle: string;
  chapterContent: string;
  existingCharacters?: Array<{ name: string; alias?: string }>;
}

/** 角色提取结果 */
export interface CharacterExtractItem {
  name: string;
  role: string;
  appearance: string;
  personality: string;
  background: string;
}

/** 章节结构分析请求体 */
export interface ChapterArchitectureRequest {
  chapterTitle: string;
  chapterContent: string;
  context: AIContext;
  existingCharacters?: Array<{ name: string; alias?: string }>;
  existingScenes?: Array<{ name: string }>;
  existingWorldview?: Array<{ title: string }>;
  existingPlotLines?: Array<{ title: string }>;
  existingForeshadowing?: Array<{ title: string; status: string }>;
}

/** 章节结构分析结果 */
export interface ChapterArchitectureResult {
  chapterSummary?: string;
  characters: CharacterExtractItem[];
  scenes: Array<{
    name: string;
    description: string;
    atmosphere?: string[];
    characterNames?: string[];
    worldviewTitles?: string[];
  }>;
  plotPoints: Array<{
    plotLineTitle?: string;
    title: string;
    description?: string;
    characterNames?: string[];
    order?: number;
    timelineOrder?: number;
  }>;
  worldview: WorldviewBatchItem[];
  inspirations: Array<{
    title: string;
    content: string;
    tags?: string[];
    category?: string;
  }>;
  foreshadowing: AIForeshadowingItem[];
}

/** 章节大纲条目（大纲生成结果） */
export interface OutlineItem {
  title: string;
  summary: string;
  keyEvents: string[];
}

/** AI 历史记录条目 */
export interface AIHistoryItem {
  id: string;
  taskType: AITaskType;
  prompt: string;
  output: string;
  createdAt: number;
  bookId?: string;
  chapterId?: string;
}

/** AI 请求状态 */
export type AIStatus = 'idle' | 'loading' | 'streaming' | 'done' | 'error';

/** SSE 流式回调：每收到一个文本片段触发 */
export type OnStreamChunk = (text: string) => void;

/** 请求完成回调 */
export type OnStreamDone = (fullText: string) => void;

/** 错误回调 */
export type OnStreamError = (error: Error) => void;
