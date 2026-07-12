/**
 * AI API 客户端
 *
 * 封装与后端 /api/ai/* 的通信，提供流式 SSE 与非流式两种调用方式。
 * 模型配置由后端管理（/api/models 激活的默认模型），
 * 前端不再上传 API Key，更安全。
 */
import type {
  ContinueRequest,
  RewriteRequest,
  OutlineRequest,
  FulltextRequest,
  DialogueRequest,
  WorldviewRequest,
  WorldviewBatchRequest,
  WorldviewBatchItem,
  ProjectBlueprintRequest,
  ProjectBlueprintResult,
  ChapterArchitectureRequest,
  ChapterArchitectureResult,
  CharacterGenerateRequest,
  CharacterGenerateResult,
  CharacterExtractRequest,
  CharacterExtractItem,
  OutlineItem,
  OnStreamChunk,
  OnStreamDone,
  OnStreamError,
} from '../types/ai';
import { z } from 'zod';
import { apiPath, isLoginPath, withAppBasePath } from './appBase';

/** 后端 AI 路由前缀 */
const AI_BASE = '/api/ai';

/**
 * 通用 SSE 流式请求。
 *
 * 发起 POST 请求，读取 ReadableStream，按 SSE 协议解析 data: 行。
 * 遇到 [DONE] 终止；遇到 {"error":...} 触发 onError。
 *
 * @param endpoint 路由路径，如 '/continue'
 * @param body 请求体
 * @param onChunk 每收到文本片段的回调
 * @param onDone 完成回调（参数为完整拼接文本）
 * @param onError 错误回调
 * @param signal 可选 AbortSignal，用于取消请求
 */
async function streamRequest(
  endpoint: string,
  body: unknown,
  onChunk: OnStreamChunk,
  onDone: OnStreamDone,
  onError: OnStreamError,
  signal?: AbortSignal,
): Promise<void> {
  try {
    const token = localStorage.getItem('scribe-token') ?? '';
    const res = await fetch(apiPath(`${AI_BASE}${endpoint}`), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
      signal,
    });

    if (res.status === 401) {
      localStorage.removeItem('scribe-token');
      if (!isLoginPath()) {
        window.location.href = withAppBasePath('/login');
      }
      throw new Error('登录已失效，请重新登录');
    }

    if (!res.ok) {
      const errText = await res.text().catch(() => res.statusText);
      throw new Error(`AI 请求失败 (${res.status}): ${errText}`);
    }

    if (!res.body) {
      throw new Error('响应体为空，无法流式读取');
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let full = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // 按 SSE 协议：事件以 \n\n 分隔，每行 data: xxx
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? ''; // 最后一行可能不完整，保留

        for (const border of lines) {
          const trimmed = border.trim();
          if (!trimmed || !trimmed.startsWith('data:')) continue;
          const data = trimmed.slice(5).trim();
          if (data === '[DONE]') {
            onDone(full);
            return;
          }
          try {
            const parsed = JSON.parse(data) as { text?: string; error?: string };
            if (parsed.error) {
              throw new Error(parsed.error);
            }
            if (parsed.text) {
              full += parsed.text;
              onChunk(parsed.text);
            }
          } catch (e) {
            // 非 JSON 的 data 行，跳过（可能是注释或心跳）
            if (e instanceof SyntaxError) continue;
            throw e;
          }
        }
      }

      // 流自然结束（未收到 [DONE]）
      onDone(full);
    } finally {
      // 确保异常或提前 return 时释放 reader 锁，避免 response.body 泄漏
      reader.releaseLock();
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') return;
    onError(err instanceof Error ? err : new Error(String(err)));
  }
}

/**
 * 创建一个标准流式请求函数。
 *
 * 6 个 AI 端点（续写/改写/全文/对话/世界观）签名完全一致，
 * 仅 endpoint 不同，通过工厂消除重复。
 */
