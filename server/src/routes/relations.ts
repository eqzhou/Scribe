// 角色关系路由
// 前缀：/api
// - GET    /books/:bookId/relations
// - POST   /books/:bookId/relations
// - DELETE /relations/:id
import { Router } from 'express';
import type { Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import * as relationRepo from '../repositories/relationRepository.js';

export const router = Router();

router.get('/books/:bookId/relations', requireAuth, async (req: Request, res: Response) => {
  try {
    const list = await relationRepo.listByBook(req.userId!, req.params.bookId);
    res.json(list);
  } catch (err) {
    const message = err instanceof Error ? err.message : '获取角色关系失败';
    res.status(500).json({ error: message });
  }
});

// 按角色列出关系（fromId 或 toId 命中）
router.get('/characters/:charId/relations', requireAuth, async (req: Request, res: Response) => {
  try {
    const list = await relationRepo.listByCharacter(req.userId!, req.params.charId);
    res.json(list);
  } catch (err) {
    const message = err instanceof Error ? err.message : '获取角色关系失败';
    res.status(500).json({ error: message });
  }
});

router.post('/books/:bookId/relations', requireAuth, async (req: Request, res: Response) => {
  try {
    const body = req.body as Record<string, unknown>;
    const fromId = String(body.fromId ?? '');
    const toId = String(body.toId ?? '');
    if (!fromId || !toId) { res.status(400).json({ error: 'fromId/toId 不能为空' }); return; }
    const created = await relationRepo.create(req.userId!, req.params.bookId, {
      fromId,
      toId,
      type: body.type !== undefined ? String(body.type) : undefined,
      description: body.description !== undefined ? String(body.description) : undefined,
    });
    res.status(201).json(created);
  } catch (err) {
    const message = err instanceof Error ? err.message : '创建角色关系失败';
    res.status(500).json({ error: message });
  }
});

router.delete('/relations/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const ok = await relationRepo.remove(req.userId!, req.params.id);
    if (!ok) { res.status(404).json({ error: '关系不存在' }); return; }
    res.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : '删除关系失败';
    res.status(500).json({ error: message });
  }
});
