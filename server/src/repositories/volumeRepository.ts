// 卷宗 Repository
// 所有操作按 userId + bookId 隔离
import { prisma } from '../lib/prisma.js';
import type { Prisma } from '@prisma/client';

// 列出作品下全部卷宗，按 order 升序
export async function listByBook(userId: string, bookId: string) {
  return prisma.volume.findMany({
    where: { userId, bookId },
    orderBy: { order: 'asc' },
  });
}

export async function get(userId: string, id: string) {
  return prisma.volume.findFirst({ where: { id, userId } });
}

// 创建卷宗：自动追加到末尾（max order + 1）
export async function create(
  userId: string,
  bookId: string,
  data: { title: string; order?: number },
) {
  const last = await prisma.volume.findFirst({
    where: { userId, bookId },
    orderBy: { order: 'desc' },
    select: { order: true },
  });
  const order = data.order ?? (last ? last.order + 1 : 0);
  return prisma.volume.create({
    data: {
      userId,
      bookId,
      title: data.title,
      order,
    },
  });
}

// 更新卷宗（强制 userId 校验）
export async function update(userId: string, id: string, patch: Prisma.VolumeUpdateInput) {
  const existing = await prisma.volume.findFirst({ where: { id, userId } });
  if (!existing) return null;
  return prisma.volume.update({ where: { id }, data: patch });
}

// 删除卷宗
export async function remove(userId: string, id: string): Promise<boolean> {
  const existing = await prisma.volume.findFirst({ where: { id, userId } });
  if (!existing) return false;
  await prisma.volume.delete({ where: { id } });
  return true;
}
