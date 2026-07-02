/**
 * JSON 导入工具
 *
 * 校验导出文件结构，按 title 判重；遇重名时抛出 DuplicateBookError 供 UI 层处理。
 * 支持 'overwrite'（覆盖）与 'new'（导入为新作品，重映射全部 ID）两种模式。
 */
import { db } from './db';
import type { Book } from '../types';
import type { ExportedBook } from './exporter';

/** 导入结果 */
export interface ImportResult {
  success: boolean;
  message: string;
  importedBooks: number;
}

/** 支持的导入文件版本 */
const SUPPORTED_VERSION = '1.0';

/**
 * 重名作品错误。
 * UI 层捕获后可弹出"覆盖/导入为新作品"选择弹窗，并调用 importJsonWithMode。
 */
export class DuplicateBookError extends Error {
  /** 数据库中已存在的同名作品 */
  existingBook: Book;
  /** 导入文件中作品标题 */
  importedTitle: string;

  constructor(existingBook: Book, importedTitle: string) {
    const created = new Date(existingBook.createdAt).toLocaleString('zh-CN');
    super(
      `已存在同名作品《${existingBook.title}》（创建于 ${created}）。请选择覆盖原作品或导入为新作品。`,
    );
    this.name = 'DuplicateBookError';
    this.existingBook = existingBook;
    this.importedTitle = importedTitle;
  }
}

/** 待写入的表名集合，用于事务 */
const ALL_TABLES = [
  db.books,
  db.worldview,
  db.characters,
  db.relations,
  db.plotLines,
  db.plotPoints,
  db.foreshadowing,
  db.scenes,
  db.volumes,
  db.chapters,
  db.inspiration,
  db.writingLogs,
] as const;

/**
 * 导入 JSON 字符串。
 * 遇重名作品抛出 DuplicateBookError，由 UI 层决定后续处理方式。
 *
 * @param jsonString 导出文件内容
 */
export async function importJson(jsonString: string): Promise<ImportResult> {
  const data = parseAndValidate(jsonString);
  let importedCount = 0;

  for (const bookData of data.books) {
    // 按 title 判重
    const existing = await db.books.where('title').equals(bookData.title).first();
    if (existing) {
      // 抛出特定错误，由 UI 层捕获并展示影响范围
      throw new DuplicateBookError(existing, bookData.title);
    }
    await importBookData(bookData);
    importedCount++;
  }

  return {
    success: true,
    message: `成功导入 ${importedCount} 部作品`,
    importedBooks: importedCount,
  };
}

/**
 * 按指定模式导入 JSON 字符串。
 *
 * @param jsonString 导出文件内容
 * @param mode 'overwrite' 覆盖同名作品 | 'new' 导入为新作品（重映射全部 ID）
 */
export async function importJsonWithMode(
  jsonString: string,
  mode: 'overwrite' | 'new',
): Promise<ImportResult> {
  const data = parseAndValidate(jsonString);
  let importedCount = 0;

  for (const bookData of data.books) {
    const existing = await db.books.where('title').equals(bookData.title).first();
    if (existing) {
      if (mode === 'overwrite') {
        // 先级联删除已有作品及其全部关联实体，再写入导入数据
        await deleteBookCascade(existing.id);
        await importBookData(bookData);
      } else {
        // 导入为新作品：重映射 bookId 与全部实体 ID，更新跨实体引用
        const remapped = remapBookIds(bookData);
        await importBookData(remapped);
      }
    } else {
      // 无重名，直接导入
      await importBookData(bookData);
    }
    importedCount++;
  }

  return {
    success: true,
    message: `成功导入 ${importedCount} 部作品`,
    importedBooks: importedCount,
  };
}

/**
 * 校验 JSON 字符串结构与版本。
 * - 必须可被 JSON.parse
 * - version 字段必须为 "1.0"
 * - books 字段必须为数组，且每个元素含 id 与 title
 */
function parseAndValidate(jsonString: string): { version: string; books: ExportedBook[] } {
  let data: unknown;
  try {
    data = JSON.parse(jsonString);
  } catch {
    throw new Error('JSON 格式无效，无法解析');
  }

  const obj = data as Record<string, unknown>;
  if (!obj || typeof obj !== 'object') {
    throw new Error('导入数据根节点必须为对象');
  }
  if (obj.version !== SUPPORTED_VERSION) {
    throw new Error(
      `不支持的版本：${String(obj.version)}，当前仅支持 ${SUPPORTED_VERSION}`,
    );
  }
  if (!Array.isArray(obj.books)) {
    throw new Error('books 字段必须是数组');
  }
  // 校验每本书的结构完整性
  for (const book of obj.books as Record<string, unknown>[]) {
    if (!book || typeof book !== 'object') {
      throw new Error('books 数组中存在非对象元素');
    }
    if (typeof book.id !== 'string' || typeof book.title !== 'string') {
      throw new Error('作品数据不完整：每本书必须包含 id 与 title 字段');
    }
  }

  return obj as unknown as { version: string; books: ExportedBook[] };
}

