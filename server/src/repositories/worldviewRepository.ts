// 世界观条目 Repository
import { prisma } from '../lib/prisma.js';
import type { Prisma } from '@prisma/client';

export async function listByBook(userId: string, bookId: string) {
  return prisma.worldviewEntry.findMany({
    where: { userId, bookId },
    orderBy: { createdAt: 'asc' },
  });
}

export async function get(userId: string, id: string) {
  return prisma.worldviewEntry.findFirst({ where: { id, userId } });
}

export async function create(
  userId: string,
  bookId: string,
  data: Omit<Prisma.WorldviewEntryUncheckedCreateInput, 'userId' | 'bookId'>,
) {
  return prisma.worldviewEntry.create({ data: { ...data, userId, bookId } });
}

export async function update(userId: string, id: string, patch: Prisma.WorldviewEntryUpdateInput) {
  const existing = await prisma.worldviewEntry.findFirst({ where: { id, userId } });
  if (!existing) return null;
  return prisma.worldviewEntry.update({ where: { id }, data: patch });
}

export async function remove(userId: string, id: string): Promise<boolean> {
  const existing = await prisma.worldviewEntry.findFirst({ where: { id, userId } });
  if (!existing) return false;
  await prisma.worldviewEntry.delete({ where: { id } });
  return true;
}
