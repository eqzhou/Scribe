// 作品 Repository
// 所有操作都按 userId 隔离
import { prisma } from '../lib/prisma.js';
import type { Book, Prisma } from '@prisma/client';

// 列出用户全部作品，按 updatedAt 倒序
export async function list(userId: string): Promise<Book[]> {
  return prisma.book.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
  });
}

// 获取单个作品（强制 userId 校验，防越权）
export async function get(userId: string, id: string): Promise<Book | null> {
  return prisma.book.findFirst({ where: { id, userId } });
}

// 创建作品
export async function create(
  userId: string,
  data: Omit<Prisma.BookUncheckedCreateInput, 'userId'>,
): Promise<Book> {
  return prisma.book.create({ data: { ...data, userId } });
}

// 更新作品（强制 userId 校验）
export async function update(
  userId: string,
  id: string,
  patch: Prisma.BookUpdateInput,
): Promise<Book | null> {
  const existing = await prisma.book.findFirst({ where: { id, userId } });
  if (!existing) return null;
  return prisma.book.update({ where: { id }, data: patch });
}

// 删除作品（含其下所有子实体，Prisma 级联删除自动处理）
export async function remove(userId: string, id: string): Promise<boolean> {
  const existing = await prisma.book.findFirst({ where: { id, userId } });
  if (!existing) return false;
  await prisma.book.delete({ where: { id } });
  return true;
}
