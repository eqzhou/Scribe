/**
 * AI 写作工具：构建上下文 + 封装任务执行
 *
 * 从 Dexie DB 拉取当前作品的角色、世界观、剧情等数据，
 * 构造 AIContext 供 aiClient 使用。
 */
import { db } from './db';
import type {
  AIContext,
  OutlineItem,
  RewriteStyle,
  WorldviewBatchItem,
  CharacterGenerateResult,
  CharacterExtractItem,
} from '../types/ai';
import {
  streamContinue,
  streamRewrite,
  streamOutline,
  streamFulltext,
  streamDialogue,
  streamWorldview,
  streamWorldviewBatch,
  streamCharacterGenerate,
  streamCharacterExtract,
} from './aiClient';
import { useToastStore } from '../stores';
import { worldviewRepository, characterRepository } from './repositories';
import type { WorldviewCategory, CharacterRole } from '../types';

/** 合法的世界观分类白名单（用于校验 AI 返回值） */
const VALID_WV_CATEGORIES: ReadonlySet<string> = new Set([
  'geography',
  'history',
  'faction',
  'system',
  'culture',
  'item',
]);

/** 合法的角色类型白名单 */
const VALID_ROLES: ReadonlySet<string> = new Set([
  'protagonist',
  'supporting',
  'antagonist',
  'minor',
]);

/** 从作品 ID 构建 AI 上下文（角色 + 世界观摘要） */
export async function buildAIContext(
  bookId: string,
  bookTitle: string,
  synopsis: string,
): Promise<AIContext> {
  const [characters, worldview] = await Promise.all([
    db.characters.where('bookId').equals(bookId).toArray(),
    db.worldview.where('bookId').equals(bookId).toArray(),
  ]);

  return {
    bookTitle,
    synopsis,
    characters: characters.map((c: { name: string; role: string; personality: string }) => ({
      name: c.name,
      role: c.role,
      personality: c.personality,
    })),
    worldview: worldview.map((w: { title: string; content: string }) => ({
      title: w.title,
      content: w.content.replace(/<[^>]+>/g, '').slice(0, 200),
    })),
  };
}

/** 编辑器最小类型：仅声明所需字段 */
interface EditorLike {
  state: {
    selection: { from: number; to: number };
    doc: {
      content: { size: number };
      textBetween: (from: number, to: number, blockSeparator?: string) => string;
    };
  };
}

/** 获取编辑器中光标之前的文本（用于续写） */
export function getTextBeforeCursor(editor: EditorLike): string {
  const { from } = editor.state.selection;
  const start = Math.max(0, from - 1500); // 取最近 1500 字作为上下文
  return editor.state.doc.textBetween(start, from, '\n');
}

/** 获取编辑器中光标之后的文本（用于续写衔接） */
export function getTextAfterCursor(editor: EditorLike): string {
  const { to } = editor.state.selection;
  const docSize = editor.state.doc.content.size;
  const end = Math.min(docSize, to + 500);
  return editor.state.doc.textBetween(to, end, '\n');
}

/**
 * 执行续写任务并流式插入 ghost 文本。
 *
 * @param editor TipTap editor 实例
 * @param bookId 作品 ID
 * @param chapterId 章节 ID
 * @param bookTitle 书名
 * @param synopsis 简介
 * @param signal 取消信号
 */
export async function executeContinue(
  editor: EditorLike & {
    commands: {
      insertAIGhostText: (text?: string) => boolean;
      setGhostText: (text: string) => boolean;
      acceptGhostText: () => boolean;
      rejectGhostText: () => boolean;
    };
  },
  bookId: string,
  chapterId: string,
  bookTitle: string,
  synopsis: string,
  signal?: AbortSignal,
): Promise<string> {
  const context = await buildAIContext(bookId, bookTitle, synopsis);
  const beforeText = getTextBeforeCursor(editor);
  const afterText = getTextAfterCursor(editor);

  // 先插入空 ghost 节点
  editor.commands.insertAIGhostText('');

  let full = '';
  await streamContinue(
    { bookId, chapterId, beforeText, afterText, context },
    (chunk) => {
      full += chunk;
      editor.commands.setGhostText(full);
    },
    (finalText) => {
      full = finalText;
    },
    (err) => {
      editor.commands.rejectGhostText();
      useToastStore.getState().pushToast('error', `AI 续写失败：${err.message}`);
      throw err;
    },
    signal,
  );

  return full;
}

/**
 * 执行改写任务。
 *
 * 改写结果替换选中文本：先插入 ghost 文本，接受后替换原选区。
 */
export async function executeRewrite(
  editor: EditorLike & {
    commands: {
      insertAIGhostText: (text?: string) => boolean;
      setGhostText: (text: string) => boolean;
      acceptGhostText: () => boolean;
      rejectGhostText: () => boolean;
    };
  },
  selectedText: string,
  action: 'rewrite' | 'polish' | 'expand',
  style: RewriteStyle | undefined,
  bookId: string,
  bookTitle: string,
  synopsis: string,
  signal?: AbortSignal,
): Promise<string> {
  const context = await buildAIContext(bookId, bookTitle, synopsis);
  editor.commands.insertAIGhostText('');

  let full = '';
  await streamRewrite(
    { text: selectedText, action, style, context },
    (chunk) => {
      full += chunk;
      editor.commands.setGhostText(full);
    },
    (finalText) => {
      full = finalText;
    },
    (err) => {
      editor.commands.rejectGhostText();
      useToastStore.getState().pushToast('error', `AI ${action}失败：${err.message}`);
      throw err;
    },
    signal,
  );

  return full;
}

