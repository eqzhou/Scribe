// 作品路由
// 前缀：/api
// - GET    /books
// - GET    /books/:id
// - POST   /books
// - PATCH  /books/:id
// - DELETE /books/:id
import { Router } from 'express';
import type { Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import * as bookRepo from '../repositories/bookRepository.js';
import { deleteBookFiles, renameBook } from '../lib/fileStore.js';

export const router = Router();

// 列出当前用户全部作品
router.get('/books', requireAuth, async (req: Request, res: Response) => {
  try {
    const list = await bookRepo.list(req.userId!);
    res.json(list);
  } catch (err) {
    const message = err instanceof Error ? err.message : '获取作品列表失败';
    res.status(500).json({ error: message });
  }
});

// 获取单个作品
router.get('/books/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const book = await bookRepo.get(req.userId!, req.params.id);
    if (!book) { res.status(404).json({ error: '作品不存在' }); return; }
    res.json(book);
  } catch (err) {
    const message = err instanceof Error ? err.message : '获取作品失败';
    res.status(500).json({ error: message });
  }
});

// 创建作品
router.post('/books', requireAuth, async (req: Request, res: Response) => {
  try {
    const body = req.body as Record<string, unknown>;
    const title = String(body.title ?? '').trim();
    if (!title) { res.status(400).json({ error: 'title 不能为空' }); return; }
    const created = await bookRepo.create(req.userId!, {
      title,
      subtitle: String(body.subtitle ?? ''),
      synopsis: String(body.synopsis ?? ''),
      genre: String(body.genre ?? ''),
      targetWords: Number(body.targetWords ?? 50000),
      coverColor: String(body.coverColor ?? '#3b82f6'),
      dailyGoal: Number(body.dailyGoal ?? 3000),
    });
    res.status(201).json(created);
  } catch (err) {
    const message = err instanceof Error ? err.message : '创建作品失败';
    res.status(500).json({ error: message });
  }
});

// 更新作品（标题变更时同步重命名作品目录）
router.patch('/books/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const existing = await bookRepo.get(req.userId!, id);
    if (!existing) { res.status(404).json({ error: '作品不存在' }); return; }

    const body = req.body as Record<string, unknown>;
    const patch: Record<string, unknown> = {};
    if (body.title !== undefined) patch.title = String(body.title);
    if (body.subtitle !== undefined) patch.subtitle = String(body.subtitle);
    if (body.synopsis !== undefined) patch.synopsis = String(body.synopsis);
    if (body.genre !== undefined) patch.genre = String(body.genre);
    if (body.targetWords !== undefined) patch.targetWords = Number(body.targetWords);
    if (body.coverColor !== undefined) patch.coverColor = String(body.coverColor);
    if (body.dailyGoal !== undefined) patch.dailyGoal = Number(body.dailyGoal);

    const updated = await bookRepo.update(req.userId!, id, patch);
    if (!updated) { res.status(404).json({ error: '作品不存在' }); return; }

    // 标题变更：同步重命名作品目录
    if (patch.title && patch.title !== existing.title) {
      renameBook(req.userId!, existing.title, String(patch.title));
    }

    res.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : '更新作品失败';
    res.status(500).json({ error: message });
  }
});

// 删除作品（含其下全部章节文件）
router.delete('/books/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const existing = await bookRepo.get(req.userId!, id);
    if (!existing) { res.status(404).json({ error: '作品不存在' }); return; }
    const ok = await bookRepo.remove(req.userId!, id);
    if (!ok) { res.status(404).json({ error: '作品不存在' }); return; }
    // 删除作品目录下全部章节文件
    deleteBookFiles(req.userId!, existing.title);
    res.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : '删除作品失败';
    res.status(500).json({ error: message });
  }
});

