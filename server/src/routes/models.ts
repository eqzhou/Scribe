/**
 * 模型配置管理路由（按用户隔离）
 *
 * 前缀: /api/models
 * 提供模型 CRUD、激活切换、连通性测试。
 * 所有数据严格绑定 req.userId，禁止跨用户访问。
 */
import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import {
  listModels,
  getModel,
  createModel,
  updateModel,
  deleteModel,
  setActiveModel,
  testModel,
  getActiveModelId,
  DEFAULT_CAPABILITIES,
} from '../services/modelStore.js';

const router = Router();

const capabilitySchema = z.enum([
  'continue',
  'rewrite',
  'polish',
  'expand',
  'outline',
  'fulltext',
  'dialogue',
  'worldview',
]);

const providerSchema = z.enum([
  'openai',
  'anthropic',
  'deepseek',
  'qwen',
  'doubao',
  'glm',
  'moonshot',
  'custom',
]);

const modelBaseSchema = z.object({
  name: z.string().trim().min(1, '名称为必填项').max(80, '名称不能超过 80 个字符'),
  provider: providerSchema.default('custom'),
  modelId: z.string().trim().min(1, '模型 ID 为必填项').max(120, '模型 ID 不能超过 120 个字符'),
  apiKey: z.string().max(4096, 'API Key 过长').default(''),
  baseUrl: z.string().trim().min(1, 'API 地址为必填项').max(500, 'API 地址过长'),
  enabled: z.boolean().default(true),
  isDefault: z.boolean().default(false),
  temperature: z.number().finite().min(0).max(2).default(0.7),
  maxTokens: z.number().int().min(0).max(200000).default(4096),
  capabilities: z.array(capabilitySchema).default(() => [...DEFAULT_CAPABILITIES]),
});

const createModelSchema = modelBaseSchema;
const updateModelSchema = modelBaseSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  { message: '没有可更新的字段' },
);

function sendError(res: Response, err: unknown, fallback: string): void {
  if (err instanceof z.ZodError) {
    res.status(400).json({ error: err.issues[0]?.message ?? '参数校验失败' });
    return;
  }
  const message = err instanceof Error ? err.message : fallback;
  const status =
    message.includes('baseUrl 校验失败') ||
    message.includes('名称为必填项') ||
    message.includes('API 地址')
      ? 400
      : message.includes('Unique constraint') || message.includes('唯一')
        ? 409
        : 500;
  res.status(status).json({ error: message });
}

// 列出当前用户的所有模型
router.get('/models', async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const models = await listModels(userId);
    const activeModelId = await getActiveModelId(userId);
    res.json({ models, activeModelId });
  } catch (err) {
    sendError(res, err, '获取模型列表失败');
  }
});

// 获取单个模型
router.get('/models/:id', async (req: Request, res: Response) => {
  try {
    const m = await getModel(req.userId!, req.params.id);
    if (!m) { res.status(404).json({ error: '模型不存在' }); return; }
    res.json(m);
  } catch (err) {
    sendError(res, err, '获取模型失败');
  }
});

// 创建模型
router.post('/models', async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const input = createModelSchema.parse(req.body);

    const created = await createModel(userId, input);
    res.status(201).json(created);
  } catch (err) {
    sendError(res, err, '创建失败');
  }
});

// 更新模型
router.put('/models/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const body = updateModelSchema.parse(req.body);
    const patch: Parameters<typeof updateModel>[2] = {};
    if (body.name !== undefined) patch.name = body.name;
    if (body.provider !== undefined) patch.provider = body.provider;
    if (body.modelId !== undefined) patch.modelId = body.modelId;
    if (body.apiKey !== undefined && body.apiKey && !body.apiKey.endsWith('***')) {
      // 只在传了真实 key(非掩码) 时更新
      patch.apiKey = body.apiKey;
    }
    if (body.baseUrl !== undefined) patch.baseUrl = body.baseUrl;
    if (body.enabled !== undefined) patch.enabled = body.enabled;
    if (body.isDefault !== undefined) patch.isDefault = body.isDefault;
    if (body.temperature !== undefined) patch.temperature = body.temperature;
    if (body.maxTokens !== undefined) patch.maxTokens = body.maxTokens;
    if (body.capabilities !== undefined) patch.capabilities = body.capabilities;

    const updated = await updateModel(userId, req.params.id, patch);
    if (!updated) { res.status(404).json({ error: '模型不存在' }); return; }
    res.json(updated);
  } catch (err) {
    sendError(res, err, '更新失败');
  }
});

// 删除模型
router.delete('/models/:id', async (req: Request, res: Response) => {
  try {
    const ok = await deleteModel(req.userId!, req.params.id);
    if (!ok) { res.status(404).json({ error: '模型不存在' }); return; }
    res.json({ ok: true });
  } catch (err) {
    sendError(res, err, '删除失败');
  }
});

// 设为激活默认模型
router.post('/models/:id/activate', async (req: Request, res: Response) => {
  try {
    const ok = await setActiveModel(req.userId!, req.params.id);
    if (!ok) { res.status(400).json({ error: '无法激活该模型' }); return; }
    res.json({ ok: true });
  } catch (err) {
    sendError(res, err, '激活失败');
  }
});

// 测试连通性
router.post('/models/:id/test', async (req: Request, res: Response) => {
  try {
    const result = await testModel(req.userId!, req.params.id);
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : '测试失败';
    res.status(500).json({ ok: false, message });
  }
});

export { router as modelRouter };
