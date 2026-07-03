// 剧情线 Repository
import { prisma } from '../lib/prisma.js';
import type { Prisma } from '@prisma/client';

export async function listByBook(userId: string, bookId: string) {
  return prisma.plotLine.findMany({
    where: { userId, bookId },
    orderBy: { order: 'asc' },
  });
}

export async function create(
  userId: string,
  bookId: string,
  data: {
    title: string;
    type?: string;
    synopsis?: string;
    status?: string;
    order?: number;
  },
) {
  const last = await prisma.plotLine.findFirst({
    where: { userId, bookId },
    orderBy: { order: 'desc' },
    select: { order: true },
  });
  const order = data.order ?? (last ? last.order + 1 : 0);
  return prisma.plotLine.create({
    data: {
      userId,
      bookId,
      title: data.title,
      type: data.type ?? 'main',
      synopsis: data.synopsis ?? '',
      status: data.status ?? 'planning',
      order,
    },
  });
}

export async function update(userId: string, id: string, patch: Prisma.PlotLineUpdateInput) {
  const existing = await prisma.plotLine.findFirst({ where: { id, userId } });
  if (!existing) return null;
  return prisma.plotLine.update({ where: { id }, data: patch });
}

export async function remove(userId: string, id: string): Promise<boolean> {
  const existing = await prisma.plotLine.findFirst({ where: { id, userId } });
  if (!existing) return false;
  await prisma.plotLine.delete({ where: { id } });
  return true;
}

// 重排序
export async function reorder(
  userId: string,
  items: Array<{ id: string; order: number }>,
): Promise<void> {
  await prisma.$transaction(
    items.map((item) =>
      prisma.plotLine.updateMany({
        where: { id: item.id, userId },
        data: { order: item.order },
      }),
    ),
  );
}
