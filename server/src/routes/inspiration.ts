// 灵感卡片路由
// 前缀：/api
// - GET    /books/:bookId/inspiration
// - POST   /books/:bookId/inspiration
// - PATCH  /inspiration/:id
// - DELETE /inspiration/:id
import { Router } from 'express';
import type { Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import * as inspirationRepo from '../repositories/inspirationRepository.js';

export const router = Router();

router.get('/books/:bookId/inspiration', requireAuth, async (req: Request, res: Response) => {
  try {
    const list = await inspirationRepo.listByBook(req.userId!, req.params.bookId);
    res.json(list);
  } catch (err) {
    const message = err instanceof Error ? err.message : '获取灵感列表失败';
    res.status(500).json({ error: message });
  }
});

router.post('/books/:bookId/inspiration', requireAuth, async (req: Request, res: Response) => {
  try {
    const body = req.body as Record<string, unknown>;
    const title = String(body.title ?? '').trim();
    if (!title) { res.status(400).json({ error: 'title 不能为空' }); return; }
    const created = await inspirationRepo.create(req.userId!, req.params.bookId, {
      title,
      content: String(body.content ?? ''),
      tags: Array.isArray(body.tags) ? body.tags as string[] : [],
      category: String(body.category ?? ''),
    });
    res.status(201).json(created);
  } catch (err) {
    const message = err instanceof Error ? err.message : '创建灵感失败';
    res.status(500).json({ error: message });
  }
});

router.patch('/inspiration/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const body = req.body as Record<string, unknown>;
    const patch: Record<string, unknown> = {};
    if (body.title !== undefined) patch.title = String(body.title);
    if (body.content !== undefined) patch.content = String(body.content);
    if (body.tags !== undefined) patch.tags = body.tags as string[];
    if (body.category !== undefined) patch.category = String(body.category);

    const updated = await inspirationRepo.update(req.userId!, req.params.id, patch);
    if (!updated) { res.status(404).json({ error: '灵感不存在' }); return; }
    res.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : '更新灵感失败';
    res.status(500).json({ error: message });
  }
});

router.delete('/inspiration/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const ok = await inspirationRepo.remove(req.userId!, req.params.id);
    if (!ok) { res.status(404).json({ error: '灵感不存在' }); return; }
    res.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : '删除灵感失败';
    res.status(500).json({ error: message });
  }
});
