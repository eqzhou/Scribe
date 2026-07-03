// 灵感卡片 Repository
import { prisma } from '../lib/prisma.js';
import type { Prisma } from '@prisma/client';

export async function listByBook(userId: string, bookId: string) {
  return prisma.inspiration.findMany({
    where: { userId, bookId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function create(
  userId: string,
  bookId: string,
  data: Omit<Prisma.InspirationUncheckedCreateInput, 'userId' | 'bookId'>,
) {
  return prisma.inspiration.create({ data: { ...data, userId, bookId } });
}

export async function update(userId: string, id: string, patch: Prisma.InspirationUpdateInput) {
  const existing = await prisma.inspiration.findFirst({ where: { id, userId } });
  if (!existing) return null;
  return prisma.inspiration.update({ where: { id }, data: patch });
}

export async function remove(userId: string, id: string): Promise<boolean> {
  const existing = await prisma.inspiration.findFirst({ where: { id, userId } });
  if (!existing) return false;
  await prisma.inspiration.delete({ where: { id } });
  return true;
}
