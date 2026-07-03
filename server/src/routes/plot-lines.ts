// 剧情线路由
// 前缀：/api
// - GET    /books/:bookId/plot-lines
// - POST   /books/:bookId/plot-lines
// - PATCH  /plot-lines/:id
// - DELETE /plot-lines/:id
import { Router } from 'express';
import type { Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import * as plotLineRepo from '../repositories/plotLineRepository.js';

export const router = Router();

router.get('/books/:bookId/plot-lines', requireAuth, async (req: Request, res: Response) => {
  try {
    const list = await plotLineRepo.listByBook(req.userId!, req.params.bookId);
    res.json(list);
  } catch (err) {
    const message = err instanceof Error ? err.message : '获取剧情线失败';
    res.status(500).json({ error: message });
  }
});

router.post('/books/:bookId/plot-lines', requireAuth, async (req: Request, res: Response) => {
  try {
    const body = req.body as Record<string, unknown>;
    const title = String(body.title ?? '').trim();
    if (!title) { res.status(400).json({ error: 'title 不能为空' }); return; }
    const created = await plotLineRepo.create(req.userId!, req.params.bookId, {
      title,
      type: body.type !== undefined ? String(body.type) : undefined,
      synopsis: body.synopsis !== undefined ? String(body.synopsis) : undefined,
      status: body.status !== undefined ? String(body.status) : undefined,
      order: body.order !== undefined ? Number(body.order) : undefined,
    });
    res.status(201).json(created);
  } catch (err) {
    const message = err instanceof Error ? err.message : '创建剧情线失败';
    res.status(500).json({ error: message });
  }
});

router.patch('/plot-lines/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const body = req.body as Record<string, unknown>;
    const patch: Record<string, unknown> = {};
    if (body.title !== undefined) patch.title = String(body.title);
    if (body.type !== undefined) patch.type = String(body.type);
    if (body.synopsis !== undefined) patch.synopsis = String(body.synopsis);
    if (body.status !== undefined) patch.status = String(body.status);
    if (body.order !== undefined) patch.order = Number(body.order);

    const updated = await plotLineRepo.update(req.userId!, req.params.id, patch);
    if (!updated) { res.status(404).json({ error: '剧情线不存在' }); return; }
    res.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : '更新剧情线失败';
    res.status(500).json({ error: message });
  }
});

router.delete('/plot-lines/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const ok = await plotLineRepo.remove(req.userId!, req.params.id);
    if (!ok) { res.status(404).json({ error: '剧情线不存在' }); return; }
    res.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : '删除剧情线失败';
    res.status(500).json({ error: message });
  }
});
