import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { fileSegmentIdentity, isValidFileSegment } from '../lib/fileStore.js';

const shortText = z.string().trim().min(1).max(120);
const optionalReference = z.string().trim().max(120).transform((value) => value || undefined).optional();
const longText = z.string().trim().max(5000);
const tags = z.array(z.string().trim().min(1).max(50)).max(8);

const blueprintSchema = z.object({
  worldview: z.array(z.object({
    category: z.enum(['geography', 'history', 'faction', 'system', 'culture', 'item']),
    title: shortText,
    content: longText,
    tags,
  })).max(12),
  characters: z.array(z.object({
    name: shortText,
    alias: z.string().trim().max(120).optional(),
    faction: z.string().trim().max(120).optional(),
    role: z.enum(['protagonist', 'supporting', 'antagonist', 'minor']),
    appearance: longText,
    personality: longText,
    background: longText,
    arc: longText,
    tags,
    relatedWorldviewTitles: z.array(shortText).max(8),
  })).max(12),
  scenes: z.array(z.object({
    name: shortText,
    description: longText,
    atmosphere: tags,
    characterNames: z.array(shortText).max(8),
    worldviewTitles: z.array(shortText).max(8),
    chapterTitles: z.array(shortText).max(8),
  })).max(16),
  plotLines: z.array(z.object({
    title: shortText,
    type: z.enum(['main', 'sub']),
    synopsis: longText,
    status: z.literal('planning'),
    order: z.number().int().min(0).max(1000),
  })).max(4),
  plotPoints: z.array(z.object({
    plotLineTitle: shortText,
    title: shortText,
    description: longText,
    chapterTitle: optionalReference,
    characterNames: z.array(shortText).max(8),
    order: z.number().int().min(0).max(1000),
    timelineOrder: z.number().int().min(0).max(1000),
  })).max(24),
  inspirations: z.array(z.object({
    title: shortText,
    content: longText,
    tags,
    category: z.string().trim().min(1).max(80),
  })).max(16),
  foreshadowing: z.array(z.object({
    title: shortText,
    description: longText,
    setupChapterTitle: optionalReference,
    payoffChapterTitle: optionalReference,
    status: z.literal('pending').optional(),
  })).max(12),
  chapters: z.array(z.object({
    title: shortText,
    summary: longText,
    outline: longText,
    order: z.number().int().min(0).max(1000),
  })).max(32),
}).superRefine((blueprint, ctx) => {
  const references = {
    chapters: new Set(blueprint.chapters.map((item) => item.title)),
    characters: new Set(blueprint.characters.map((item) => item.name)),
    worldview: new Set(blueprint.worldview.map((item) => item.title)),
    plotLines: new Set(blueprint.plotLines.map((item) => item.title)),
  };
  const total = Object.values(blueprint).reduce((sum, items) => sum + items.length, 0);
  if (total === 0) {
    ctx.addIssue({ code: 'custom', message: '蓝图至少需要保留一个条目' });
  }

  const addUnknown = (path: Array<string | number>, message: string) => {
    ctx.addIssue({ code: 'custom', path, message });
  };
  const ensureUnique = (values: string[], path: string, message: string) => {
    const seen = new Set<string>();
    values.forEach((value, index) => {
      if (seen.has(value)) ctx.addIssue({ code: 'custom', path: [path, index], message });
      seen.add(value);
    });
  };
  ensureUnique(blueprint.chapters.map((item) => item.title), 'chapters', '章节标题不能重复');
  ensureUnique(
    blueprint.chapters.map((item) => fileSegmentIdentity(item.title)),
    'chapters',
    '章节标题在文件系统中不能重复',
  );
  ensureUnique(blueprint.characters.map((item) => item.name), 'characters', '角色名称不能重复');
  ensureUnique(blueprint.scenes.map((item) => item.name), 'scenes', '场景名称不能重复');
  ensureUnique(blueprint.plotLines.map((item) => item.title), 'plotLines', '剧情线标题不能重复');
  ensureUnique(blueprint.worldview.map((item) => item.title), 'worldview', '世界观标题不能重复');
  blueprint.characters.forEach((item, index) => {
    item.relatedWorldviewTitles.forEach((title) => {
      if (!references.worldview.has(title)) addUnknown(['characters', index, 'relatedWorldviewTitles'], '角色引用了已移除的世界观');
    });
  });
  blueprint.scenes.forEach((item, index) => {
    item.characterNames.forEach((name) => {
      if (!references.characters.has(name)) addUnknown(['scenes', index, 'characterNames'], '场景引用了已移除的角色');
    });
    item.worldviewTitles.forEach((title) => {
      if (!references.worldview.has(title)) addUnknown(['scenes', index, 'worldviewTitles'], '场景引用了已移除的世界观');
    });
    item.chapterTitles.forEach((title) => {
      if (!references.chapters.has(title)) addUnknown(['scenes', index, 'chapterTitles'], '场景引用了已移除的章节');
    });
  });
  blueprint.plotPoints.forEach((item, index) => {
    if (!references.plotLines.has(item.plotLineTitle)) addUnknown(['plotPoints', index, 'plotLineTitle'], '剧情节点引用了已移除的剧情线');
    if (item.chapterTitle && !references.chapters.has(item.chapterTitle)) addUnknown(['plotPoints', index, 'chapterTitle'], '剧情节点引用了已移除的章节');
    item.characterNames.forEach((name) => {
      if (!references.characters.has(name)) addUnknown(['plotPoints', index, 'characterNames'], '剧情节点引用了已移除的角色');
    });
  });
  blueprint.foreshadowing.forEach((item, index) => {
    if (item.setupChapterTitle && !references.chapters.has(item.setupChapterTitle)) addUnknown(['foreshadowing', index, 'setupChapterTitle'], '伏笔引用了已移除的章节');
    if (item.payoffChapterTitle && !references.chapters.has(item.payoffChapterTitle)) addUnknown(['foreshadowing', index, 'payoffChapterTitle'], '伏笔引用了已移除的章节');
  });
});

