// 认证路由
// 前缀：/api/auth
// - POST /register  注册
// - POST /login     登录
// - GET  /me        获取当前用户（需认证）
import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { hashPassword, verifyPassword, signToken } from '../lib/auth.js';
import { createUser, findByUsername, findById } from '../repositories/userRepository.js';
import { requireAuth } from '../middleware/auth.js';

export const router = Router();

const registerSchema = z.object({
  username: z.string().min(3).max(20),
  password: z.string().min(6).max(50),
  displayName: z.string().optional(),
});

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

// 注册
router.post('/register', async (req: Request, res: Response) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? '参数校验失败' });
      return;
    }
    const { username, password, displayName } = parsed.data;

    const existing = await findByUsername(username);
    if (existing) {
      res.status(409).json({ error: '用户名已存在' });
      return;
    }

    const passwordHash = await hashPassword(password);
    const user = await createUser({
      username,
      passwordHash,
      displayName: displayName?.trim() || username,
    });

    const token = signToken(user.id);
    res.status(201).json({
      token,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : '注册失败';
    res.status(500).json({ error: message });
  }
});

// 登录
router.post('/login', async (req: Request, res: Response) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: '用户名或密码不能为空' });
      return;
    }
    const { username, password } = parsed.data;

    const user = await findByUsername(username);
    if (!user) {
      res.status(401).json({ error: '用户名或密码错误' });
      return;
    }
    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) {
      res.status(401).json({ error: '用户名或密码错误' });
      return;
    }

    const token = signToken(user.id);
    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : '登录失败';
    res.status(500).json({ error: message });
  }
});

// 获取当前登录用户
router.get('/me', requireAuth, async (req: Request, res: Response) => {
  try {
    if (!req.userId) {
      res.status(401).json({ error: '未登录' });
      return;
    }
    const user = await findById(req.userId);
    if (!user) {
      res.status(404).json({ error: '用户不存在' });
      return;
    }
    res.json({
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : '获取用户信息失败';
    res.status(500).json({ error: message });
  }
});