/**
 * 执行大纲生成任务（非流式拼接 JSON）。
 */
export async function executeOutline(
  bookId: string,
  volumeTitle: string | undefined,
  plotPoints: Array<{ title: string; description: string }>,
  characters: AIContext['characters'],
  worldview: AIContext['worldview'],
  chapterCount: number,
  signal?: AbortSignal,
): Promise<OutlineItem[]> {
  return new Promise((resolve, reject) => {
    streamOutline(
      { bookId, volumeTitle, plotPoints, characters, worldview, chapterCount },
      () => {},
      (items) => {
        resolve(items);
      },
      (err) => {
        useToastStore.getState().pushToast('error', `AI 大纲生成失败：${err.message}`);
        reject(err);
      },
      signal,
    );
  });
}

/**
 * 执行全文生成任务并流式返回（通用版，通过 onChunk 回调）。
 */
export async function executeFulltext(
  bookId: string,
  chapterTitle: string,
  outline: string,
  bookTitle: string,
  synopsis: string,
  onChunk: (text: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  const context = await buildAIContext(bookId, bookTitle, synopsis);
  let full = '';
  await streamFulltext(
    { bookId, chapterTitle, outline, context },
    (chunk) => {
      full += chunk;
      onChunk(chunk);
    },
    (finalText) => {
      full = finalText;
    },
    (err) => {
      useToastStore.getState().pushToast('error', `AI 全文生成失败：${err.message}`);
      throw err;
    },
    signal,
  );
  return full;
}

/**
 * 执行全文生成任务并流式插入 ghost 文本（编辑器版）。
 *
 * 参考 executeContinue 模式：先在光标处或末尾插入空 ghost 节点，
 * 然后流式更新 ghost 文本，用户可 Tab 接受 / Esc 拒绝。
 *
 * @param editor TipTap editor 实例
 * @param bookId 作品 ID
 * @param chapterId 章节 ID
 * @param chapterTitle 章节标题
 * @param outline 大纲提示词
 * @param bookTitle 书名
 * @param synopsis 简介
 * @param signal 取消信号
 */
export async function executeFulltextEditor(
  editor: EditorLike & {
    commands: {
      insertAIGhostText: (text?: string) => boolean;
      setGhostText: (text: string) => boolean;
      acceptGhostText: () => boolean;
      rejectGhostText: () => boolean;
    };
  },
  bookId: string,
  _chapterId: string,
  chapterTitle: string,
  outline: string,
  bookTitle: string,
  synopsis: string,
  signal?: AbortSignal,
): Promise<string> {
  const context = await buildAIContext(bookId, bookTitle, synopsis);

  editor.commands.insertAIGhostText('');

  let full = '';
  await streamFulltext(
    { bookId, chapterTitle, outline, context },
    (chunk) => {
      full += chunk;
      editor.commands.setGhostText(full);
    },
    (finalText) => {
      full = finalText;
    },
    (err) => {
      editor.commands.rejectGhostText();
      useToastStore.getState().pushToast('error', `AI 全文生成失败：${err.message}`);
      throw err;
    },
    signal,
  );

  return full;
}

/**
 * 执行角色对话生成任务。
 */
export async function executeDialogue(
  character: { name: string; personality: string; background: string },
  scene: string,
  topic: string,
  otherCharacters: Array<{ name: string; personality: string }>,
  onChunk: (text: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  let full = '';
  await streamDialogue(
    { character, scene, topic, otherCharacters },
    (chunk) => {
      full += chunk;
      onChunk(chunk);
    },
    (finalText) => {
      full = finalText;
    },
    (err) => {
      useToastStore.getState().pushToast('error', `AI 对话生成失败：${err.message}`);
      throw err;
    },
    signal,
  );
  return full;
}

/**
 * 执行世界观构建任务。
 */
export async function executeWorldview(
  category: string,
  topic: string,
  existing: Array<{ title: string; content: string }>,
  onChunk: (text: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  let full = '';
  await streamWorldview(
    { category, topic, existing },
    (chunk) => {
      full += chunk;
      onChunk(chunk);
    },
    (finalText) => {
      full = finalText;
    },
    (err) => {
      useToastStore.getState().pushToast('error', `AI 世界观构建失败：${err.message}`);
      throw err;
    },
    signal,
  );
  return full;
}

/**
 * 执行批量世界观构建任务，并把结果直接写入 db.worldview 表。
 *
 * 用于作品创建时一键生成 6 大分类的初始世界观。
 * 返回入库后的 WorldviewEntry 数组。
 */
export async function executeWorldviewBatch(
  bookId: string,
  bookTitle: string,
  synopsis: string,
  genre: string,
  onProgress?: (text: string) => void,
  signal?: AbortSignal,
): Promise<number> {
  return new Promise((resolve, reject) => {
    streamWorldviewBatch(
      { bookTitle, synopsis, genre },
      (chunk) => onProgress?.(chunk),
      async (items: WorldviewBatchItem[]) => {
        try {
          if (!items || items.length === 0) {
            useToastStore.getState().pushToast('warning', 'AI 未返回有效世界观条目');
            resolve(0);
            return;
          }
          let inserted = 0;
          for (const item of items) {
            // 校验 category 合法性
            const category = VALID_WV_CATEGORIES.has(item.category)
              ? (item.category as WorldviewCategory)
              : 'culture';
            // content 包装为 HTML 段落
            const htmlContent = `<p>${(item.content || '').split(/\n/).filter(Boolean).join('</p><p>')}</p>`;
            await worldviewRepository.create({
              bookId,
              category,
              title: item.title || '未命名条目',
              content: htmlContent,
              tags: Array.isArray(item.tags) ? item.tags.slice(0, 6) : [],
              relatedCharacterIds: [],
              relatedSceneIds: [],
            });
            inserted++;
          }
          useToastStore.getState().pushToast('success', `已生成 ${inserted} 个世界观条目`);
          resolve(inserted);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          useToastStore.getState().pushToast('error', `世界观入库失败：${msg}`);
          reject(err);
        }
      },
      (err) => {
        useToastStore.getState().pushToast('error', `AI 批量世界观生成失败：${err.message}`);
        reject(err);
      },
      signal,
    );
  });
}

/**
 * 执行角色生成任务，返回 CharacterGenerateResult（不入库，由调用方决定）。
 *
 * 用于 CharacterForm 的"AI 生成"按钮：基于用户 prompt 填充表单字段。
 */
export async function executeCharacterGenerate(
  prompt: string,
  bookId: string,
  bookTitle: string,
  synopsis: string,
  genre: string,
  onProgress?: (text: string) => void,
  signal?: AbortSignal,
): Promise<CharacterGenerateResult | null> {
  // 拉取已有角色列表用于上下文
  const existing = await db.characters.where('bookId').equals(bookId).toArray();
  return new Promise((resolve, reject) => {
    streamCharacterGenerate(
      {
        prompt,
        bookTitle,
        synopsis,
        genre,
        existingCharacters: existing.map((c) => ({ name: c.name, role: c.role })),
      },
      (chunk) => onProgress?.(chunk),
      (result) => {
        if (!result) {
          useToastStore.getState().pushToast('warning', 'AI 未返回有效角色档案');
        }
        resolve(result);
      },
      (err) => {
        useToastStore.getState().pushToast('error', `AI 角色生成失败：${err.message}`);
        reject(err);
      },
      signal,
    );
  });
}

/**
 * 执行角色提取任务，从章节正文提取未入库的角色并写入 db.characters 表。
 *
 * 用于章节 AI 全文生成完成后自动触发：比对已有角色名，仅入库新角色。
 * 返回新入库的角色数。
 */
export async function executeCharacterExtract(
  bookId: string,
  chapterTitle: string,
  chapterContent: string,
  onProgress?: (text: string) => void,
  signal?: AbortSignal,
): Promise<number> {
  const existing = await db.characters.where('bookId').equals(bookId).toArray();
  const existingNames = new Set(existing.map((c) => c.name));
  if (existing.length > 0) {
    // 把别名也加入比对集合
    for (const c of existing) {
      if (c.alias) existingNames.add(c.alias);
    }
  }

  return new Promise((resolve, reject) => {
    streamCharacterExtract(
      {
        chapterTitle,
        chapterContent,
        existingCharacters: existing.map((c) => ({ name: c.name, alias: c.alias })),
      },
      (chunk) => onProgress?.(chunk),
      async (items: CharacterExtractItem[]) => {
        try {
          if (!items || items.length === 0) {
            resolve(0);
            return;
          }
          let inserted = 0;
          for (const item of items) {
            // 跳过同名已有角色
            if (!item.name || existingNames.has(item.name)) continue;
            const role = VALID_ROLES.has(item.role)
              ? (item.role as CharacterRole)
              : 'supporting';
            await characterRepository.create({
              bookId,
              name: item.name,
              alias: '',
              faction: '',
              role,
              appearance: item.appearance || '',
              personality: item.personality || '',
              background: item.background || '',
              arc: '',
              tags: [],
              relatedWorldviewIds: [],
              appearanceColor: '#7a8ca0',
            });
            existingNames.add(item.name);
            inserted++;
          }
          if (inserted > 0) {
            useToastStore.getState().pushToast(
              'success',
              `已从本章提取 ${inserted} 个新角色入库`,
            );
          }
          resolve(inserted);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          useToastStore.getState().pushToast('error', `角色入库失败：${msg}`);
          reject(err);
        }
      },
      (err) => {
        useToastStore.getState().pushToast('error', `AI 角色提取失败：${err.message}`);
        reject(err);
      },
      signal,
    );
  });
}
