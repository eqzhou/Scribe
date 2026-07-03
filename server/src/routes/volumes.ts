// 卷宗路由
// 前缀：/api
// - GET    /books/:bookId/volumes
// - POST   /books/:bookId/volumes
// - PATCH  /volumes/:id
// - DELETE /volumes/:id
import { Router } from 'express';
import type { Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import * as volumeRepo from '../repositories/volumeRepository.js';

export const router = Router();

router.get('/books/:bookId/volumes', requireAuth, async (req: Request, res: Response) => {
  try {
    const list = await volumeRepo.listByBook(req.userId!, req.params.bookId);
    res.json(list);
  } catch (err) {
    const message = err instanceof Error ? err.message : '获取卷宗列表失败';
    res.status(500).json({ error: message });
  }
});

router.post('/books/:bookId/volumes', requireAuth, async (req: Request, res: Response) => {
  try {
    const title = String(req.body?.title ?? '').trim();
    if (!title) { res.status(400).json({ error: 'title 不能为空' }); return; }
    const order = req.body?.order !== undefined ? Number(req.body.order) : undefined;
    const created = await volumeRepo.create(req.userId!, req.params.bookId, { title, order });
    res.status(201).json(created);
  } catch (err) {
    const message = err instanceof Error ? err.message : '创建卷宗失败';
    res.status(500).json({ error: message });
  }
});

router.patch('/volumes/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const patch: Record<string, unknown> = {};
    if (req.body?.title !== undefined) patch.title = String(req.body.title);
    if (req.body?.order !== undefined) patch.order = Number(req.body.order);
    const updated = await volumeRepo.update(req.userId!, req.params.id, patch);
    if (!updated) { res.status(404).json({ error: '卷宗不存在' }); return; }
    res.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : '更新卷宗失败';
    res.status(500).json({ error: message });
  }
});

router.delete('/volumes/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const ok = await volumeRepo.remove(req.userId!, req.params.id);
    if (!ok) { res.status(404).json({ error: '卷宗不存在' }); return; }
    res.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : '删除卷宗失败';
    res.status(500).json({ error: message });
  }
});
