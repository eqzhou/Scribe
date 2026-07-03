import type { ChatMessage } from '../prompts/index.js';

// 调用选项
interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
}

/**
 * 校验 baseUrl 安全性，防止 SSRF 攻击。
 *
 * 规则：
 * 1. 必须是 http/https 协议
 * 2. hostname 不能是 localhost 或私有/保留 IP 段
 *    - 127.0.0.0/8 (loopback)
 *    - 10.0.0.0/8 (RFC1918)
 *    - 172.16.0.0/12 (RFC1918)
 *    - 192.168.0.0/16 (RFC1918)
 *    - 169.254.0.0/16 (link-local，含云厂商元数据服务)
 *    - 0.0.0.0/8
 *    - ::1 / fc00::/7 / fe80::/10 (IPv6 对应段)
 *
 * 注意：不阻止域名解析到内网 IP 的攻击（DNS rebinding），
 * 但已覆盖最常见的 SSRF 向量。
 */
export function validateBaseUrl(baseUrl: string): { ok: boolean; message: string } {
  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    return { ok: false, message: 'baseUrl 不是合法的 URL' };
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { ok: false, message: `baseUrl 协议非法：${url.protocol}（仅允许 http/https）` };
  }
  const host = url.hostname.toLowerCase();
  // 拒绝 localhost
  if (host === 'localhost' || host === '::1') {
    return { ok: false, message: '禁止访问 localhost' };
  }
  // IPv4 私有/保留段检查
  const ipv4Match = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const [a, b] = ipv4Match.slice(1).map(Number);
    if (
      a === 0 ||                              // 0.0.0.0/8
      a === 10 ||                             // 10.0.0.0/8
      a === 127 ||                            // 127.0.0.0/8
      (a === 172 && b >= 16 && b <= 31) ||    // 172.16.0.0/12
      (a === 192 && b === 168) ||             // 192.168.0.0/16
      (a === 169 && b === 254)                // 169.254.0.0/16（含云元数据服务）
    ) {
      return { ok: false, message: `禁止访问私有/保留 IP：${host}` };
    }
  }
  // IPv6 私有段
  if (host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80')) {
    return { ok: false, message: `禁止访问私有 IPv6 段：${host}` };
  }
  return { ok: true, message: '' };
}

// 动态模型配置（由请求传入）
export interface ModelConfig {
  model: string;
  apiKey: string;
  baseUrl: string;
  temperature?: number;
  maxTokens?: number;
}

// OpenAI 兼容接口的请求体
interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  stream: boolean;
  temperature?: number;
  max_tokens?: number;
}

// 流式响应的单个 chunk
interface StreamChunk {
  choices?: Array<{
    delta?: { content?: string };
    finish_reason?: string | null;
  }>;
}

// 非流式响应结构
interface ChatCompletionResponse {
  choices?: Array<{ message?: { content?: string } }>;
}

/**
 * 解析最终使用的配置。没有有效配置时抛错。
 */
function resolveConfig(
  modelConfig?: Partial<ModelConfig>,
  options: ChatOptions = {}
): { apiKey: string; baseUrl: string; model: string; temperature?: number; maxTokens?: number } {
  const apiKey = modelConfig?.apiKey ?? '';
  const baseUrl = modelConfig?.baseUrl ?? '';
  const model = modelConfig?.model ?? '';
  if (!model || !baseUrl) {
    throw new Error('未配置激活的 AI 模型，请先在设置中添加并激活模型');
  }
  // SSRF 防护：校验 baseUrl 协议与目标地址
  const urlCheck = validateBaseUrl(baseUrl);
  if (!urlCheck.ok) {
    throw new Error(`baseUrl 校验失败：${urlCheck.message}`);
  }
  const temperature = options.temperature ?? modelConfig?.temperature;
  const maxTokens = options.maxTokens ?? modelConfig?.maxTokens;
  return { apiKey, baseUrl, model, temperature, maxTokens };
}

// 构造带状态码的错误
function createApiError(status: number, body: string): Error & { statusCode: number } {
  const err = new Error(`OpenAI API 错误 (${status}): ${body}`) as Error & {
    statusCode: number;
  };
  err.statusCode = status;
  return err;
}

/**
 * 流式对话：调用 OpenAI 兼容接口，逐个 yield 出 delta.content
 * @param messages 对话消息
 * @param options 调用选项（temperature、maxTokens 等）
 * @param modelConfig 动态模型配置
 */
export async function* streamChat(
  messages: ChatMessage[],
  options: ChatOptions = {},
  modelConfig?: Partial<ModelConfig>
): AsyncGenerator<string> {
  const { apiKey, baseUrl, model, temperature, maxTokens } = resolveConfig(modelConfig, options);
  const body: ChatCompletionRequest = {
    model,
    messages,
    stream: true,
    temperature,
    max_tokens: maxTokens,
  };

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw createApiError(response.status, text);
  }

  if (!response.body) {
    throw new Error('OpenAI API 未返回响应体');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      // 最后一行可能不完整，保留到下次拼接
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data:')) continue;
        const data = trimmed.slice(5).trim();
        if (data === '[DONE]') return;
        try {
          const parsed = JSON.parse(data) as StreamChunk;
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) yield delta;
        } catch {
          // 忽略无法解析的行
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * 非流式对话：用于结构化输出场景（如大纲生成）
 * @param messages 对话消息
 * @param options 调用选项
 * @param modelConfig 动态模型配置
 */
export async function chat(
  messages: ChatMessage[],
  options: ChatOptions = {},
  modelConfig?: Partial<ModelConfig>
): Promise<string> {
  const { apiKey, baseUrl, model, temperature, maxTokens } = resolveConfig(modelConfig, options);
  const body: ChatCompletionRequest = {
    model,
    messages,
    stream: false,
    temperature,
    max_tokens: maxTokens,
  };

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw createApiError(response.status, text);
  }

  const data = (await response.json()) as ChatCompletionResponse;
  return data.choices?.[0]?.message?.content ?? '';
}
