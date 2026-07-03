// 场景 Repository
import { prisma } from '../lib/prisma.js';
import type { Prisma } from '@prisma/client';

export async function listByBook(userId: string, bookId: string) {
  return prisma.scene.findMany({
    where: { userId, bookId },
    orderBy: { createdAt: 'asc' },
  });
}

export async function create(
  userId: string,
  bookId: string,
  data: Omit<Prisma.SceneUncheckedCreateInput, 'userId' | 'bookId'>,
) {
  return prisma.scene.create({ data: { ...data, userId, bookId } });
}

export async function update(userId: string, id: string, patch: Prisma.SceneUpdateInput) {
  const existing = await prisma.scene.findFirst({ where: { id, userId } });
  if (!existing) return null;
  return prisma.scene.update({ where: { id }, data: patch });
}

export async function remove(userId: string, id: string): Promise<boolean> {
  const existing = await prisma.scene.findFirst({ where: { id, userId } });
  if (!existing) return false;
  await prisma.scene.delete({ where: { id } });
  return true;
}
