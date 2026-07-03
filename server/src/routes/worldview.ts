// 世界观条目路由
// 前缀：/api
// - GET    /books/:bookId/worldview
// - POST   /books/:bookId/worldview
// - PATCH  /worldview/:id
// - DELETE /worldview/:id
import { Router } from 'express';
import type { Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import * as worldviewRepo from '../repositories/worldviewRepository.js';

export const router = Router();

router.get('/books/:bookId/worldview', requireAuth, async (req: Request, res: Response) => {
  try {
    const list = await worldviewRepo.listByBook(req.userId!, req.params.bookId);
    res.json(list);
  } catch (err) {
    const message = err instanceof Error ? err.message : '获取世界观列表失败';
    res.status(500).json({ error: message });
  }
});

router.post('/books/:bookId/worldview', requireAuth, async (req: Request, res: Response) => {
  try {
    const body = req.body as Record<string, unknown>;
    const category = String(body.category ?? '').trim();
    const title = String(body.title ?? '').trim();
    if (!category || !title) { res.status(400).json({ error: 'category/title 不能为空' }); return; }
    const created = await worldviewRepo.create(req.userId!, req.params.bookId, {
      category,
      title,
      content: String(body.content ?? ''),
      tags: Array.isArray(body.tags) ? body.tags as string[] : [],
      relatedCharacterIds: Array.isArray(body.relatedCharacterIds) ? body.relatedCharacterIds as string[] : [],
      relatedSceneIds: Array.isArray(body.relatedSceneIds) ? body.relatedSceneIds as string[] : [],
    });
    res.status(201).json(created);
  } catch (err) {
    const message = err instanceof Error ? err.message : '创建世界观条目失败';
    res.status(500).json({ error: message });
  }
});

router.patch('/worldview/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const body = req.body as Record<string, unknown>;
    const patch: Record<string, unknown> = {};
    if (body.category !== undefined) patch.category = String(body.category);
    if (body.title !== undefined) patch.title = String(body.title);
    if (body.content !== undefined) patch.content = String(body.content);
    if (body.tags !== undefined) patch.tags = body.tags as string[];
    if (body.relatedCharacterIds !== undefined) patch.relatedCharacterIds = body.relatedCharacterIds as string[];
    if (body.relatedSceneIds !== undefined) patch.relatedSceneIds = body.relatedSceneIds as string[];

    const updated = await worldviewRepo.update(req.userId!, req.params.id, patch);
    if (!updated) { res.status(404).json({ error: '条目不存在' }); return; }
    res.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : '更新世界观条目失败';
    res.status(500).json({ error: message });
  }
});

router.delete('/worldview/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const ok = await worldviewRepo.remove(req.userId!, req.params.id);
    if (!ok) { res.status(404).json({ error: '条目不存在' }); return; }
    res.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : '删除世界观条目失败';
    res.status(500).json({ error: message });
  }
});
