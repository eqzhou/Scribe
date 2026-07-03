// 角色路由
// 前缀：/api
// - GET    /books/:bookId/characters
// - POST   /books/:bookId/characters
// - PATCH  /characters/:id
// - DELETE /characters/:id
import { Router } from 'express';
import type { Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import * as characterRepo from '../repositories/characterRepository.js';

export const router = Router();

router.get('/books/:bookId/characters', requireAuth, async (req: Request, res: Response) => {
  try {
    const list = await characterRepo.listByBook(req.userId!, req.params.bookId);
    res.json(list);
  } catch (err) {
    const message = err instanceof Error ? err.message : '获取角色列表失败';
    res.status(500).json({ error: message });
  }
});

router.post('/books/:bookId/characters', requireAuth, async (req: Request, res: Response) => {
  try {
    const body = req.body as Record<string, unknown>;
    const name = String(body.name ?? '').trim();
    if (!name) { res.status(400).json({ error: 'name 不能为空' }); return; }
    const created = await characterRepo.create(req.userId!, req.params.bookId, {
      name,
      alias: String(body.alias ?? ''),
      faction: String(body.faction ?? ''),
      role: String(body.role ?? 'supporting'),
      appearance: String(body.appearance ?? ''),
      personality: String(body.personality ?? ''),
      background: String(body.background ?? ''),
      arc: String(body.arc ?? ''),
      birthday: body.birthday !== undefined && body.birthday !== null ? String(body.birthday) : null,
      age: body.age !== undefined && body.age !== null ? Number(body.age) : null,
      appearanceColor: String(body.appearanceColor ?? '#3b82f6'),
      tags: Array.isArray(body.tags) ? body.tags as string[] : [],
      relatedWorldviewIds: Array.isArray(body.relatedWorldviewIds) ? body.relatedWorldviewIds as string[] : [],
    });
    res.status(201).json(created);
  } catch (err) {
    const message = err instanceof Error ? err.message : '创建角色失败';
    res.status(500).json({ error: message });
  }
});

router.patch('/characters/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const body = req.body as Record<string, unknown>;
    const patch: Record<string, unknown> = {};
    if (body.name !== undefined) patch.name = String(body.name);
    if (body.alias !== undefined) patch.alias = String(body.alias);
    if (body.faction !== undefined) patch.faction = String(body.faction);
    if (body.role !== undefined) patch.role = String(body.role);
    if (body.appearance !== undefined) patch.appearance = String(body.appearance);
    if (body.personality !== undefined) patch.personality = String(body.personality);
    if (body.background !== undefined) patch.background = String(body.background);
    if (body.arc !== undefined) patch.arc = String(body.arc);
    if (body.birthday !== undefined) patch.birthday = body.birthday === null ? null : String(body.birthday);
    if (body.age !== undefined) patch.age = body.age === null ? null : Number(body.age);
    if (body.appearanceColor !== undefined) patch.appearanceColor = String(body.appearanceColor);
    if (body.tags !== undefined) patch.tags = body.tags as string[];
    if (body.relatedWorldviewIds !== undefined) patch.relatedWorldviewIds = body.relatedWorldviewIds as string[];

    const updated = await characterRepo.update(req.userId!, req.params.id, patch);
    if (!updated) { res.status(404).json({ error: '角色不存在' }); return; }
    res.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : '更新角色失败';
    res.status(500).json({ error: message });
  }
});

router.delete('/characters/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const ok = await characterRepo.remove(req.userId!, req.params.id);
    if (!ok) { res.status(404).json({ error: '角色不存在' }); return; }
    res.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : '删除角色失败';
    res.status(500).json({ error: message });
  }
});