export const blueprintImportSchema = z.object({
  book: z.object({
    title: z.string().trim().min(1).max(60).refine(isValidFileSegment, '作品标题包含文件系统不支持的字符'),
    subtitle: z.string().trim().max(60),
    synopsis: z.string().trim().max(500),
    genre: z.string().trim().min(1).max(50),
    targetWords: z.number().int().min(1).max(100_000_000),
    coverColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    dailyGoal: z.number().int().min(1).max(100_000),
  }),
  blueprint: blueprintSchema,
}).superRefine((input, ctx) => {
  input.blueprint.chapters.forEach((chapter, index) => {
    if (!isValidFileSegment(chapter.title)) {
      ctx.addIssue({
        code: 'custom',
        path: ['blueprint', 'chapters', index, 'title'],
        message: '章节标题包含文件系统不支持的字符',
      });
    }
  });
});

export type BlueprintImportInput = z.infer<typeof blueprintImportSchema>;

export class BlueprintImportConflictError extends Error {}

function plainTextToHtml(text: string): string {
  const escape = (value: string) => value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
  const paragraphs = text.split(/\n+/).map((part) => part.trim()).filter(Boolean);
  return paragraphs.length > 0 ? paragraphs.map((part) => `<p>${escape(part)}</p>`).join('') : '<p></p>';
}