function createStreamFn<TReq>(endpoint: string) {
  return (
    req: TReq,
    onChunk: OnStreamChunk,
    onDone: OnStreamDone,
    onError: OnStreamError,
    signal?: AbortSignal,
  ): Promise<void> => streamRequest(endpoint, req, onChunk, onDone, onError, signal);
}

/** 续写：在光标处或文末续写下文 */
export const streamContinue = createStreamFn<ContinueRequest>('/continue');

/** 改写/润色/扩写：对选中文本进行改写 */
export const streamRewrite = createStreamFn<RewriteRequest>('/rewrite');

/** 全文生成：根据大纲生成整章正文 */
export const streamFulltext = createStreamFn<FulltextRequest>('/fulltext');

/** 角色对话生成 */
export const streamDialogue = createStreamFn<DialogueRequest>('/dialogue');

/** 世界观条目构建 */
export const streamWorldview = createStreamFn<WorldviewRequest>('/worldview');

function findJsonEnd(text: string, start: number): number | null {
  const open = text[start];
  const close = open === '{' ? '}' : open === '[' ? ']' : '';
  if (!close) return null;

  const stack = [close];
  let inString = false;
  let escaped = false;

  for (let index = start + 1; index < text.length; index++) {
    const char = text[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
    } else if (char === '{') {
      stack.push('}');
    } else if (char === '[') {
      stack.push(']');
    } else if (char === stack.at(-1)) {
      stack.pop();
      if (stack.length === 0) return index;
    }
  }

  return null;
}

function extractJsonPayload(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }

  for (let index = 0; index < trimmed.length; index++) {
    if (trimmed[index] !== '{' && trimmed[index] !== '[') continue;
    const end = findJsonEnd(trimmed, index);
    if (end === null) continue;

    const candidate = trimmed.slice(index, end + 1).trim();
    try {
      JSON.parse(candidate);
      return candidate;
    } catch {
      // Keep scanning in case prose contains bracketed non-JSON before the payload.
    }
  }

  return trimmed;
}

function parseJsonOrFallback<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(extractJsonPayload(raw)) as T;
  } catch {
    return fallback;
  }
}

