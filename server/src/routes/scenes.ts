// 场景路由
// 前缀：/api
// - GET    /books/:bookId/scenes
// - POST   /books/:bookId/scenes
// - PATCH  /scenes/:id
// - DELETE /scenes/:id
import { Router } from 'express';
import type { Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import * as sceneRepo from '../repositories/sceneRepository.js';

export const router = Router();

router.get('/books/:bookId/scenes', requireAuth, async (req: Request, res: Response) => {
  try {
    const list = await sceneRepo.listByBook(req.userId!, req.params.bookId);
    res.json(list);
  } catch (err) {
    const message = err instanceof Error ? err.message : '获取场景列表失败';
    res.status(500).json({ error: message });
  }
});

// 获取单个场景
router.get('/scenes/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const scene = await sceneRepo.get(req.userId!, req.params.id);
    if (!scene) { res.status(404).json({ error: '场景不存在' }); return; }
    res.json(scene);
  } catch (err) {
    const message = err instanceof Error ? err.message : '获取场景失败';
    res.status(500).json({ error: message });
  }
});

router.post('/books/:bookId/scenes', requireAuth, async (req: Request, res: Response) => {
  try {
    const body = req.body as Record<string, unknown>;
    const name = String(body.name ?? '').trim();
    if (!name) { res.status(400).json({ error: 'name 不能为空' }); return; }
    const created = await sceneRepo.create(req.userId!, req.params.bookId, {
      name,
      description: String(body.description ?? ''),
      atmosphere: Array.isArray(body.atmosphere) ? body.atmosphere as string[] : [],
      geography: body.geography !== undefined && body.geography !== null ? String(body.geography) : null,
      worldviewEntryIds: Array.isArray(body.worldviewEntryIds) ? body.worldviewEntryIds as string[] : [],
      characterIds: Array.isArray(body.characterIds) ? body.characterIds as string[] : [],
      chapterIds: Array.isArray(body.chapterIds) ? body.chapterIds as string[] : [],
    });
    res.status(201).json(created);
  } catch (err) {
    const message = err instanceof Error ? err.message : '创建场景失败';
    res.status(500).json({ error: message });
  }
});

router.patch('/scenes/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const body = req.body as Record<string, unknown>;
    const patch: Record<string, unknown> = {};
    if (body.name !== undefined) patch.name = String(body.name);
    if (body.description !== undefined) patch.description = String(body.description);
    if (body.atmosphere !== undefined) patch.atmosphere = body.atmosphere as string[];
    if (body.geography !== undefined) patch.geography = body.geography === null ? null : String(body.geography);
    if (body.worldviewEntryIds !== undefined) patch.worldviewEntryIds = body.worldviewEntryIds as string[];
    if (body.characterIds !== undefined) patch.characterIds = body.characterIds as string[];
    if (body.chapterIds !== undefined) patch.chapterIds = body.chapterIds as string[];

    const updated = await sceneRepo.update(req.userId!, req.params.id, patch);
    if (!updated) { res.status(404).json({ error: '场景不存在' }); return; }
    res.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : '更新场景失败';
    res.status(500).json({ error: message });
  }
});

router.delete('/scenes/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const ok = await sceneRepo.remove(req.userId!, req.params.id);
    if (!ok) { res.status(404).json({ error: '场景不存在' }); return; }
    res.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : '删除场景失败';
    res.status(500).json({ error: message });
  }
});
