/**
 * JSON 导出工具
 *
 * 将作品及其全部关联实体导出为 JSON 字符串，支持单作品导出与全量导出。
 * 顶层结构：{ version, exportedAt, books: ExportedBook[] }
 */
import { db } from './db';
import type {
  Book,
  WorldviewEntry,
  Character,
  CharacterRelation,
  PlotLine,
  PlotPoint,
  Foreshadowing,
  Scene,
  Volume,
  Chapter,
  Inspiration,
  WritingLog,
} from '../types';

/** 导出版本号 */
const EXPORT_VERSION = '1.0';

/** 导出数据顶层结构 */
interface ExportData {
  version: string;
  exportedAt: string;
  books: ExportedBook[];
}

/** 导出作品：在 Book 基础上挂载全部关联实体数组 */
export interface ExportedBook extends Book {
  worldview: WorldviewEntry[];
  characters: Character[];
  relations: CharacterRelation[];
  plotLines: PlotLine[];
  plotPoints: PlotPoint[];
  foreshadowing: Foreshadowing[];
  scenes: Scene[];
  volumes: Volume[];
  chapters: Chapter[];
  inspiration: Inspiration[];
  writingLogs: WritingLog[];
}

/**
 * 导出指定作品及其全部关联实体为 JSON 字符串。
 *
 * @param bookId 目标作品 ID
 * @returns JSON 字符串
 */
export async function exportBook(bookId: string): Promise<string> {
  const book = await db.books.get(bookId);
  if (!book) {
    throw new Error(`作品 ${bookId} 不存在，无法导出`);
  }
  const exportedBook = await collectBookData(book);
  const data: ExportData = {
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    books: [exportedBook],
  };
  return JSON.stringify(data, null, 2);
}

/**
 * 导出全部作品及其关联实体为 JSON 字符串。
 *
 * @returns JSON 字符串
 */
export async function exportAll(): Promise<string> {
  const books = await db.books.toArray();
  const exportedBooks = await Promise.all(books.map(collectBookData));
  const data: ExportData = {
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    books: exportedBooks,
  };
  return JSON.stringify(data, null, 2);
}

/**
 * 收集单部作品的全部关联数据。
 * 并行查询 11 张关联表，提升导出速度。
 */
async function collectBookData(book: Book): Promise<ExportedBook> {
  const bookId = book.id;
  const [
    worldview,
    characters,
    relations,
    plotLines,
    plotPoints,
    foreshadowing,
    scenes,
    volumes,
    chapters,
    inspiration,
    writingLogs,
  ] = await Promise.all([
    db.worldview.where('bookId').equals(bookId).toArray(),
    db.characters.where('bookId').equals(bookId).toArray(),
    db.relations.where('bookId').equals(bookId).toArray(),
    db.plotLines.where('bookId').equals(bookId).toArray(),
    db.plotPoints.where('bookId').equals(bookId).toArray(),
    db.foreshadowing.where('bookId').equals(bookId).toArray(),
    db.scenes.where('bookId').equals(bookId).toArray(),
    db.volumes.where('bookId').equals(bookId).toArray(),
    db.chapters.where('bookId').equals(bookId).toArray(),
    db.inspiration.where('bookId').equals(bookId).toArray(),
    db.writingLogs.where('bookId').equals(bookId).toArray(),
  ]);

  return {
    ...book,
    worldview,
    characters,
    relations,
    plotLines,
    plotPoints,
    foreshadowing,
    scenes,
    volumes,
    chapters,
    inspiration,
    writingLogs,
  };
}

/**
 * 触发浏览器下载 JSON 文件。
 *
 * @param content JSON 字符串内容
 * @param filename 下载文件名（如 `scribe-backup-2024-01-01.json`）
 */
export function downloadJson(content: string, filename: string): void {
  // 使用 Blob + URL.createObjectURL 触发浏览器下载
  const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  // 必须先挂载到 DOM 才能在部分浏览器中触发点击下载
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  // 释放 ObjectURL，避免内存泄漏
  URL.revokeObjectURL(url);
}
