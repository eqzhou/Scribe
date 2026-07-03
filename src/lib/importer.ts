/**
 * JSON 导入工具
 *
 * 校验导出文件结构，按 title 判重；遇重名时抛出 DuplicateBookError 供 UI 层处理。
 * 支持 'overwrite'（覆盖）与 'new'（导入为新作品，由后端生成新 ID）两种模式。
 *
 * 后端使用 cuid 自动生成主键，因此本工具不传 id 字段，而是通过两阶段流程
 * 维护跨实体引用一致性：
 *   阶段 1：按依赖顺序创建实体，跨实体引用（relatedXxxIds）先置空
 *   阶段 2：拿到全部新 ID 后，PATCH 各实体的 relatedXxxIds 字段
 */
import type { Book } from '../types';
import {
  bookRepository,
  volumeRepository,
  chapterRepository,
  characterRepository,
  relationRepository,
  plotLineRepository,
  plotPointRepository,
  foreshadowingRepository,
  sceneRepository,
  worldviewRepository,
  inspirationRepository,
  writingLogRepository,
} from './repositories';
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

/** 各类实体的 oldId → newId 映射集合 */
interface IdMaps {
  volumes: Map<string, string>;
  chapters: Map<string, string>;
  worldview: Map<string, string>;
  characters: Map<string, string>;
  plotLines: Map<string, string>;
  plotPoints: Map<string, string>;
  scenes: Map<string, string>;
}

/** 创建空的 ID 映射集 */
function createIdMaps(): IdMaps {
  return {
    volumes: new Map(),
    chapters: new Map(),
    worldview: new Map(),
    characters: new Map(),
    plotLines: new Map(),
    plotPoints: new Map(),
    scenes: new Map(),
  };
}

/**
 * 剥离实体中的 id / createdAt / updatedAt 字段（由后端自动生成）。
 * 返回类型为 Partial<T>，调用方需补齐 bookId 等依赖字段后再传入 repository.create。
 */
function stripGenerated<T extends Record<string, unknown>>(
  entity: T,
): Record<string, unknown> {
  const { id: _id, createdAt: _ca, updatedAt: _ua, ...rest } = entity;
  return rest;
}

/**
 * 按 ID 映射重写单个 ID 字段。未命中映射时原样返回。
 */
function remapId(map: Map<string, string>, id: string | undefined): string | undefined {
  if (!id) return id;
  return map.get(id) ?? id;
}

/** 按 ID 映射重写 ID 数组 */
function remapIdArray(map: Map<string, string>, ids: string[] | undefined): string[] {
  if (!Array.isArray(ids)) return [];
  return ids.map((id) => map.get(id) ?? id);
}

/**
 * 重写章节内容 HTML 中嵌入的实体 ID（CharacterMention / WorldviewRef 等节点携带）。
 */
function remapContentIds(content: string, idMaps: IdMaps): string {
  if (!content) return content;
  let result = content;
  for (const m of Object.values(idMaps)) {
    for (const [oldId, newId] of m) {
      if (result.includes(oldId)) {
        result = result.split(oldId).join(newId);
      }
    }
  }
  return result;
}

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
    // 按 title 判重：list 返回全部作品，在内存中匹配
    const allBooks = await bookRepository.list();
    const existing = allBooks.find((b) => b.title === bookData.title);
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
 * @param mode 'overwrite' 覆盖同名作品 | 'new' 导入为新作品（标题加「（副本）」后缀）
 */