/**
 * 将单部作品及其关联实体写入数据库。
 * 使用事务保证原子性：全部写入成功或全部回滚。
 */
async function importBookData(bookData: ExportedBook): Promise<void> {
  await db.transaction('rw', ALL_TABLES, async () => {
    // 写入作品本身（剥离关联数组）
    const {
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
      ...bookFields
    } = bookData;
    // 使用 put 而非 add，以便覆盖模式下能覆盖既有主键
    await db.books.put(bookFields as Book);

    // 批量写入关联实体，缺失数组视为空
    if (Array.isArray(worldview) && worldview.length) await db.worldview.bulkPut(worldview);
    if (Array.isArray(characters) && characters.length) await db.characters.bulkPut(characters);
    if (Array.isArray(relations) && relations.length) await db.relations.bulkPut(relations);
    if (Array.isArray(plotLines) && plotLines.length) await db.plotLines.bulkPut(plotLines);
    if (Array.isArray(plotPoints) && plotPoints.length) await db.plotPoints.bulkPut(plotPoints);
    if (Array.isArray(foreshadowing) && foreshadowing.length)
      await db.foreshadowing.bulkPut(foreshadowing);
    if (Array.isArray(scenes) && scenes.length) await db.scenes.bulkPut(scenes);
    if (Array.isArray(volumes) && volumes.length) await db.volumes.bulkPut(volumes);
    if (Array.isArray(chapters) && chapters.length) await db.chapters.bulkPut(chapters);
    if (Array.isArray(inspiration) && inspiration.length)
      await db.inspiration.bulkPut(inspiration);
    if (Array.isArray(writingLogs) && writingLogs.length)
      await db.writingLogs.bulkPut(writingLogs);
  });
}

/**
 * 级联删除指定作品及其全部关联实体。
 * 用于 overwrite 模式下清理旧数据，以及 ProjectsPage 删除作品。
 */
export async function deleteBookCascade(bookId: string): Promise<void> {
  await db.transaction('rw', ALL_TABLES, async () => {
    await db.books.delete(bookId);
    await db.worldview.where('bookId').equals(bookId).delete();
    await db.characters.where('bookId').equals(bookId).delete();
    await db.relations.where('bookId').equals(bookId).delete();
    await db.plotLines.where('bookId').equals(bookId).delete();
    await db.plotPoints.where('bookId').equals(bookId).delete();
    await db.foreshadowing.where('bookId').equals(bookId).delete();
    await db.scenes.where('bookId').equals(bookId).delete();
    await db.volumes.where('bookId').equals(bookId).delete();
    await db.chapters.where('bookId').equals(bookId).delete();
    await db.inspiration.where('bookId').equals(bookId).delete();
    await db.writingLogs.where('bookId').equals(bookId).delete();
  });
}

/**
 * 重映射作品全部 ID，用于 'new' 模式。
 *
 * 生成新的 bookId 与各实体 ID，同时更新所有跨实体引用（如 CharacterRelation.fromId、
 * PlotPoint.plotLineId、Scene.worldviewEntryIds、Chapter.volumeId 等），
 * 章节内容 HTML 中的旧 ID 也一并替换，保证导入后引用关系完整。
 */
