// 角色关系 Repository
import { prisma } from '../lib/prisma.js';

// 列出某角色的全部关系（from 或 to 方向）
export async function listByCharacter(userId: string, characterId: string) {
  return prisma.characterRelation.findMany({
    where: {
      userId,
      OR: [{ fromId: characterId }, { toId: characterId }],
    },
    orderBy: { createdAt: 'asc' },
  });
}

// 列出作品下全部关系
export async function listByBook(userId: string, bookId: string) {
  return prisma.characterRelation.findMany({
    where: { userId, bookId },
    orderBy: { createdAt: 'asc' },
  });
}

export async function create(
  userId: string,
  bookId: string,
  data: {
    fromId: string;
    toId: string;
    type?: string;
    description?: string;
  },
) {
  return prisma.characterRelation.create({
    data: {
      userId,
      bookId,
      fromId: data.fromId,
      toId: data.toId,
      type: data.type ?? 'other',
      description: data.description ?? '',
    },
  });
}

export async function remove(userId: string, id: string): Promise<boolean> {
  const existing = await prisma.characterRelation.findFirst({ where: { id, userId } });
  if (!existing) return false;
  await prisma.characterRelation.delete({ where: { id } });
  return true;
}
