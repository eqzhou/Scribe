// 剧情节点 Repository
import { prisma } from '../lib/prisma.js';
import type { Prisma } from '@prisma/client';

// 列出作品下全部节点
export async function listByBook(userId: string, bookId: string) {
  return prisma.plotPoint.findMany({
    where: { userId, bookId },
    orderBy: { order: 'asc' },
  });
}

// 列出某剧情线下的节点
export async function listByPlotLine(userId: string, plotLineId: string) {
  return prisma.plotPoint.findMany({
    where: { userId, plotLineId },
    orderBy: { order: 'asc' },
  });
}

export async function create(
  userId: string,
  bookId: string,
  data: {
    plotLineId: string;
    title: string;
    description?: string;
    chapterId?: string | null;
    characterIds?: string[];
    order?: number;
    timelineOrder?: number;
  },
) {
  const last = await prisma.plotPoint.findFirst({
    where: { userId, plotLineId: data.plotLineId },
    orderBy: { order: 'desc' },
    select: { order: true },
  });
  const order = data.order ?? (last ? last.order + 1 : 0);
  const timelineOrder = data.timelineOrder ?? order;
  return prisma.plotPoint.create({
    data: {
      userId,
      bookId,
      plotLineId: data.plotLineId,
      title: data.title,
      description: data.description ?? '',
      chapterId: data.chapterId ?? null,
      characterIds: data.characterIds ?? [],
      order,
      timelineOrder,
    },
  });
}

export async function update(userId: string, id: string, patch: Prisma.PlotPointUpdateInput) {
  const existing = await prisma.plotPoint.findFirst({ where: { id, userId } });
  if (!existing) return null;
  return prisma.plotPoint.update({ where: { id }, data: patch });
}

export async function remove(userId: string, id: string): Promise<boolean> {
  const existing = await prisma.plotPoint.findFirst({ where: { id, userId } });
  if (!existing) return false;
  await prisma.plotPoint.delete({ where: { id } });
  return true;
}

// 重排序
export async function reorder(
  userId: string,
  items: Array<{ id: string; order: number }>,
): Promise<void> {
  await prisma.$transaction(
    items.map((item) =>
      prisma.plotPoint.updateMany({
        where: { id: item.id, userId },
        data: { order: item.order },
      }),
    ),
  );
}
