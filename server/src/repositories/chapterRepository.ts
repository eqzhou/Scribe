// 章节 Repository
//
// 章节正文不存数据库，由文件系统 file/{userId}/{bookTitle}/{chapterTitle}.md 持久化。
// create/update 接收 HTML content，转 Markdown 写入文件；
// get 读取文件并转回 HTML 返回。
import { prisma } from '../lib/prisma.js';
import type { Prisma } from '@prisma/client';
import { htmlToMd, mdToHtml } from '../lib/markdown.js';
import {
  writeChapter,
  readChapter,
  deleteChapter,
  renameChapter,
} from '../lib/fileStore.js';

// 获取章节列表（不含正文，避免大量文件读取）
export async function listByBook(userId: string, bookId: string) {
  return prisma.chapter.findMany({
    where: { userId, bookId },
    orderBy: { order: 'asc' },
  });
}

// 内部：读取文件正文并转为 HTML，挂到 chapter.content 字段
async function attachContent(userId: string, bookId: string, chapter: {
  id: string;
  title: string;
  [k: string]: unknown;
}) {
  const book = await prisma.book.findFirst({
    where: { id: bookId, userId },
    select: { title: true },
  });
  if (!book) return { ...chapter, content: '' };
  const md = readChapter(userId, book.title, chapter.title);
  return { ...chapter, content: mdToHtml(md) };
}

// 获取单个章节（含正文）
export async function get(userId: string, id: string) {
  const chapter = await prisma.chapter.findFirst({ where: { id, userId } });
  if (!chapter) return null;
  return attachContent(userId, chapter.bookId, chapter);
}

// 创建章节：可选 content（HTML），转 Markdown 写文件
export async function create(
  userId: string,
  bookId: string,
  data: {
    title: string;
    volumeId?: string | null;
    summary?: string;
    outline?: string | null;
    status?: string;
    wordCount?: number;
    order?: number;
    content?: string; // HTML
  },
) {
  const book = await prisma.book.findFirst({
    where: { id: bookId, userId },
    select: { title: true },
  });
  if (!book) throw new Error('作品不存在或无访问权限');

  const last = await prisma.chapter.findFirst({
    where: { userId, bookId },
    orderBy: { order: 'desc' },
    select: { order: true },
  });
  const order = data.order ?? (last ? last.order + 1 : 0);

  const chapter = await prisma.chapter.create({
    data: {
      userId,
      bookId,
      volumeId: data.volumeId ?? null,
      title: data.title,
      summary: data.summary ?? '',
      outline: data.outline ?? null,
      status: data.status ?? 'draft',
      wordCount: data.wordCount ?? 0,
      order,
    },
  });

  // 写正文文件（HTML → Markdown）
  const md = data.content !== undefined ? htmlToMd(data.content) : '';
  writeChapter(userId, book.title, chapter.title, md);

  return { ...chapter, content: data.content ?? '' };
}

// 更新章节：title 变更时同步重命名文件；content 变更时重写文件
export async function update(
  userId: string,
  id: string,
  patch: {
    title?: string;
    volumeId?: string | null;
    summary?: string;
    outline?: string | null;
    status?: string;
    wordCount?: number;
    order?: number;
    content?: string; // HTML
  },
) {
  const existing = await prisma.chapter.findFirst({ where: { id, userId } });
  if (!existing) return null;

  const book = await prisma.book.findFirst({
    where: { id: existing.bookId, userId },
    select: { title: true },
  });
  if (!book) throw new Error('作品不存在或无访问权限');

  const { content, title, ...rest } = patch;
  const data: Prisma.ChapterUpdateInput = { ...rest };
  if (title !== undefined && title !== existing.title) {
    data.title = title;
  }

  const updated = await prisma.chapter.update({ where: { id }, data });

  // 处理正文文件
  if (title !== undefined && title !== existing.title) {
    renameChapter(userId, book.title, existing.title, updated.title);
  }
  if (content !== undefined) {
    writeChapter(userId, book.title, updated.title, htmlToMd(content));
  }

  // 返回时附带最新正文（HTML）
  const md = readChapter(userId, book.title, updated.title);
  return { ...updated, content: mdToHtml(md) };
}

// 删除章节：同时删除正文文件
export async function remove(userId: string, id: string): Promise<boolean> {
  const existing = await prisma.chapter.findFirst({ where: { id, userId } });
  if (!existing) return false;
  const book = await prisma.book.findFirst({
    where: { id: existing.bookId, userId },
    select: { title: true },
  });
  if (book) {
    deleteChapter(userId, book.title, existing.title);
  }
  await prisma.chapter.delete({ where: { id } });
  return true;
}

// 重排序：批量更新 order 字段
export async function reorder(
  userId: string,
  items: Array<{ id: string; order: number }>,
): Promise<void> {
  await prisma.$transaction(
    items.map((item) =>
      prisma.chapter.updateMany({
        where: { id: item.id, userId },
        data: { order: item.order },
      }),
    ),
  );
}
