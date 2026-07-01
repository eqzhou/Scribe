import { Router } from 'express';
import type { Request, Response } from 'express';
import { streamChat, chat } from '../services/aiService.js';
import type { ModelConfig } from '../services/aiService.js';
import { getActiveModel } from '../services/modelStore.js';
import {
  buildContinueMessages,
  buildRewriteMessages,
  buildOutlineMessages,
  buildFulltextMessages,
  buildDialogueMessages,
  buildWorldviewMessages,
  type AIContext,
  type ChatMessage,
} from '../prompts/index.js';

export const router = Router();

/**
 * 解析后端激活的模型配置。
 * 不再接受前端传入 modelConfig，统一使用后端激活模型。
 * 未配置则抛错，由调用方 catch 后返回明确错误给用户。
 */
function resolveActiveModelConfig(): Partial<ModelConfig> {
  const active = getActiveModel();
  if (active && active.modelId && active.baseUrl) {
    return {
      model: active.modelId,
      apiKey: active.apiKey,
      baseUrl: active.baseUrl,
      temperature: active.temperature,
      maxTokens: active.maxTokens > 0 ? active.maxTokens : undefined,
    };
  }
  throw new Error('未配置激活的 AI 模型，请先在设置中添加并激活模型');
}

// 健康检查（无需 API Key，仅验证服务在线）
router.get('/health', (_req: Request, res: Response) => {
  const active = getActiveModel();
  let activeInfo: Record<string, unknown> | null = null;
  if (active) {
    activeInfo = {
      id: active.id,
      name: active.name,
      provider: active.provider,
      modelId: active.modelId,
      baseUrl: active.baseUrl,
      hasApiKey: Boolean(active.apiKey),
      capabilities: active.capabilities,
    };
  }
  res.json({
    status: 'ok',
    service: 'scribe-ai',
    timestamp: Date.now(),
    activeModel: activeInfo,
  });
});

// 设置 SSE 响应头
function setSSEHeaders(res: Response): void {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
}

// 立即刷新响应（兼容压缩中间件）
function flush(res: Response): void {
  const r = res as Response & { flush?: () => void };
  if (typeof r.flush === 'function') r.flush();
}

