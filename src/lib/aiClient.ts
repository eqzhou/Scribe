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
  OutlineItem,
  OnStreamChunk,
  OnStreamDone,
  OnStreamError,
} from '../types/ai';

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
    const res = await fetch(`${AI_BASE}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });

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
        const items = JSON.parse(raw) as OutlineItem[];
        onDone(items);
      } catch {
        onDone([{ title: '生成结果', summary: raw, keyEvents: [] }]);
      }
    },
    onError,
    signal,
  );
}
