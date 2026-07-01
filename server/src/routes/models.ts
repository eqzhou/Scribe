/**
 * 模型配置管理路由
 *
 * 前缀: /api/models
 * 提供模型 CRUD、激活切换、连通性测试。
 */
import { Router } from 'express';
import type { Request, Response } from 'express';
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

// 列出所有模型
router.get('/', (_req: Request, res: Response) => {
  res.json({
    models: listModels(),
    activeModelId: getActiveModelId(),
  });
});

// 获取单个模型
router.get('/:id', (req: Request, res: Response) => {
  const m = getModel(req.params.id);
  if (!m) { res.status(404).json({ error: '模型不存在' }); return; }
  res.json(m);
});

// 创建模型
router.post('/', (req: Request, res: Response) => {
  try {
    const body = req.body as Record<string, unknown>;
    const name = String(body.name ?? '');
    const provider = String(body.provider ?? 'custom');
    const modelId = String(body.modelId ?? '');
    const apiKey = String(body.apiKey ?? '');
    const baseUrl = String(body.baseUrl ?? '');
    const enabled = body.enabled !== false;
    const isDefault = Boolean(body.isDefault);
    const temperature = Number(body.temperature ?? 0.7);
    const maxTokens = Number(body.maxTokens ?? 4096);
    const capabilities = Array.isArray(body.capabilities)
      ? body.capabilities as string[]
      : DEFAULT_CAPABILITIES;

    if (!name || !modelId || !baseUrl) {
      res.status(400).json({ error: '名称、模型 ID、API 地址为必填项' });
      return;
    }

    const created = createModel({
      name, provider, modelId, apiKey, baseUrl,
      enabled, isDefault, temperature, maxTokens, capabilities,
    });
    res.status(201).json(created);
  } catch (err) {
    const message = err instanceof Error ? err.message : '创建失败';
    res.status(500).json({ error: message });
  }
});

// 更新模型
router.put('/:id', (req: Request, res: Response) => {
  try {
    const body = req.body as Record<string, unknown>;
    const patch: Record<string, unknown> = {};
    if (body.name !== undefined) patch.name = String(body.name);
    if (body.provider !== undefined) patch.provider = String(body.provider);
    if (body.modelId !== undefined) patch.modelId = String(body.modelId);
    if (body.apiKey !== undefined && String(body.apiKey) && !String(body.apiKey).endsWith('***')) {
      // 只在传了真实 key(非掩码) 时更新
      patch.apiKey = String(body.apiKey);
    }
    if (body.baseUrl !== undefined) patch.baseUrl = String(body.baseUrl);
    if (body.enabled !== undefined) patch.enabled = Boolean(body.enabled);
    if (body.isDefault !== undefined) patch.isDefault = Boolean(body.isDefault);
    if (body.temperature !== undefined) patch.temperature = Number(body.temperature);
    if (body.maxTokens !== undefined) patch.maxTokens = Number(body.maxTokens);
    if (body.capabilities !== undefined) patch.capabilities = body.capabilities as string[];

    const updated = updateModel(req.params.id, patch);
    if (!updated) { res.status(404).json({ error: '模型不存在' }); return; }
    res.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : '更新失败';
    res.status(500).json({ error: message });
  }
});

// 删除模型
router.delete('/:id', (req: Request, res: Response) => {
  const ok = deleteModel(req.params.id);
  if (!ok) { res.status(404).json({ error: '模型不存在' }); return; }
  res.json({ ok: true });
});

// 设为激活默认模型
router.post('/:id/activate', (_req: Request, res: Response) => {
  const ok = setActiveModel(_req.params.id);
  if (!ok) { res.status(400).json({ error: '无法激活该模型' }); return; }
  res.json({ ok: true });
});

// 测试连通性
router.post('/:id/test', async (req: Request, res: Response) => {
  try {
    const result = await testModel(req.params.id);
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : '测试失败';
    res.status(500).json({ ok: false, message });
  }
});

export { router as modelRouter };