export async function importJsonWithMode(
  jsonString: string,
  mode: 'overwrite' | 'new',
): Promise<ImportResult> {
  const data = parseAndValidate(jsonString);
  let importedCount = 0;

  for (const bookData of data.books) {
    const allBooks = await bookRepository.list();
    const existing = allBooks.find((b) => b.title === bookData.title);
    if (existing) {
      if (mode === 'overwrite') {
        // 先级联删除已有作品及其全部关联实体（后端 Prisma onDelete: Cascade）
        await deleteBookCascade(existing.id);
        await importBookData(bookData);
      } else {
        // 导入为新作品：标题追加「（副本）」后缀，全部 ID 由后端重新生成
        await importBookData({ ...bookData, title: `${bookData.title}（副本）` });
      }
    } else {
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
 * 将单部作品及其关联实体写入数据库（两阶段流程）。
 *
 * 阶段 1：按依赖顺序创建实体，跨实体引用先置空
 * 阶段 2：拿到全部新 ID 后，PATCH 各实体的 relatedXxxIds 字段
 *
 * 注意：后端无事务，部分失败时已写入的数据不会回滚。调用方需在 UI 层提示。
 */
async function importBookData(bookData: ExportedBook): Promise<void> {
  const idMaps = createIdMaps();

  // ===== 阶段 1：创建实体（跨实体引用先置空） =====

  // 1. 作品本身
  const bookPayload = stripGenerated(bookData as unknown as Record<string, unknown>);
  delete bookPayload.worldview;
  delete bookPayload.characters;
  delete bookPayload.relations;
  delete bookPayload.plotLines;
  delete bookPayload.plotPoints;
  delete bookPayload.foreshadowing;
  delete bookPayload.scenes;
  delete bookPayload.volumes;
  delete bookPayload.chapters;
  delete bookPayload.inspiration;
  delete bookPayload.writingLogs;
  const newBook = await bookRepository.create(
    bookPayload as unknown as Parameters<typeof bookRepository.create>[0],
  );
  const newBookId = newBook.id;

  // 2. 卷宗（无依赖）
  for (const v of bookData.volumes ?? []) {
    const payload = stripGenerated(v as unknown as Record<string, unknown>);
    const created = await volumeRepository.create({
      ...(payload as Record<string, unknown>),
      bookId: newBookId,
    } as unknown as Parameters<typeof volumeRepository.create>[0]);
    idMaps.volumes.set(v.id, created.id);
  }

  // 3. 章节（依赖 volume；content 中的嵌入 ID 在阶段 2 重写）
  for (const c of bookData.chapters ?? []) {
    const payload = stripGenerated(c as unknown as Record<string, unknown>);
    const created = await chapterRepository.create({
      ...payload,
      bookId: newBookId,
      volumeId: remapId(idMaps.volumes, c.volumeId),
    } as unknown as Parameters<typeof chapterRepository.create>[0]);
    idMaps.chapters.set(c.id, created.id);
  }

  // 4. 剧情线（无依赖）
  for (const p of bookData.plotLines ?? []) {
    const payload = stripGenerated(p as unknown as Record<string, unknown>);
    const created = await plotLineRepository.create({
      ...payload,
      bookId: newBookId,
    } as unknown as Parameters<typeof plotLineRepository.create>[0]);
    idMaps.plotLines.set(p.id, created.id);
  }

  // 5. 世界观条目（relatedCharacterIds / relatedSceneIds 阶段 2 补齐）
  for (const w of bookData.worldview ?? []) {
    const payload = stripGenerated(w as unknown as Record<string, unknown>);
    const created = await worldviewRepository.create({
      ...payload,
      bookId: newBookId,
      relatedCharacterIds: [],
      relatedSceneIds: [],
    } as unknown as Parameters<typeof worldviewRepository.create>[0]);
    idMaps.worldview.set(w.id, created.id);
  }

  // 6. 角色（relatedWorldviewIds 阶段 2 补齐）
  for (const c of bookData.characters ?? []) {
    const payload = stripGenerated(c as unknown as Record<string, unknown>);
    const created = await characterRepository.create({
      ...payload,
      bookId: newBookId,
      relatedWorldviewIds: [],
    } as unknown as Parameters<typeof characterRepository.create>[0]);
    idMaps.characters.set(c.id, created.id);
  }

  // 7. 角色关系（依赖角色）
  for (const r of bookData.relations ?? []) {
    const payload = stripGenerated(r as unknown as Record<string, unknown>);
    await relationRepository.create({
      ...payload,
      bookId: newBookId,
      fromId: remapId(idMaps.characters, r.fromId) ?? r.fromId,
      toId: remapId(idMaps.characters, r.toId) ?? r.toId,
    } as unknown as Parameters<typeof relationRepository.create>[0]);
  }

  // 8. 剧情节点（依赖 plotLine / chapter；characterIds 阶段 2 补齐）
  for (const p of bookData.plotPoints ?? []) {
    const payload = stripGenerated(p as unknown as Record<string, unknown>);
    const created = await plotPointRepository.create({
      ...payload,
      bookId: newBookId,
      plotLineId: remapId(idMaps.plotLines, p.plotLineId) ?? p.plotLineId,
      chapterId: remapId(idMaps.chapters, p.chapterId),
      characterIds: [],
    } as unknown as Parameters<typeof plotPointRepository.create>[0]);
    idMaps.plotPoints.set(p.id, created.id);
  }

  // 9. 伏笔（依赖 chapter）
  for (const f of bookData.foreshadowing ?? []) {
    const payload = stripGenerated(f as unknown as Record<string, unknown>);
    await foreshadowingRepository.create({
      ...payload,
      bookId: newBookId,
      setupChapterId: remapId(idMaps.chapters, f.setupChapterId),
      payoffChapterId: remapId(idMaps.chapters, f.payoffChapterId),
    } as unknown as Parameters<typeof foreshadowingRepository.create>[0]);
  }

  // 10. 场景（worldviewEntryIds / characterIds / chapterIds 阶段 2 补齐）
  for (const s of bookData.scenes ?? []) {
    const payload = stripGenerated(s as unknown as Record<string, unknown>);
    const created = await sceneRepository.create({
      ...payload,
      bookId: newBookId,
      geography: remapId(idMaps.worldview, s.geography),
      worldviewEntryIds: [],
      characterIds: [],
      chapterIds: [],
    } as unknown as Parameters<typeof sceneRepository.create>[0]);
    idMaps.scenes.set(s.id, created.id);
  }

  // 11. 灵感卡片（无依赖）
  for (const i of bookData.inspiration ?? []) {
    const payload = stripGenerated(i as unknown as Record<string, unknown>);
    await inspirationRepository.create({
      ...payload,
      bookId: newBookId,
    } as unknown as Parameters<typeof inspirationRepository.create>[0]);
  }

  // 12. 写作记录（无依赖）
  for (const w of bookData.writingLogs ?? []) {
    const payload = stripGenerated(w as unknown as Record<string, unknown>);
    await writingLogRepository.create({
      ...payload,
      bookId: newBookId,
    } as unknown as Parameters<typeof writingLogRepository.create>[0]);
  }

  // ===== 阶段 2：PATCH 跨实体引用 =====

  // 1. 世界观：relatedCharacterIds / relatedSceneIds
  for (const w of bookData.worldview ?? []) {
    const newId = idMaps.worldview.get(w.id);
    if (!newId) continue;
    const newCharIds = remapIdArray(idMaps.characters, w.relatedCharacterIds);
    const newSceneIds = remapIdArray(idMaps.scenes, w.relatedSceneIds);
    if (newCharIds.length === 0 && newSceneIds.length === 0) continue;
    await worldviewRepository.update(newId, {
      relatedCharacterIds: newCharIds,
      relatedSceneIds: newSceneIds,
    } as unknown as Parameters<typeof worldviewRepository.update>[1]);
  }

  // 2. 角色：relatedWorldviewIds
  for (const c of bookData.characters ?? []) {
    const newId = idMaps.characters.get(c.id);
    if (!newId) continue;
    const newWvIds = remapIdArray(idMaps.worldview, c.relatedWorldviewIds);
    if (newWvIds.length === 0) continue;
    await characterRepository.update(newId, {
      relatedWorldviewIds: newWvIds,
    } as unknown as Parameters<typeof characterRepository.update>[1]);
  }

  // 3. 剧情节点：characterIds
  for (const p of bookData.plotPoints ?? []) {
    const newId = idMaps.plotPoints.get(p.id);
    if (!newId) continue;
    const newCharIds = remapIdArray(idMaps.characters, p.characterIds);
    if (newCharIds.length === 0) continue;
    await plotPointRepository.update(newId, {
      characterIds: newCharIds,
    } as unknown as Parameters<typeof plotPointRepository.update>[1]);
  }

  // 4. 场景：worldviewEntryIds / characterIds / chapterIds
  for (const s of bookData.scenes ?? []) {
    const newId = idMaps.scenes.get(s.id);
    if (!newId) continue;
    const newWvIds = remapIdArray(idMaps.worldview, s.worldviewEntryIds);
    const newCharIds = remapIdArray(idMaps.characters, s.characterIds);
    const newChapterIds = remapIdArray(idMaps.chapters, s.chapterIds);
    if (newWvIds.length === 0 && newCharIds.length === 0 && newChapterIds.length === 0) {
      continue;
    }
    await sceneRepository.update(newId, {
      worldviewEntryIds: newWvIds,
      characterIds: newCharIds,
      chapterIds: newChapterIds,
    } as unknown as Parameters<typeof sceneRepository.update>[1]);
  }

  // 5. 章节：content 中嵌入的实体 ID 重写
  for (const c of bookData.chapters ?? []) {
    if (!c.content) continue;
    const newId = idMaps.chapters.get(c.id);
    if (!newId) continue;
    const newContent = remapContentIds(c.content, idMaps);
    if (newContent !== c.content) {
      await chapterRepository.update(newId, { content: newContent });
    }
  }
}

/**
 * 级联删除指定作品及其全部关联实体。
 * 后端 Prisma schema 中所有关联实体均配置 onDelete: Cascade，
 * 只需删除作品本身即可触发级联删除。
 */
export async function deleteBookCascade(bookId: string): Promise<void> {
  await bookRepository.delete(bookId);
}