export async function createBookFromBlueprint(userId: string, input: BlueprintImportInput) {
  return prisma.$transaction(async (tx) => {
    const { book: bookInput, blueprint } = input;
    const existingBooks = await tx.book.findMany({
      where: { userId },
      select: { title: true },
    });
    const bookPathIdentity = fileSegmentIdentity(bookInput.title);
    if (existingBooks.some((item) => fileSegmentIdentity(item.title) === bookPathIdentity)) {
      throw new BlueprintImportConflictError('已存在文件路径相同的作品标题');
    }
    const book = await tx.book.create({ data: { ...bookInput, userId } });
    const summary = {
      worldview: 0,
      characters: 0,
      scenes: 0,
      plotLines: 0,
      plotPoints: 0,
      inspirations: 0,
      foreshadowing: 0,
      chapters: 0,
    };

    const worldviewIds = new Map<string, string>();
    for (const item of blueprint.worldview) {
      const created = await tx.worldviewEntry.create({
        data: {
          userId, bookId: book.id, category: item.category, title: item.title,
          content: plainTextToHtml(item.content), tags: item.tags,
          relatedCharacterIds: [], relatedSceneIds: [],
        },
      });
      worldviewIds.set(item.title, created.id);
      summary.worldview++;
    }

    const characterIds = new Map<string, string>();
    for (const item of blueprint.characters) {
      const created = await tx.character.create({
        data: {
          userId, bookId: book.id, name: item.name, alias: item.alias ?? '', faction: item.faction ?? '',
          role: item.role, appearance: item.appearance, personality: item.personality,
          background: item.background, arc: item.arc, tags: item.tags, appearanceColor: '#7a8ca0',
          relatedWorldviewIds: item.relatedWorldviewTitles.map((title) => worldviewIds.get(title)!),
        },
      });
      characterIds.set(item.name, created.id);
      summary.characters++;
    }

    const chapterIds = new Map<string, string>();
    for (const item of blueprint.chapters) {
      const created = await tx.chapter.create({
        data: {
          userId, bookId: book.id, title: item.title, summary: item.summary,
          outline: item.outline, status: 'draft', wordCount: 0, order: item.order,
        },
      });
      chapterIds.set(item.title, created.id);
      summary.chapters++;
    }

    const sceneIds = new Map<string, string>();
    for (const item of blueprint.scenes) {
      const created = await tx.scene.create({
        data: {
          userId, bookId: book.id, name: item.name, description: item.description,
          atmosphere: item.atmosphere,
          worldviewEntryIds: item.worldviewTitles.map((title) => worldviewIds.get(title)!),
          characterIds: item.characterNames.map((name) => characterIds.get(name)!),
          chapterIds: item.chapterTitles.map((title) => chapterIds.get(title)!),
        },
      });
      sceneIds.set(item.name, created.id);
      summary.scenes++;
    }

    for (const item of blueprint.worldview) {
      const worldviewId = worldviewIds.get(item.title)!;
      const relatedCharacterIds = blueprint.characters
        .filter((character) => character.relatedWorldviewTitles.includes(item.title))
        .map((character) => characterIds.get(character.name)!);
      const relatedSceneIds = blueprint.scenes
        .filter((scene) => scene.worldviewTitles.includes(item.title))
        .map((scene) => sceneIds.get(scene.name)!);
      await tx.worldviewEntry.update({
        where: { id: worldviewId },
        data: { relatedCharacterIds, relatedSceneIds },
      });
    }

    const plotLineIds = new Map<string, string>();
    for (const item of blueprint.plotLines) {
      const created = await tx.plotLine.create({
        data: { userId, bookId: book.id, ...item },
      });
      plotLineIds.set(item.title, created.id);
      summary.plotLines++;
    }

    for (const item of blueprint.plotPoints) {
      await tx.plotPoint.create({
        data: {
          userId, bookId: book.id, plotLineId: plotLineIds.get(item.plotLineTitle)!,
          title: item.title, description: item.description,
          chapterId: item.chapterTitle ? chapterIds.get(item.chapterTitle) : null,
          characterIds: item.characterNames.map((name) => characterIds.get(name)!),
          order: item.order, timelineOrder: item.timelineOrder,
        },
      });
      summary.plotPoints++;
    }

    for (const item of blueprint.inspirations) {
      await tx.inspiration.create({
        data: { userId, bookId: book.id, title: item.title, content: item.content, tags: item.tags, category: item.category },
      });
      summary.inspirations++;
    }

    for (const item of blueprint.foreshadowing) {
      await tx.foreshadowing.create({
        data: {
          userId, bookId: book.id, title: item.title, description: item.description,
          setupChapterId: item.setupChapterTitle ? chapterIds.get(item.setupChapterTitle) : null,
          payoffChapterId: item.payoffChapterTitle ? chapterIds.get(item.payoffChapterTitle) : null,
          status: 'pending',
        },
      });
      summary.foreshadowing++;
    }

    return { book, summary };
  }, { maxWait: 5_000, timeout: 30_000 });
}