// 统一错误处理：未发送头时返回 JSON，已发送头时通过 SSE 错误事件返回
function handleStreamError(res: Response, err: unknown): void {
  const message = err instanceof Error ? err.message : '未知错误';
  const statusCode = (err as { statusCode?: number } | undefined)?.statusCode;
  const code = statusCode !== undefined ? String(statusCode) : undefined;
  if (res.headersSent) {
    res.write(`data: ${JSON.stringify({ error: message, code })}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
  } else {
    res.status(statusCode ?? 500).json({ error: message, code });
  }
}

// 将流式 generator 写入 SSE 响应
async function streamToResponse(
  res: Response,
  messages: ChatMessage[],
): Promise<void> {
  const modelConfig = resolveActiveModelConfig();
  let headersSent = false;
  for await (const chunk of streamChat(messages, undefined, modelConfig)) {
    if (!headersSent) {
      setSSEHeaders(res);
      headersSent = true;
    }
    res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
    flush(res);
  }
  if (!headersSent) setSSEHeaders(res);
  res.write('data: [DONE]\n\n');
  flush(res);
  res.end();
}

/**
 * 创建流式 AI 路由的工厂函数。
 *
 * 6 个 AI 端点结构完全一致：解析 body → 校验必填字段 → 构建 messages → 流式响应。
 * 通过工厂消除重复的 try/catch + handleStreamError 模板。
 */
function createStreamRoute<TBody>(
  buildMessages: (body: TBody) => ChatMessage[],
  requiredFields: string[],
): (req: Request, res: Response) => Promise<void> {
  return async (req: Request, res: Response) => {
    try {
      const body = req.body as TBody;
      // 校验必填字段
      for (const field of requiredFields) {
        if (!(body as Record<string, unknown>)[field]) {
          res
            .status(400)
            .json({ error: `缺少必填字段 ${field}`, code: '400' });
          return;
        }
      }
      const messages = buildMessages(body);
      await streamToResponse(res, messages);
    } catch (err) {
      handleStreamError(res, err);
    }
  };
}

// 续写
router.post('/continue', createStreamRoute<{
  beforeText: string;
  afterText: string;
  context: AIContext;
}>(
  (body) => buildContinueMessages(body.beforeText, body.afterText ?? '', body.context),
  ['beforeText', 'context'],
));

// 改写 / 润色 / 扩写
router.post('/rewrite', createStreamRoute<{
  text: string;
  action: 'rewrite' | 'polish' | 'expand';
  style?: '冷峻' | '华丽' | '白描' | '幽默';
  context: AIContext;
}>(
  (body) => buildRewriteMessages(body.text, body.action, body.style, body.context),
  ['text', 'action', 'context'],
));

// 全文生成
router.post('/fulltext', createStreamRoute<{
  chapterTitle: string;
  outline: string;
  context: AIContext;
}>(
  (body) => buildFulltextMessages(body.chapterTitle, body.outline ?? '', body.context),
  ['chapterTitle', 'context'],
));

// 角色对话生成
router.post('/dialogue', createStreamRoute<{
  character: { name: string; personality: string; background: string };
  scene: string;
  topic: string;
  otherCharacters: Array<{ name: string; personality: string }>;
}>(
  (body) => buildDialogueMessages(body.character, body.scene, body.topic, body.otherCharacters ?? []),
  ['character', 'scene', 'topic'],
));

// 世界观条目构建
router.post('/worldview', createStreamRoute<{
  category: string;
  topic: string;
  existing: Array<{ title: string; content: string }>;
}>(
  (body) => buildWorldviewMessages(body.category, body.topic, body.existing ?? []),
  ['category', 'topic'],
));

/**
 * 测试连通性（后端代理,规避浏览器 CORS 限制）。
 * 仅用于 AIModelManager 弹窗中测试尚未保存的模型配置。
 * 已保存模型的测试请用 POST /api/models/:id/test。
 */
router.post('/test', async (req: Request, res: Response) => {
  try {
    const { modelConfig } = req.body as { modelConfig?: Partial<ModelConfig> };
    if (!modelConfig?.model || !modelConfig?.baseUrl) {
      res.status(400).json({ ok: false, message: '缺少 model / baseUrl' });
      return;
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const r = await fetch(`${modelConfig.baseUrl.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(modelConfig.apiKey ? { Authorization: `Bearer ${modelConfig.apiKey}` } : {}),
        },
        body: JSON.stringify({
          model: modelConfig.model,
          messages: [{ role: 'user', content: 'ping' }],
          max_tokens: 5,
          stream: false,
        }),
        signal: controller.signal,
      });
      if (r.ok) {
        res.json({ ok: true, message: '连接成功' });
      } else {
        const text = await r.text().catch(() => '');
        res.json({ ok: false, message: `连接失败 (${r.status}): ${text.slice(0, 120)}` });
      }
    } finally {
      clearTimeout(timeout);
    }
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      res.json({ ok: false, message: '连接超时' });
      return;
    }
    const message = err instanceof Error ? err.message : '未知错误';
    res.json({ ok: false, message: `网络错误: ${message}` });
  }
});

// 生成章节大纲（结构化 JSON 输出，非流式 chat + 分段 SSE）
router.post('/outline', async (req: Request, res: Response) => {
  try {
    const { plotPoints, characters, worldview, chapterCount } = req.body as {
      plotPoints: Array<{ title: string; description: string }>;
      characters: AIContext['characters'];
      worldview: AIContext['worldview'];
      chapterCount: number;
    };
    if (!Array.isArray(plotPoints) || !chapterCount) {
      res
        .status(400)
        .json({ error: '缺少必填字段 plotPoints/chapterCount', code: '400' });
      return;
    }
    const modelConfig = resolveActiveModelConfig();
    const messages = buildOutlineMessages(
      plotPoints,
      characters ?? [],
      worldview ?? [],
      chapterCount
    );
    const full = await chat(messages, { temperature: 0.7 }, modelConfig);
    setSSEHeaders(res);
    const SEGMENT_SIZE = 512;
    for (let i = 0; i < full.length; i += SEGMENT_SIZE) {
      res.write(`data: ${JSON.stringify({ text: full.slice(i, i + SEGMENT_SIZE) })}\n\n`);
      flush(res);
    }
    res.write('data: [DONE]\n\n');
    flush(res);
    res.end();
  } catch (err) {
    handleStreamError(res, err);
  }
});
