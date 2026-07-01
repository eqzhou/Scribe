/**
 * 引用检测工具
 *
 * 删除实体前调用，扫描所有引用该实体的其他实体，返回引用详情供 UI 层展示影响范围。
 * 简化处理：章节内容中的引用通过扫描 HTML 字符串中是否包含 entityId 来判定。
 */
import { db } from './db';

/** 引用检测结果：引用总数 + 详情列表 */
export interface ReferenceInfo {
  count: number;
  details: { type: string; id: string; title: string }[];
}

/** 引用详情条目 */
type Detail = { type: string; id: string; title: string };

/**
 * 检测指定实体被哪些实体引用。
 *
 * @param entityType 实体类型，如 'character' | 'worldview' | 'scene' | 'chapter' | 'volume' | 'plotLine'
 * @param entityId 实体 ID
 * @param bookId 所属作品 ID（限定扫描范围）
 */
export async function checkReferences(
  entityType: string,
  entityId: string,
  bookId: string,
): Promise<ReferenceInfo> {
  const details: Detail[] = [];

  switch (entityType) {
    case 'character':
      await checkCharacterReferences(entityId, bookId, details);
      break;
    case 'worldview':
      await checkWorldviewReferences(entityId, bookId, details);
      break;
    case 'scene':
      await checkSceneReferences(entityId, bookId, details);
      break;
    case 'chapter':
      await checkChapterReferences(entityId, bookId, details);
      break;
    case 'volume':
      await checkVolumeReferences(entityId, bookId, details);
      break;
    case 'plotLine':
      await checkPlotLineReferences(entityId, bookId, details);
      break;
    default:
      // 未知实体类型，不做引用检测
      break;
  }

  return { count: details.length, details };
}

/** 删除角色：扫描关系、章节内容、世界观、场景 */
async function checkCharacterReferences(
  entityId: string,
  bookId: string,
  details: Detail[],
): Promise<void> {
  // 1. 角色关系：fromId 或 toId 命中
  const relations = await db.relations
    .where('bookId')
    .equals(bookId)
    .and(r => r.fromId === entityId || r.toId === entityId)
    .toArray();
  relations.forEach(r => {
    details.push({ type: 'relation', id: r.id, title: r.description || r.type });
  });

  // 2. 章节内容：扫描 HTML 中是否包含角色 ID（CharacterMention 节点）
  const chapters = await db.chapters.where('bookId').equals(bookId).toArray();
  chapters.forEach(c => {
    if (c.content.includes(entityId)) {
      details.push({ type: 'chapter', id: c.id, title: c.title });
    }
  });

  // 3. 世界观条目：relatedCharacterIds 命中
  const worldviews = await db.worldview.where('bookId').equals(bookId).toArray();
  worldviews.forEach(w => {
    if (w.relatedCharacterIds?.includes(entityId)) {
      details.push({ type: 'worldview', id: w.id, title: w.title });
    }
  });

  // 4. 场景：characterIds 命中
  const scenes = await db.scenes.where('bookId').equals(bookId).toArray();
  scenes.forEach(s => {
    if (s.characterIds?.includes(entityId)) {
      details.push({ type: 'scene', id: s.id, title: s.name });
    }
  });
}

/**
 * 删除世界观条目：扫描角色、场景、章节内容。
 *
 * 注意：Character 类型中未声明 relatedWorldviewIds 字段，但 WorldviewEntry 有
 * relatedCharacterIds（worldview → character 单向引用）。此处做双向检测：
 *  - 反向：扫描角色是否引用该世界观（防御性检查，当前类型无此字段）
 *  - 正向：扫描该世界观自身的 relatedCharacterIds，关联的角色会受影响
 */
