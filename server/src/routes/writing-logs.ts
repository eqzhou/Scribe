// 写作记录路由
// 前缀：/api
// - GET  /books/:bookId/writing-logs
// - POST /books/:bookId/writing-logs
// - GET    /writing-logs/:id
// - PATCH  /writing-logs/:id
// - DELETE /writing-logs/:id
import { Router } from 'express';
import type { Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import * as writingLogRepo from '../repositories/writingLogRepository.js';

export const router = Router();

function optionalNumber(value: unknown): number | undefined {
  if (value === undefined) return undefined;
  const next = Number(value);
  if (!Number.isFinite(next)) {
    throw new Error('数值字段格式不正确');
  }
  return next;
}

router.get('/books/:bookId/writing-logs', requireAuth, async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;
    let list;
    if (typeof startDate === 'string' && typeof endDate === 'string') {
      list = await writingLogRepo.listByDateRange(req.userId!, req.params.bookId, startDate, endDate);
    } else {
      list = await writingLogRepo.listByBook(req.userId!, req.params.bookId);
    }
    res.json(list);
  } catch (err) {
    const message = err instanceof Error ? err.message : '获取写作记录失败';
    res.status(500).json({ error: message });
  }
});

router.get('/writing-logs/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const log = await writingLogRepo.get(req.userId!, req.params.id);
    if (!log) { res.status(404).json({ error: '写作记录不存在' }); return; }
    res.json(log);
  } catch (err) {
    const message = err instanceof Error ? err.message : '获取写作记录失败';
    res.status(500).json({ error: message });
  }
});

router.post('/books/:bookId/writing-logs', requireAuth, async (req: Request, res: Response) => {
  try {
    const body = req.body as Record<string, unknown>;
    const created = await writingLogRepo.upsertToday(req.userId!, req.params.bookId, {
      wordCount: optionalNumber(body.wordCount),
      duration: optionalNumber(body.duration),
      date: body.date !== undefined ? String(body.date) : undefined,
    });
    res.status(201).json(created);
  } catch (err) {
    const message = err instanceof Error ? err.message : '上报写作记录失败';
    const status = message === '数值字段格式不正确' ? 400 : 500;
    res.status(status).json({ error: message });
  }
});

router.patch('/writing-logs/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const body = req.body as Record<string, unknown>;
    const updated = await writingLogRepo.update(req.userId!, req.params.id, {
      date: body.date !== undefined ? String(body.date) : undefined,
      wordCount: optionalNumber(body.wordCount),
      duration: optionalNumber(body.duration),
    });
    if (!updated) { res.status(404).json({ error: '写作记录不存在' }); return; }
    res.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : '更新写作记录失败';
    const status = message === '数值字段格式不正确' ? 400 : 500;
    res.status(status).json({ error: message });
  }
});

router.delete('/writing-logs/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const ok = await writingLogRepo.remove(req.userId!, req.params.id);
    if (!ok) { res.status(404).json({ error: '写作记录不存在' }); return; }
    res.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : '删除写作记录失败';
    res.status(500).json({ error: message });
  }
});
