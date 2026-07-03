// 写作记录路由
// 前缀：/api
// - GET  /books/:bookId/writing-logs
// - POST /books/:bookId/writing-logs
import { Router } from 'express';
import type { Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import * as writingLogRepo from '../repositories/writingLogRepository.js';

export const router = Router();

router.get('/books/:bookId/writing-logs', requireAuth, async (req: Request, res: Response) => {
  try {
    const list = await writingLogRepo.listByBook(req.userId!, req.params.bookId);
    res.json(list);
  } catch (err) {
    const message = err instanceof Error ? err.message : '获取写作记录失败';
    res.status(500).json({ error: message });
  }
});

router.post('/books/:bookId/writing-logs', requireAuth, async (req: Request, res: Response) => {
  try {
    const body = req.body as Record<string, unknown>;
    const created = await writingLogRepo.upsertToday(req.userId!, req.params.bookId, {
      wordCount: body.wordCount !== undefined ? Number(body.wordCount) : undefined,
      duration: body.duration !== undefined ? Number(body.duration) : undefined,
      date: body.date !== undefined ? String(body.date) : undefined,
    });
    res.status(201).json(created);
  } catch (err) {
    const message = err instanceof Error ? err.message : '上报写作记录失败';
    res.status(500).json({ error: message });
  }
});
