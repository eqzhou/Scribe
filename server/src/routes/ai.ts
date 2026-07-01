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
 * 解析最终模型配置。
 * 优先级：前端传入 modelConfig > 后端激活模型。
 * 都没有则抛错，由调用方 catch 后返回明确错误给用户。
 */
function resolveModelConfig(reqModelConfig?: Partial<ModelConfig>): {
  modelConfig: Partial<ModelConfig>;
  source: 'request' | 'server';
} {
  // 1. 前端明确传了有效配置（至少有 model 和 baseUrl），直接用
  if (reqModelConfig?.model && reqModelConfig?.baseUrl) {
    return { modelConfig: reqModelConfig, source: 'request' };
  }
  // 2. 后端有激活的模型
  const active = getActiveModel();
  if (active && active.modelId && active.baseUrl) {
    return {
      modelConfig: {
        model: active.modelId,
        apiKey: active.apiKey,
        baseUrl: active.baseUrl,
        temperature: active.temperature,
        maxTokens: active.maxTokens > 0 ? active.maxTokens : undefined,
      },
      source: 'server',
    };
  }
  // 3. 没有任何配置，抛明确错误
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

// 测试连通性（后端代理,规避浏览器 CORS 限制）
// 前端直连 Anthropic / 国内厂商会被 CORS 拦截,统一走后端转发
router.post('/test', async (req: Request, res: Response) => {
  try {
    const { modelConfig } = req.body as { modelConfig?: Partial<ModelConfig> };
    if (!modelConfig?.model || !modelConfig?.baseUrl) {
      res.status(400).json({ ok: false, message: '缺少 model / baseUrl' });
      return;
    }
    const { apiKey, baseUrl, model } = resolveConfigForTest(modelConfig);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const r = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify({
          model,
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
    const message = err instanceof Error ? err.message : '未知错误';
    res.json({ ok: false, message: `网络错误: ${message}` });
  }
});

// 测试专用配置解析（直接用前端传入的配置，无环境变量兜底）
function resolveConfigForTest(modelConfig: Partial<ModelConfig>): {
  apiKey: string;
  baseUrl: string;
  model: string;
} {
  return {
    apiKey: modelConfig.apiKey ?? '',
    baseUrl: modelConfig.baseUrl ?? '',
    model: modelConfig.model ?? '',
  };
}

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
  modelConfig?: Partial<ModelConfig>,
): Promise<void> {
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

// 续写
router.post('/continue', async (req: Request, res: Response) => {
  try {
    const { beforeText, afterText, context, modelConfig } = req.body as {
      beforeText: string;
      afterText: string;
      context: AIContext;
      modelConfig?: Partial<ModelConfig>;
    };
    if (!beforeText || !context) {
      res
        .status(400)
        .json({ error: '缺少必填字段 beforeText/context', code: '400' });
      return;
    }
    const { modelConfig: resolved } = resolveModelConfig(modelConfig);
    const messages = buildContinueMessages(beforeText, afterText ?? '', context);
    await streamToResponse(res, messages, resolved);
  } catch (err) {
    handleStreamError(res, err);
  }
});

// 改写 / 润色 / 扩写
router.post('/rewrite', async (req: Request, res: Response) => {
  try {
    const { text, action, style, context, modelConfig } = req.body as {
      text: string;
      action: 'rewrite' | 'polish' | 'expand';
      style?: '冷峻' | '华丽' | '白描' | '幽默';
      context: AIContext;
      modelConfig?: Partial<ModelConfig>;
    };
    if (!text || !action || !context) {
      res
        .status(400)
        .json({ error: '缺少必填字段 text/action/context', code: '400' });
      return;
    }
    const { modelConfig: resolved } = resolveModelConfig(modelConfig);
    const messages = buildRewriteMessages(text, action, style, context);
    await streamToResponse(res, messages, resolved);
  } catch (err) {
    handleStreamError(res, err);
  }
});

// 生成章节大纲（结构化 JSON 输出）
router.post('/outline', async (req: Request, res: Response) => {
  try {
    const { plotPoints, characters, worldview, chapterCount, modelConfig } = req.body as {
      plotPoints: Array<{ title: string; description: string }>;
      characters: AIContext['characters'];
      worldview: AIContext['worldview'];
      chapterCount: number;
      modelConfig?: Partial<ModelConfig>;
    };
    if (!Array.isArray(plotPoints) || !chapterCount) {
      res
        .status(400)
        .json({ error: '缺少必填字段 plotPoints/chapterCount', code: '400' });
      return;
    }
    const { modelConfig: resolved } = resolveModelConfig(modelConfig);
    const messages = buildOutlineMessages(
      plotPoints,
      characters ?? [],
      worldview ?? [],
      chapterCount
    );
    const full = await chat(messages, { temperature: 0.7 }, resolved);
    setSSEHeaders(res);
    const SEG = 512;
    for (let i = 0; i < full.length; i += SEG) {
      res.write(`data: ${JSON.stringify({ text: full.slice(i, i + SEG) })}\n\n`);
      flush(res);
    }
    res.write('data: [DONE]\n\n');
    flush(res);
    res.end();
  } catch (err) {
    handleStreamError(res, err);
  }
});

// 全文生成
router.post('/fulltext', async (req: Request, res: Response) => {
  try {
    const { chapterTitle, outline, context, modelConfig } = req.body as {
      chapterTitle: string;
      outline: string;
      context: AIContext;
      modelConfig?: Partial<ModelConfig>;
    };
    if (!chapterTitle || !context) {
      res
        .status(400)
        .json({ error: '缺少必填字段 chapterTitle/context', code: '400' });
      return;
    }
    const { modelConfig: resolved } = resolveModelConfig(modelConfig);
    const messages = buildFulltextMessages(chapterTitle, outline ?? '', context);
    await streamToResponse(res, messages, resolved);
  } catch (err) {
    handleStreamError(res, err);
  }
});

// 角色对话生成
router.post('/dialogue', async (req: Request, res: Response) => {
  try {
    const { character, scene, topic, otherCharacters, modelConfig } = req.body as {
      character: { name: string; personality: string; background: string };
      scene: string;
      topic: string;
      otherCharacters: Array<{ name: string; personality: string }>;
      modelConfig?: Partial<ModelConfig>;
    };
    if (!character || !scene || !topic) {
      res
        .status(400)
        .json({ error: '缺少必填字段 character/scene/topic', code: '400' });
      return;
    }
    const { modelConfig: resolved } = resolveModelConfig(modelConfig);
    const messages = buildDialogueMessages(
      character,
      scene,
      topic,
      otherCharacters ?? []
    );
    await streamToResponse(res, messages, resolved);
  } catch (err) {
    handleStreamError(res, err);
  }
});

// 世界观条目构建
router.post('/worldview', async (req: Request, res: Response) => {
  try {
    const { category, topic, existing, modelConfig } = req.body as {
      category: string;
      topic: string;
      existing: Array<{ title: string; content: string }>;
      modelConfig?: Partial<ModelConfig>;
    };
    if (!category || !topic) {
      res.status(400).json({ error: '缺少必填字段 category/topic', code: '400' });
      return;
    }
    const { modelConfig: resolved } = resolveModelConfig(modelConfig);
    const messages = buildWorldviewMessages(category, topic, existing ?? []);
    await streamToResponse(res, messages, resolved);
  } catch (err) {
    handleStreamError(res, err);
  }
});
