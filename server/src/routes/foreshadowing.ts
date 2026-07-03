// 伏笔路由
// 前缀：/api
// - GET    /books/:bookId/foreshadowing
// - POST   /books/:bookId/foreshadowing
// - PATCH  /foreshadowing/:id
// - DELETE /foreshadowing/:id
import { Router } from 'express';
import type { Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import * as foreshadowRepo from '../repositories/foreshadowRepository.js';

export const router = Router();

router.get('/books/:bookId/foreshadowing', requireAuth, async (req: Request, res: Response) => {
  try {
    const list = await foreshadowRepo.listByBook(req.userId!, req.params.bookId);
    res.json(list);
  } catch (err) {
    const message = err instanceof Error ? err.message : '获取伏笔列表失败';
    res.status(500).json({ error: message });
  }
});

router.post('/books/:bookId/foreshadowing', requireAuth, async (req: Request, res: Response) => {
  try {
    const body = req.body as Record<string, unknown>;
    const title = String(body.title ?? '').trim();
    if (!title) { res.status(400).json({ error: 'title 不能为空' }); return; }
    const created = await foreshadowRepo.create(req.userId!, req.params.bookId, {
      title,
      description: String(body.description ?? ''),
      setupChapterId: body.setupChapterId !== undefined ? (body.setupChapterId as string | null) : null,
      payoffChapterId: body.payoffChapterId !== undefined ? (body.payoffChapterId as string | null) : null,
      status: String(body.status ?? 'pending'),
    });
    res.status(201).json(created);
  } catch (err) {
    const message = err instanceof Error ? err.message : '创建伏笔失败';
    res.status(500).json({ error: message });
  }
});

router.patch('/foreshadowing/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const body = req.body as Record<string, unknown>;
    const patch: Record<string, unknown> = {};
    if (body.title !== undefined) patch.title = String(body.title);
    if (body.description !== undefined) patch.description = String(body.description);
    if (body.setupChapterId !== undefined) patch.setupChapterId = body.setupChapterId === null ? null : String(body.setupChapterId);
    if (body.payoffChapterId !== undefined) patch.payoffChapterId = body.payoffChapterId === null ? null : String(body.payoffChapterId);
    if (body.status !== undefined) patch.status = String(body.status);

    const updated = await foreshadowRepo.update(req.userId!, req.params.id, patch);
    if (!updated) { res.status(404).json({ error: '伏笔不存在' }); return; }
    res.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : '更新伏笔失败';
    res.status(500).json({ error: message });
  }
});

router.delete('/foreshadowing/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const ok = await foreshadowRepo.remove(req.userId!, req.params.id);
    if (!ok) { res.status(404).json({ error: '伏笔不存在' }); return; }
    res.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : '删除伏笔失败';
    res.status(500).json({ error: message });
  }
});
