/**
 * AI 写作模块类型定义
 *
 * 覆盖：续写、改写、大纲生成、全文生成、角色对话、世界观构建。
 * 所有 AI 请求通过后端代理 /api/ai/* 转发，前端不直接持有 API Key。
 */

/** AI 任务类型 */
export type AITaskType =
  | 'continue'    // 续写
  | 'rewrite'     // 改写
  | 'polish'      // 润色
  | 'expand'      // 扩写
  | 'outline'     // 章节大纲
  | 'fulltext'    // 全文生成
  | 'dialogue'    // 角色对话
  | 'worldview';  // 世界观构建

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
