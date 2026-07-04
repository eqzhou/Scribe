// 写作记录 Repository
import { prisma } from '../lib/prisma.js';

// 获取单条写作记录
export async function get(userId: string, id: string) {
  return prisma.writingLog.findFirst({
    where: { id, userId },
  });
}

// 列出作品下全部写作记录
export async function listByBook(userId: string, bookId: string) {
  return prisma.writingLog.findMany({
    where: { userId, bookId },
    orderBy: { date: 'asc' },
  });
}

// 列出作品在指定日期范围内的写作记录
export async function listByDateRange(
  userId: string,
  bookId: string,
  startDate: string,
  endDate: string,
) {
  return prisma.writingLog.findMany({
    where: {
      userId,
      bookId,
      date: { gte: startDate, lte: endDate },
    },
    orderBy: { date: 'asc' },
  });
}

// 更新单条写作记录（用于自动保存会话刷新当天累计值）
export async function update(
  userId: string,
  id: string,
  data: { date?: string; wordCount?: number; duration?: number },
) {
  const existing = await prisma.writingLog.findFirst({
    where: { id, userId },
  });
  if (!existing) return null;

  return prisma.writingLog.update({
    where: { id },
    data: {
      date: data.date,
      wordCount: data.wordCount,
      duration: data.duration,
    },
  });
}

// 删除单条写作记录
export async function remove(userId: string, id: string): Promise<boolean> {
  const existing = await prisma.writingLog.findFirst({
    where: { id, userId },
    select: { id: true },
  });
  if (!existing) return false;
  await prisma.writingLog.delete({ where: { id } });
  return true;
}

// 获取当前日期字符串（YYYY-MM-DD，本地时区）
function todayStr(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// 上报或更新当日记录（按 bookId+date 唯一约束 upsert）
// wordCount 为本次新增字数，duration 为本次新增秒数，均累加到当日总和
export async function upsertToday(
  userId: string,
  bookId: string,
  data: { wordCount?: number; duration?: number; date?: string },
) {
  const date = data.date ?? todayStr();
  const addWords = data.wordCount ?? 0;
  const addDuration = data.duration ?? 0;

  const existing = await prisma.writingLog.findUnique({
    where: { bookId_date: { bookId, date } },
  });

  if (existing) {
    // 仅当属于当前用户时才更新（防越权）
    if (existing.userId !== userId) {
      throw new Error('无权修改该写作记录');
    }
    return prisma.writingLog.update({
      where: { id: existing.id },
      data: {
        wordCount: existing.wordCount + addWords,
        duration: existing.duration + addDuration,
      },
    });
  }

  return prisma.writingLog.create({
    data: {
      userId,
      bookId,
      date,
      wordCount: addWords,
      duration: addDuration,
    },
  });
}

// 获取作品写作统计（总字数、总时长、记录天数）
export async function getStats(userId: string, bookId: string) {
  const logs = await prisma.writingLog.findMany({
    where: { userId, bookId },
    select: { wordCount: true, duration: true },
  });
  const totalWords = logs.reduce((s, l) => s + l.wordCount, 0);
  const totalDuration = logs.reduce((s, l) => s + l.duration, 0);
  return {
    totalWords,
    totalDuration,
    days: logs.length,
  };
}
