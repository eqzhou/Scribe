// 用户 Repository
// 仅提供认证流程需要的查询/创建方法，所有操作按 username 唯一约束
import { prisma } from '../lib/prisma.js';
import type { User } from '@prisma/client';

// 按用户名查询（含 passwordHash，仅用于登录校验）
export async function findByUsername(username: string): Promise<User | null> {
  return prisma.user.findUnique({ where: { username } });
}

// 按 id 查询（不含 passwordHash）
export async function findById(id: string): Promise<User | null> {
  return prisma.user.findUnique({ where: { id } });
}

// 创建用户
export async function createUser(input: {
  username: string;
  passwordHash: string;
  displayName: string;
}): Promise<User> {
  return prisma.user.create({ data: input });
}
