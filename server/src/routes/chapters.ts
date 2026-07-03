// 章节路由
// 前缀：/api
// - GET    /books/:bookId/chapters
// - GET    /chapters/:id
// - POST   /books/:bookId/chapters
// - PATCH  /chapters/:id
// - DELETE /chapters/:id
// - POST   /chapters/:id/reorder
import { Router } from 'express';
import type { Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import * as chapterRepo from '../repositories/chapterRepository.js';

export const router = Router();

router.get('/books/:bookId/chapters', requireAuth, async (req: Request, res: Response) => {
  try {
    const list = await chapterRepo.listByBook(req.userId!, req.params.bookId);
    res.json(list);
  } catch (err) {
    const message = err instanceof Error ? err.message : '获取章节列表失败';
    res.status(500).json({ error: message });
  }
});

// 按卷宗列出章节
router.get('/volumes/:volumeId/chapters', requireAuth, async (req: Request, res: Response) => {
  try {
    const list = await chapterRepo.listByVolume(req.userId!, req.params.volumeId);
    res.json(list);
  } catch (err) {
    const message = err instanceof Error ? err.message : '获取卷宗章节失败';
    res.status(500).json({ error: message });
  }
});

router.get('/chapters/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const chapter = await chapterRepo.get(req.userId!, req.params.id);
    if (!chapter) { res.status(404).json({ error: '章节不存在' }); return; }
    res.json(chapter);
  } catch (err) {
    const message = err instanceof Error ? err.message : '获取章节失败';
    res.status(500).json({ error: message });
  }
});

router.post('/books/:bookId/chapters', requireAuth, async (req: Request, res: Response) => {
  try {
    const body = req.body as Record<string, unknown>;
    const title = String(body.title ?? '').trim();
    if (!title) { res.status(400).json({ error: 'title 不能为空' }); return; }
    const created = await chapterRepo.create(req.userId!, req.params.bookId, {
      title,
      volumeId: body.volumeId !== undefined ? (body.volumeId as string | null) : null,
      summary: body.summary !== undefined ? String(body.summary) : undefined,
      outline: body.outline !== undefined ? (body.outline as string | null) : undefined,
      status: body.status !== undefined ? String(body.status) : undefined,
      wordCount: body.wordCount !== undefined ? Number(body.wordCount) : undefined,
      order: body.order !== undefined ? Number(body.order) : undefined,
      content: body.content !== undefined ? String(body.content) : undefined,
    });
    res.status(201).json(created);
  } catch (err) {
    const message = err instanceof Error ? err.message : '创建章节失败';
    res.status(500).json({ error: message });
  }
});

router.patch('/chapters/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const body = req.body as Record<string, unknown>;
    const updated = await chapterRepo.update(req.userId!, req.params.id, {
      title: body.title !== undefined ? String(body.title) : undefined,
      volumeId: body.volumeId !== undefined ? (body.volumeId as string | null) : undefined,
      summary: body.summary !== undefined ? String(body.summary) : undefined,
      outline: body.outline !== undefined ? (body.outline as string | null) : undefined,
      status: body.status !== undefined ? String(body.status) : undefined,
      wordCount: body.wordCount !== undefined ? Number(body.wordCount) : undefined,
      order: body.order !== undefined ? Number(body.order) : undefined,
      content: body.content !== undefined ? String(body.content) : undefined,
    });
    if (!updated) { res.status(404).json({ error: '章节不存在' }); return; }
    res.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : '更新章节失败';
    res.status(500).json({ error: message });
  }
});

router.delete('/chapters/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const ok = await chapterRepo.remove(req.userId!, req.params.id);
    if (!ok) { res.status(404).json({ error: '章节不存在' }); return; }
    res.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : '删除章节失败';
    res.status(500).json({ error: message });
  }
});

// 重排序：body { items: [{ id, order }] }
router.post('/chapters/:id/reorder', requireAuth, async (req: Request, res: Response) => {
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
    await chapterRepo.reorder(req.userId!, normalized);
    res.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : '重排序失败';
    res.status(500).json({ error: message });
  }
});
