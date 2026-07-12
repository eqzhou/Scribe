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
import {
  BlueprintImportConflictError,
  blueprintImportSchema,
  createBookFromBlueprint,
} from '../services/blueprintImportService.js';

export const router = Router();

const BLUEPRINT_IMPORT_WINDOW_MS = 60_000;
const BLUEPRINT_IMPORT_LIMIT = 3;
const blueprintImportWindows = new Map<string, { startedAt: number; count: number }>();
const activeBlueprintImports = new Set<string>();

function reserveBlueprintImport(userId: string): 'ok' | 'busy' | 'rate-limited' {
  if (activeBlueprintImports.has(userId)) return 'busy';

  const now = Date.now();
  const current = blueprintImportWindows.get(userId);
  const isNewWindow = !current || now - current.startedAt >= BLUEPRINT_IMPORT_WINDOW_MS;
  const window = isNewWindow
    ? { startedAt: now, count: 0 }
    : current;
  if (window.count >= BLUEPRINT_IMPORT_LIMIT) return 'rate-limited';

  blueprintImportWindows.set(userId, { ...window, count: window.count + 1 });
  if (isNewWindow) {
    const startedAt = window.startedAt;
    setTimeout(() => {
      if (blueprintImportWindows.get(userId)?.startedAt === startedAt) {
        blueprintImportWindows.delete(userId);
      }
    }, BLUEPRINT_IMPORT_WINDOW_MS).unref();
  }
  activeBlueprintImports.add(userId);
  return 'ok';
}

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

// 原子创建作品并导入用户确认后的项目蓝图
router.post('/books/from-blueprint', requireAuth, async (req: Request, res: Response) => {
  const parsed = blueprintImportSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: parsed.error.issues[0]?.message ?? '蓝图参数校验失败',
      path: parsed.error.issues[0]?.path.join('.'),
    });
    return;
  }
  const reservation = reserveBlueprintImport(req.userId!);
  if (reservation !== 'ok') {
    res.status(429).json({
      error: reservation === 'busy' ? '已有蓝图正在导入，请稍后再试' : '蓝图导入过于频繁，请稍后再试',
    });
    return;
  }
  try {
    const result = await createBookFromBlueprint(req.userId!, parsed.data);
    res.status(201).json(result);
  } catch (err) {
    if (err instanceof BlueprintImportConflictError) {
      res.status(409).json({ error: err.message });
      return;
    }
    console.error('创建作品并导入蓝图失败:', err);
    res.status(500).json({ error: '创建作品并导入蓝图失败' });
  } finally {
    activeBlueprintImports.delete(req.userId!);
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