async function checkWorldviewReferences(
  entityId: string,
  bookId: string,
  details: Detail[],
): Promise<void> {
  // 1. 反向扫描角色：防御性检查 relatedWorldviewIds 字段（当前类型未声明，未来可能扩展）
  const characters = await db.characters.where('bookId').equals(bookId).toArray();
  const reportedCharIds = new Set<string>();
  characters.forEach(c => {
    const relatedWorldviewIds = (c as unknown as { relatedWorldviewIds?: string[] })
      .relatedWorldviewIds;
    if (Array.isArray(relatedWorldviewIds) && relatedWorldviewIds.includes(entityId)) {
      details.push({ type: 'character', id: c.id, title: c.name });
      reportedCharIds.add(c.id);
    }
  });

  // 2. 正向扫描：世界观自身的 relatedCharacterIds 指向的角色会因删除而失去关联
  const worldview = await db.worldview.get(entityId);
  if (worldview?.relatedCharacterIds?.length) {
    const linkedChars = await db.characters
      .where('id')
      .anyOf(worldview.relatedCharacterIds)
      .toArray();
    linkedChars.forEach(c => {
      if (!reportedCharIds.has(c.id)) {
        details.push({ type: 'character', id: c.id, title: c.name });
        reportedCharIds.add(c.id);
      }
    });
  }

  // 3. 场景：worldviewEntryIds 命中
  const scenes = await db.scenes.where('bookId').equals(bookId).toArray();
  scenes.forEach(s => {
    if (s.worldviewEntryIds?.includes(entityId)) {
      details.push({ type: 'scene', id: s.id, title: s.name });
    }
  });

  // 4. 章节内容：扫描 HTML 中是否包含世界观 ID（WorldviewRef 节点）
  const chapters = await db.chapters.where('bookId').equals(bookId).toArray();
  chapters.forEach(c => {
    if (c.content.includes(entityId)) {
      details.push({ type: 'chapter', id: c.id, title: c.title });
    }
  });
}

/** 删除场景：扫描章节内容、世界观（relatedSceneIds） */
async function checkSceneReferences(
  entityId: string,
  bookId: string,
  details: Detail[],
): Promise<void> {
  // 1. 章节内容：扫描 HTML 中是否包含场景 ID（场景引用节点）
  const chapters = await db.chapters.where('bookId').equals(bookId).toArray();
  chapters.forEach(c => {
    if (c.content.includes(entityId)) {
      details.push({ type: 'chapter', id: c.id, title: c.title });
    }
  });

  // 2. 世界观条目：relatedSceneIds 命中
  const worldviews = await db.worldview.where('bookId').equals(bookId).toArray();
  worldviews.forEach(w => {
    if (w.relatedSceneIds?.includes(entityId)) {
      details.push({ type: 'worldview', id: w.id, title: w.title });
    }
  });
}

/** 删除章节：扫描剧情节点、伏笔 */
async function checkChapterReferences(
  entityId: string,
  bookId: string,
  details: Detail[],
): Promise<void> {
  // 1. 剧情节点：chapterId 命中
  const plotPoints = await db.plotPoints
    .where('bookId')
    .equals(bookId)
    .and(p => p.chapterId === entityId)
    .toArray();
  plotPoints.forEach(p => {
    details.push({ type: 'plotPoint', id: p.id, title: p.title });
  });

  // 2. 伏笔：setupChapterId 或 payoffChapterId 命中
  const foreshadowing = await db.foreshadowing
    .where('bookId')
    .equals(bookId)
    .and(f => f.setupChapterId === entityId || f.payoffChapterId === entityId)
    .toArray();
  foreshadowing.forEach(f => {
    details.push({ type: 'foreshadowing', id: f.id, title: f.title });
  });
}

/** 删除卷宗：扫描章节（volumeId 命中） */
async function checkVolumeReferences(
  entityId: string,
  bookId: string,
  details: Detail[],
): Promise<void> {
  const chapters = await db.chapters
    .where('bookId')
    .equals(bookId)
    .and(c => c.volumeId === entityId)
    .toArray();
  chapters.forEach(c => {
    details.push({ type: 'chapter', id: c.id, title: c.title });
  });
}

/** 删除剧情线：扫描剧情节点（plotLineId 命中） */
async function checkPlotLineReferences(
  entityId: string,
  bookId: string,
  details: Detail[],
): Promise<void> {
  const plotPoints = await db.plotPoints
    .where('bookId')
    .equals(bookId)
    .and(p => p.plotLineId === entityId)
    .toArray();
  plotPoints.forEach(p => {
    details.push({ type: 'plotPoint', id: p.id, title: p.title });
  });
}
