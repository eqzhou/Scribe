// 剧情节点路由
// 前缀：/api
// - GET    /books/:bookId/plot-points
// - POST   /books/:bookId/plot-points
// - PATCH  /plot-points/:id
// - DELETE /plot-points/:id
// - POST   /plot-points/:id/reorder
import { Router } from 'express';
import type { Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import * as plotPointRepo from '../repositories/plotPointRepository.js';

export const router = Router();

router.get('/books/:bookId/plot-points', requireAuth, async (req: Request, res: Response) => {
  try {
    const list = await plotPointRepo.listByBook(req.userId!, req.params.bookId);
    res.json(list);
  } catch (err) {
    const message = err instanceof Error ? err.message : '获取剧情节点失败';
    res.status(500).json({ error: message });
  }
});

router.post('/books/:bookId/plot-points', requireAuth, async (req: Request, res: Response) => {
  try {
    const body = req.body as Record<string, unknown>;
    const plotLineId = String(body.plotLineId ?? '');
    const title = String(body.title ?? '').trim();
    if (!plotLineId || !title) {
      res.status(400).json({ error: 'plotLineId/title 不能为空' });
      return;
    }
    const created = await plotPointRepo.create(req.userId!, req.params.bookId, {
      plotLineId,
      title,
      description: body.description !== undefined ? String(body.description) : undefined,
      chapterId: body.chapterId !== undefined ? (body.chapterId as string | null) : undefined,
      characterIds: Array.isArray(body.characterIds) ? body.characterIds as string[] : undefined,
      order: body.order !== undefined ? Number(body.order) : undefined,
      timelineOrder: body.timelineOrder !== undefined ? Number(body.timelineOrder) : undefined,
    });
    res.status(201).json(created);
  } catch (err) {
    const message = err instanceof Error ? err.message : '创建剧情节点失败';
    res.status(500).json({ error: message });
  }
});

router.patch('/plot-points/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const body = req.body as Record<string, unknown>;
    const patch: Record<string, unknown> = {};
    if (body.title !== undefined) patch.title = String(body.title);
    if (body.description !== undefined) patch.description = String(body.description);
    if (body.chapterId !== undefined) patch.chapterId = body.chapterId === null ? null : String(body.chapterId);
    if (body.characterIds !== undefined) patch.characterIds = body.characterIds as string[];
    if (body.order !== undefined) patch.order = Number(body.order);
    if (body.timelineOrder !== undefined) patch.timelineOrder = Number(body.timelineOrder);

    const updated = await plotPointRepo.update(req.userId!, req.params.id, patch);
    if (!updated) { res.status(404).json({ error: '节点不存在' }); return; }
    res.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : '更新剧情节点失败';
    res.status(500).json({ error: message });
  }
});

router.delete('/plot-points/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const ok = await plotPointRepo.remove(req.userId!, req.params.id);
    if (!ok) { res.status(404).json({ error: '节点不存在' }); return; }
    res.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : '删除剧情节点失败';
    res.status(500).json({ error: message });
  }
});

// 重排序：body { items: [{ id, order }] }
router.post('/plot-points/:id/reorder', requireAuth, async (req: Request, res: Response) => {
  try {
    const items = req.body?.items;
    if (!Array.isArray(items)) {
      res.status(400).json({ error: 'items 必须为数组' });
      return;
    }
    const normalized = items
      .map((it: unknown) => {
        const obj = it as { id?: unknown; order?: unknown };
        return { id: String(obj.id ?? ''), order: Number(obj.order ?? 0) };
      })
      .filter((it) => it.id);
    await plotPointRepo.reorder(req.userId!, normalized);
    res.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : '重排序失败';
    res.status(500).json({ error: message });
  }
});