const titleSchema = z.string().trim().min(1).max(120);
const fileTitleIdentity = (value: string) => value.normalize('NFC').toLocaleLowerCase('en-US');
const fileTitleSchema = z.string().trim().min(1).max(100).refine((value) => {
  const hasControlCharacter = Array.from(value).some((character) => character.charCodeAt(0) < 32);
  const hasIllegalCharacter = /[\\/:*?"<>|]/.test(value);
  const hasTraversalSegment = /(?:^|[\\/])\.\.(?:[\\/]|$)/.test(value);
  return !hasControlCharacter
    && !hasIllegalCharacter
    && !hasTraversalSegment
    && !/^[\s.]+|[\s.]+$/.test(value)
    && new TextEncoder().encode(`${value}.md`).length <= 255;
}, '章节标题包含文件系统不支持的字符');
const textSchema = z.string().trim().min(1).max(5000);
const optionalReferenceSchema = z.string().trim().max(120).transform((value) => value || undefined).optional();
const tagsSchema = z.array(z.string().trim().min(1).max(50)).max(8);
const characterRoleSchema = z.enum(['protagonist', 'supporting', 'antagonist', 'minor']);
const worldviewCategorySchema = z.enum(['geography', 'history', 'faction', 'system', 'culture', 'item']);

const projectBlueprintSchema = z.object({
  worldview: z.array(z.object({
    category: worldviewCategorySchema,
    title: titleSchema,
    content: textSchema,
    tags: tagsSchema,
  })).min(1).max(12),
  characters: z.array(z.object({
    name: titleSchema,
    alias: z.string().trim().max(120).optional(),
    faction: z.string().trim().max(120).optional(),
    role: characterRoleSchema,
    appearance: textSchema,
    personality: textSchema,
    background: textSchema,
    arc: textSchema,
    tags: tagsSchema,
    relatedWorldviewTitles: z.array(titleSchema).max(8),
  })).min(1).max(12),
  scenes: z.array(z.object({
    name: titleSchema,
    description: textSchema,
    atmosphere: tagsSchema,
    characterNames: z.array(titleSchema).max(8),
    worldviewTitles: z.array(titleSchema).max(8),
    chapterTitles: z.array(titleSchema).max(8),
  })).min(1).max(16),
  plotLines: z.array(z.object({
    title: titleSchema,
    type: z.enum(['main', 'sub']),
    synopsis: textSchema,
    status: z.literal('planning'),
    order: z.number().int().min(0).max(1000),
  })).min(1).max(4),
  plotPoints: z.array(z.object({
    plotLineTitle: titleSchema,
    title: titleSchema,
    description: textSchema,
    chapterTitle: optionalReferenceSchema,
    characterNames: z.array(titleSchema).max(8),
    order: z.number().int().min(0).max(1000),
    timelineOrder: z.number().int().min(0).max(1000),
  })).min(1).max(24),
  inspirations: z.array(z.object({
    title: titleSchema,
    content: textSchema,
    tags: tagsSchema,
    category: z.string().trim().min(1).max(80),
  })).min(1).max(16),
  foreshadowing: z.array(z.object({
    title: titleSchema,
    description: textSchema,
    setupChapterTitle: optionalReferenceSchema,
    payoffChapterTitle: optionalReferenceSchema,
    status: z.literal('pending').optional(),
  })).min(1).max(12),
  chapters: z.array(z.object({
    title: fileTitleSchema,
    summary: textSchema,
    outline: textSchema,
    order: z.number().int().min(0).max(1000),
  })).min(1).max(32),
}).superRefine((blueprint, ctx) => {
  const chapterTitles = new Set(blueprint.chapters.map((chapter) => chapter.title));
  const plotLineTitles = new Set(blueprint.plotLines.map((line) => line.title));
  const characterNames = new Set(blueprint.characters.map((character) => character.name));
  const worldviewTitles = new Set(blueprint.worldview.map((entry) => entry.title));

  const ensureUnique = (
    values: string[],
    path: string,
    message: string,
  ) => {
    const seen = new Set<string>();
    values.forEach((value, index) => {
      if (seen.has(value)) ctx.addIssue({ code: 'custom', path: [path, index], message });
      seen.add(value);
    });
  };
  ensureUnique(blueprint.chapters.map((item) => item.title), 'chapters', '章节标题不能重复');
  ensureUnique(
    blueprint.chapters.map((item) => fileTitleIdentity(item.title)),
    'chapters',
    '章节标题在文件系统中不能重复',
  );
  ensureUnique(blueprint.characters.map((item) => item.name), 'characters', '角色名称不能重复');
  ensureUnique(blueprint.scenes.map((item) => item.name), 'scenes', '场景名称不能重复');
  ensureUnique(blueprint.plotLines.map((item) => item.title), 'plotLines', '剧情线标题不能重复');
  ensureUnique(blueprint.worldview.map((item) => item.title), 'worldview', '世界观标题不能重复');

  for (const [index, character] of blueprint.characters.entries()) {
    for (const title of character.relatedWorldviewTitles) {
      if (!worldviewTitles.has(title)) {
        ctx.addIssue({ code: 'custom', path: ['characters', index, 'relatedWorldviewTitles'], message: '角色引用了未知世界观' });
      }
    }
  }

  for (const [index, scene] of blueprint.scenes.entries()) {
    for (const name of scene.characterNames) {
      if (!characterNames.has(name)) {
        ctx.addIssue({ code: 'custom', path: ['scenes', index, 'characterNames'], message: '场景引用了未知角色' });
      }
    }
    for (const title of scene.worldviewTitles) {
      if (!worldviewTitles.has(title)) {
        ctx.addIssue({ code: 'custom', path: ['scenes', index, 'worldviewTitles'], message: '场景引用了未知世界观' });
      }
    }
    for (const chapterTitle of scene.chapterTitles) {
      if (!chapterTitles.has(chapterTitle)) {
        ctx.addIssue({ code: 'custom', path: ['scenes', index, 'chapterTitles'], message: '场景引用了未知章节' });
      }
    }
  }
  for (const [index, point] of blueprint.plotPoints.entries()) {
    if (!plotLineTitles.has(point.plotLineTitle)) {
      ctx.addIssue({ code: 'custom', path: ['plotPoints', index, 'plotLineTitle'], message: '剧情节点引用了未知剧情线' });
    }
    if (point.chapterTitle && !chapterTitles.has(point.chapterTitle)) {
      ctx.addIssue({ code: 'custom', path: ['plotPoints', index, 'chapterTitle'], message: '剧情节点引用了未知章节' });
    }
    for (const name of point.characterNames) {
      if (!characterNames.has(name)) {
        ctx.addIssue({ code: 'custom', path: ['plotPoints', index, 'characterNames'], message: '剧情节点引用了未知角色' });
      }
    }
  }
  for (const [index, foreshadowing] of blueprint.foreshadowing.entries()) {
    for (const field of ['setupChapterTitle', 'payoffChapterTitle'] as const) {
      const chapterTitle = foreshadowing[field];
      if (chapterTitle && !chapterTitles.has(chapterTitle)) {
        ctx.addIssue({ code: 'custom', path: ['foreshadowing', index, field], message: '伏笔引用了未知章节' });
      }
    }
  }
});

const chapterArchitectureSchema = z.object({
  chapterSummary: z.string().trim().min(1).max(4000),
  characters: z.array(z.object({
    name: titleSchema,
    role: characterRoleSchema,
    appearance: textSchema,
    personality: textSchema,
    background: textSchema,
  })).max(12),
  scenes: z.array(z.object({
    name: titleSchema,
    description: textSchema,
    atmosphere: tagsSchema,
    characterNames: z.array(titleSchema).max(8),
    worldviewTitles: z.array(titleSchema).max(8),
  })).max(12),
  plotPoints: z.array(z.object({
    plotLineTitle: optionalReferenceSchema,
    title: titleSchema,
    description: textSchema,
    characterNames: z.array(titleSchema).max(8),
    order: z.number().int().min(0).max(1000),
    timelineOrder: z.number().int().min(0).max(1000),
  })).max(12),
  worldview: z.array(z.object({
    category: worldviewCategorySchema,
    title: titleSchema,
    content: textSchema,
    tags: tagsSchema,
  })).max(12),
  inspirations: z.array(z.object({
    title: titleSchema,
    content: textSchema,
    tags: tagsSchema,
    category: z.string().trim().min(1).max(80),
  })).max(12),
  foreshadowing: z.array(z.object({
    title: titleSchema,
    description: textSchema,
    action: z.enum(['plant', 'payoff']),
  })).max(12),
});

export function parseProjectBlueprintResult(raw: string): ProjectBlueprintResult | null {
  const result = projectBlueprintSchema.safeParse(parseJsonOrFallback<unknown>(raw, null));
  return result.success ? result.data : null;
}

export function parseChapterArchitectureResult(raw: string): ChapterArchitectureResult | null {
  const result = chapterArchitectureSchema.safeParse(parseJsonOrFallback<unknown>(raw, null));
  return result.success ? result.data : null;
}

/**
 * 生成章节大纲。
 *
 * 后端返回 SSE，每个 chunk 是 JSON 数组片段，需拼接后 JSON.parse。
 * onChunk 收到原始片段字符串，onDone 收到完整 JSON 解析后的数组。
 */
export async function streamOutline(
  req: OutlineRequest,
  onChunk: OnStreamChunk,
  onDone: (items: OutlineItem[]) => void,
  onError: OnStreamError,
  signal?: AbortSignal,
): Promise<void> {
  let raw = '';
  await streamRequest(
    '/outline',
    req,
    (chunk) => {
      raw += chunk;
      onChunk(chunk);
    },
    () => {
      try {
        const items = JSON.parse(extractJsonPayload(raw)) as OutlineItem[];
        onDone(items);
      } catch {
        onDone([{ title: '生成结果', summary: raw, keyEvents: [] }]);
      }
    },
    onError,
    signal,
  );
}

/**
 * 批量世界观构建：基于书籍信息一次性生成 6 大分类的世界观条目。
 *
 * 后端返回 SSE，每个 chunk 是 JSON 文本片段，拼接后 JSON.parse 为 WorldviewBatchItem[]。
 */
export async function streamWorldviewBatch(
  req: WorldviewBatchRequest,
  onChunk: OnStreamChunk,
  onDone: (items: WorldviewBatchItem[]) => void,
  onError: OnStreamError,
  signal?: AbortSignal,
): Promise<void> {
  let raw = '';
  await streamRequest(
    '/worldview-batch',
    req,
    (chunk) => {
      raw += chunk;
      onChunk(chunk);
    },
    () => {
      onDone(parseJsonOrFallback<WorldviewBatchItem[]>(raw, []));
    },
    onError,
    signal,
  );
}

/** 项目蓝图生成：返回世界观、角色、场景、剧情、灵感与章节草案。 */
export async function streamProjectBlueprint(
  req: ProjectBlueprintRequest,
  onChunk: OnStreamChunk,
  onDone: (result: ProjectBlueprintResult | null) => void,
  onError: OnStreamError,
  signal?: AbortSignal,
): Promise<void> {
  let raw = '';
  await streamRequest(
    '/project-blueprint',
    req,
    (chunk) => {
      raw += chunk;
      onChunk(chunk);
    },
    () => {
      onDone(parseProjectBlueprintResult(raw));
    },
    onError,
    signal,
  );
}

/** 章节结构分析：从已生成正文中提取本章资料库副产物。 */
export async function streamChapterArchitecture(
  req: ChapterArchitectureRequest,
  onChunk: OnStreamChunk,
  onDone: (result: ChapterArchitectureResult | null) => void,
  onError: OnStreamError,
  signal?: AbortSignal,
): Promise<void> {
  let raw = '';
  await streamRequest(
    '/chapter-architecture',
    req,
    (chunk) => {
      raw += chunk;
      onChunk(chunk);
    },
    () => {
      onDone(parseChapterArchitectureResult(raw));
    },
    onError,
    signal,
  );
}

/**
 * 角色生成：基于用户 prompt 生成单个角色档案。
 *
 * 后端返回 SSE，拼接后 JSON.parse 为 CharacterGenerateResult。
 */
export async function streamCharacterGenerate(
  req: CharacterGenerateRequest,
  onChunk: OnStreamChunk,
  onDone: (result: CharacterGenerateResult | null) => void,
  onError: OnStreamError,
  signal?: AbortSignal,
): Promise<void> {
  let raw = '';
  await streamRequest(
    '/character-generate',
    req,
    (chunk) => {
      raw += chunk;
      onChunk(chunk);
    },
    () => {
      onDone(parseJsonOrFallback<CharacterGenerateResult | null>(raw, null));
    },
    onError,
    signal,
  );
}

/**
 * 角色提取：从章节正文提取未入库的角色。
 *
 * 后端返回 SSE，拼接后 JSON.parse 为 CharacterExtractItem[]。
 */
export async function streamCharacterExtract(
  req: CharacterExtractRequest,
  onChunk: OnStreamChunk,
  onDone: (items: CharacterExtractItem[]) => void,
  onError: OnStreamError,
  signal?: AbortSignal,
): Promise<void> {
  let raw = '';
  await streamRequest(
    '/character-extract',
    req,
    (chunk) => {
      raw += chunk;
      onChunk(chunk);
    },
    () => {
      onDone(parseJsonOrFallback<CharacterExtractItem[]>(raw, []));
    },
    onError,
    signal,
  );
}
