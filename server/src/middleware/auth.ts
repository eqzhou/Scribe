// 认证中间件
// 解析 Authorization: Bearer {token} 头，校验 JWT 后挂载到 req.userId 与 req.user
import type { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../lib/auth.js';
import { prisma } from '../lib/prisma.js';

// 扩展 Express Request 类型，挂载认证后的用户信息
declare module 'express-serve-static-core' {
  interface Request {
    userId?: string;
    user?: {
      id: string;
      username: string;
      displayName: string;
    };
  }
}

/**
 * 强制认证中间件：
 * - 解析 Authorization: Bearer {token}
 * - 校验 JWT，挂载 req.userId 与 req.user
 * - 失败返回 401
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const header = req.headers.authorization ?? '';
    const match = header.match(/^Bearer\s+(.+)$/i);
    if (!match) {
      res.status(401).json({ error: '未提供认证令牌' });
      return;
    }
    const token = match[1].trim();
    const payload = verifyToken(token);
    if (!payload) {
      res.status(401).json({ error: '认证令牌无效或已过期' });
      return;
    }
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, username: true, displayName: true },
    });
    if (!user) {
      res.status(401).json({ error: '用户不存在' });
      return;
    }
    req.userId = user.id;
    req.user = user;
    next();
  } catch (err) {
    const message = err instanceof Error ? err.message : '认证失败';
    res.status(401).json({ error: message });
  }
}
