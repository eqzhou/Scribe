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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isRecordArray(value: unknown): boolean {
  return Array.isArray(value) && value.every(isRecord);
}

/**
 * 仅接受具备约定数组字段的 JSON 对象，避免模型返回任意合法 JSON 后被误入库。
 */
function parseStructuredJson<T>(
  raw: string,
  requiredArrayFields: readonly string[],
): T | null {
  const parsed = parseJsonOrFallback<unknown>(raw, null);
  if (!isRecord(parsed)) return null;
  if (!requiredArrayFields.every((field) => isRecordArray(parsed[field]))) return null;
  return parsed as T;
}

export function parseProjectBlueprintResult(raw: string): ProjectBlueprintResult | null {
  return parseStructuredJson<ProjectBlueprintResult>(raw, [
    'worldview',
    'characters',
    'scenes',
    'plotLines',
    'plotPoints',
    'inspirations',
    'foreshadowing',
    'chapters',
  ]);
}

export function parseChapterArchitectureResult(raw: string): ChapterArchitectureResult | null {
  return parseStructuredJson<ChapterArchitectureResult>(raw, [
    'characters',
    'scenes',
    'plotPoints',
    'worldview',
    'inspirations',
    'foreshadowing',
  ]);
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