function remapBookIds(bookData: ExportedBook): ExportedBook {
  const newBookId = crypto.randomUUID();

  // 为每类实体建立 oldId → newId 映射
  const map = {
    worldview: new Map<string, string>(),
    characters: new Map<string, string>(),
    relations: new Map<string, string>(),
    plotLines: new Map<string, string>(),
    plotPoints: new Map<string, string>(),
    foreshadowing: new Map<string, string>(),
    scenes: new Map<string, string>(),
    volumes: new Map<string, string>(),
    chapters: new Map<string, string>(),
    inspiration: new Map<string, string>(),
    writingLogs: new Map<string, string>(),
  };

  // 工具：批量生成新 ID 并填充映射
  const buildMap = <T extends { id: string }>(arr: T[], m: Map<string, string>) => {
    arr.forEach(item => m.set(item.id, crypto.randomUUID()));
  };
  buildMap(bookData.worldview, map.worldview);
  buildMap(bookData.characters, map.characters);
  buildMap(bookData.relations, map.relations);
  buildMap(bookData.plotLines, map.plotLines);
  buildMap(bookData.plotPoints, map.plotPoints);
  buildMap(bookData.foreshadowing, map.foreshadowing);
  buildMap(bookData.scenes, map.scenes);
  buildMap(bookData.volumes, map.volumes);
  buildMap(bookData.chapters, map.chapters);
  buildMap(bookData.inspiration, map.inspiration);
  buildMap(bookData.writingLogs, map.writingLogs);

  // 工具：按映射重写单个 ID（未命中则原样返回）
  const remap = (m: Map<string, string>, id: string) => m.get(id) ?? id;
  // 工具：按映射重写 ID 数组
  const remapArray = (m: Map<string, string>, ids: string[]) =>
    ids.map(id => remap(m, id));

  // 章节内容中的旧 ID 替换（CharacterMention / WorldviewRef 等节点携带的 ID）
  const remapContent = (content: string): string => {
    let result = content;
    for (const m of Object.values(map)) {
      for (const [oldId, newId] of m) {
        if (result.includes(oldId)) {
          result = result.split(oldId).join(newId);
        }
      }
    }
    return result;
  };

  return {
    ...bookData,
    id: newBookId,
    // 标题追加（副本）后缀，避免与原作品重名
    title: `${bookData.title}（副本）`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    worldview: bookData.worldview.map(w => ({
      ...w,
      id: remap(map.worldview, w.id),
      bookId: newBookId,
      relatedCharacterIds: remapArray(map.characters, w.relatedCharacterIds ?? []),
      relatedSceneIds: remapArray(map.scenes, w.relatedSceneIds ?? []),
    })),
    characters: bookData.characters.map(c => ({
      ...c,
      id: remap(map.characters, c.id),
      bookId: newBookId,
    })),
    relations: bookData.relations.map(r => ({
      ...r,
      id: remap(map.relations, r.id),
      bookId: newBookId,
      fromId: remap(map.characters, r.fromId),
      toId: remap(map.characters, r.toId),
    })),
    plotLines: bookData.plotLines.map(p => ({
      ...p,
      id: remap(map.plotLines, p.id),
      bookId: newBookId,
    })),
    plotPoints: bookData.plotPoints.map(p => ({
      ...p,
      id: remap(map.plotPoints, p.id),
      bookId: newBookId,
      plotLineId: remap(map.plotLines, p.plotLineId),
      chapterId: p.chapterId ? remap(map.chapters, p.chapterId) : undefined,
      characterIds: remapArray(map.characters, p.characterIds ?? []),
    })),
    foreshadowing: bookData.foreshadowing.map(f => ({
      ...f,
      id: remap(map.foreshadowing, f.id),
      bookId: newBookId,
      setupChapterId: f.setupChapterId
        ? remap(map.chapters, f.setupChapterId)
        : undefined,
      payoffChapterId: f.payoffChapterId
        ? remap(map.chapters, f.payoffChapterId)
        : undefined,
    })),
    scenes: bookData.scenes.map(s => ({
      ...s,
      id: remap(map.scenes, s.id),
      bookId: newBookId,
      geography: s.geography ? remap(map.worldview, s.geography) : undefined,
      worldviewEntryIds: remapArray(map.worldview, s.worldviewEntryIds ?? []),
      characterIds: remapArray(map.characters, s.characterIds ?? []),
      chapterIds: remapArray(map.chapters, s.chapterIds ?? []),
    })),
    volumes: bookData.volumes.map(v => ({
      ...v,
      id: remap(map.volumes, v.id),
      bookId: newBookId,
    })),
    chapters: bookData.chapters.map(c => ({
      ...c,
      id: remap(map.chapters, c.id),
      bookId: newBookId,
      volumeId: c.volumeId ? remap(map.volumes, c.volumeId) : undefined,
      content: remapContent(c.content ?? ''),
    })),
    inspiration: bookData.inspiration.map(i => ({
      ...i,
      id: remap(map.inspiration, i.id),
      bookId: newBookId,
    })),
    writingLogs: bookData.writingLogs.map(w => ({
      ...w,
      id: remap(map.writingLogs, w.id),
      bookId: newBookId,
    })),
  };
}
