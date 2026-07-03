// 角色 Repository
import { prisma } from '../lib/prisma.js';
import type { Prisma } from '@prisma/client';

export async function listByBook(userId: string, bookId: string) {
  return prisma.character.findMany({
    where: { userId, bookId },
    orderBy: { createdAt: 'asc' },
  });
}

export async function get(userId: string, id: string) {
  return prisma.character.findFirst({ where: { id, userId } });
}

export async function create(
  userId: string,
  bookId: string,
  data: Omit<Prisma.CharacterUncheckedCreateInput, 'userId' | 'bookId'>,
) {
  return prisma.character.create({ data: { ...data, userId, bookId } });
}

export async function update(userId: string, id: string, patch: Prisma.CharacterUpdateInput) {
  const existing = await prisma.character.findFirst({ where: { id, userId } });
  if (!existing) return null;
  return prisma.character.update({ where: { id }, data: patch });
}

export async function remove(userId: string, id: string): Promise<boolean> {
  const existing = await prisma.character.findFirst({ where: { id, userId } });
  if (!existing) return false;
  await prisma.character.delete({ where: { id } });
  return true;
}
