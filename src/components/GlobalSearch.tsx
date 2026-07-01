/**
 * GlobalSearch 全局搜索命令面板
 *
 * 由 Ctrl/Cmd+K 或顶部搜索按钮唤起（状态由 useUIStore.globalSearchOpen 管理）。
 * - 全屏遮罩 + 居中搜索面板（宽度 600px）
 * - 使用 useLiveQuery 实时查询当前作品的全部实体
 * - 输入时按标题与内容（前 100 字符）包含匹配，分模块分组展示
 * - 每组最多 5 条；点击结果跳转到对应页面并关闭面板
 * - ESC 关闭；Framer Motion 入场动效（scale 0.95→1 + opacity）
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useLiveQuery } from 'dexie-react-hooks';
import { Search, CornerDownLeft } from 'lucide-react';
import { useBookStore, useUIStore } from '../stores';
import {
  chapterRepository,
  characterRepository,
  worldviewRepository,
  sceneRepository,
  plotLineRepository,
  plotPointRepository,
  inspirationRepository,
} from '../lib/repositories';
import { cn } from '../utils/cn';

/** 单条搜索结果 */
interface SearchResult {
  id: string;
  title: string;
  snippet: string;
  /** 点击后跳转的路由 */
  route: string;
}

/** 结果分组 */
interface ResultGroup {
  label: string;
  items: SearchResult[];
}

/** 实时查询返回的实体集合 */
interface BookEntities {
  chapters: Awaited<ReturnType<typeof chapterRepository.list>>;
  characters: Awaited<ReturnType<typeof characterRepository.list>>;
  worldview: Awaited<ReturnType<typeof worldviewRepository.list>>;
  scenes: Awaited<ReturnType<typeof sceneRepository.list>>;
  plotLines: Awaited<ReturnType<typeof plotLineRepository.list>>;
  plotPoints: Awaited<ReturnType<typeof plotPointRepository.list>>;
  inspiration: Awaited<ReturnType<typeof inspirationRepository.list>>;
}

/** 去除 HTML 标签并压缩空白，用于内容匹配与摘要展示 */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** 截取前 100 字符作为摘要 */
function snippetOf(content: string): string {
  const text = stripHtml(content);
  return text.length > 100 ? text.slice(0, 100) + '…' : text;
}

/** HTML 实体编码：防止用户输入的 < > & " ' 被解析为 HTML 节点（XSS 防护） */
function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      default: return '&#39;';
    }
  });
}

/**
 * 将文本中命中查询的部分用 <mark> 包裹（用于高亮显示）。
 * 安全性：先对 text 与 query 做 HTML 实体编码，再做正则替换，
 * 防止用户输入的 <script> 等被注入到 dangerouslySetInnerHTML 中。
 */
function highlight(text: string, query: string): string {
  const q = query.trim();
  const safeText = escapeHtml(text);
  if (!q) return safeText;
  // query 同样编码后再转义正则特殊字符，保证 < & 等也能正确匹配其编码形式
  const safeQuery = escapeHtml(q);
  const escaped = safeQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(${escaped})`, 'gi');
  return safeText.replace(re, '<mark class="bg-primary/20 text-primary rounded px-0.5">$1</mark>');
}

/**
 * 全局搜索命令面板。
 */
export default function GlobalSearch() {
  const navigate = useNavigate();
  const { globalSearchOpen, setGlobalSearchOpen } = useUIStore();
  const currentBookId = useBookStore((s) => s.currentBookId);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // 实时查询当前作品的全部实体；bookId 变化时自动重查
  const data = useLiveQuery(
    async (): Promise<BookEntities | null> => {
      if (!currentBookId) return null;
      const [
        chapters,
        characters,
        worldview,
        scenes,
        plotLines,
        plotPoints,
        inspiration,
      ] = await Promise.all([
        chapterRepository.list(currentBookId),
        characterRepository.list(currentBookId),
        worldviewRepository.list(currentBookId),
        sceneRepository.list(currentBookId),
        plotLineRepository.list(currentBookId),
        plotPointRepository.list(currentBookId),
        inspirationRepository.list(currentBookId),
      ]);
      return { chapters, characters, worldview, scenes, plotLines, plotPoints, inspiration };
    },
    [currentBookId],
  );

  // 打开时自动聚焦输入框，并重置查询
  useEffect(() => {
    if (globalSearchOpen) {
      setQuery('');
      // 延迟一帧聚焦，确保 DOM 已挂载
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  }, [globalSearchOpen]);

  // ESC 关闭
  useEffect(() => {
    if (!globalSearchOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setGlobalSearchOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [globalSearchOpen, setGlobalSearchOpen]);

  /** 根据查询字符串过滤并分组（每组最多 5 条） */
  const groups = useMemo<ResultGroup[]>(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    /** 匹配：查询为空时全部命中；否则标题或内容前 100 字符包含查询 */
    const match = (title: string, content: string): boolean => {
      if (!q) return true;
      return (
        title.toLowerCase().includes(q) ||
        stripHtml(content).slice(0, 100).toLowerCase().includes(q)
      );
    };
    /** 截取前 5 条 */
    const take5 = <T,>(arr: T[]): T[] => arr.slice(0, 5);

    const result: ResultGroup[] = [];

    // 章节
    const chapters = data.chapters
      .filter((c) => match(c.title, c.summary || c.content))
      .map((c) => ({
        id: c.id,
        title: highlight(c.title, query),
        snippet: highlight(snippetOf(c.summary || c.content), query),
        route: '/editor',
      }));
    if (chapters.length) result.push({ label: '章节', items: take5(chapters) });

    // 角色（含别名匹配）
    const characters = data.characters
      .filter((c) => {
        if (!q) return true;
        return (
          c.name.toLowerCase().includes(q) ||
          (c.alias ?? '').toLowerCase().includes(q) ||
          stripHtml(c.background || c.personality).slice(0, 100).toLowerCase().includes(q)
        );
      })
      .map((c) => ({
        id: c.id,
        title: highlight(c.alias ? `${c.name}（${c.alias}）` : c.name, query),
        snippet: highlight(snippetOf(c.background || c.personality), query),
        route: `/characters/${c.id}`,
      }));
    if (characters.length) result.push({ label: '角色', items: take5(characters) });

    // 世界观
    const worldview = data.worldview
      .filter((w) => match(w.title, w.content))
      .map((w) => ({
        id: w.id,
        title: highlight(w.title, query),
        snippet: highlight(snippetOf(w.content), query),
        route: '/worldview',
      }));
    if (worldview.length) result.push({ label: '世界观', items: take5(worldview) });

    // 场景
    const scenes = data.scenes
      .filter((s) => match(s.name, s.description))
      .map((s) => ({
        id: s.id,
        title: highlight(s.name, query),
        snippet: highlight(snippetOf(s.description), query),
        route: `/scenes/${s.id}`,
      }));
    if (scenes.length) result.push({ label: '场景', items: take5(scenes) });

    // 剧情：剧情线 + 剧情节点合并
    const plotLines = data.plotLines
      .filter((p) => match(p.title, p.synopsis))
      .map((p) => ({
        id: p.id,
        title: highlight(p.title, query),
        snippet: highlight(snippetOf(p.synopsis), query),
        route: '/plot',
      }));
    const plotPoints = data.plotPoints
      .filter((p) => match(p.title, p.description))
      .map((p) => ({
        id: p.id,
        title: highlight(p.title, query),
        snippet: highlight(snippetOf(p.description), query),
        route: '/plot',
      }));
    const plot = [...plotLines, ...plotPoints];
    if (plot.length) result.push({ label: '剧情', items: take5(plot) });

    // 灵感
    const inspiration = data.inspiration
      .filter((i) => match(i.title, i.content))
      .map((i) => ({
        id: i.id,
        title: highlight(i.title, query),
        snippet: highlight(snippetOf(i.content), query),
        route: '/inspiration',
      }));
    if (inspiration.length) result.push({ label: '灵感', items: take5(inspiration) });

    return result;
  }, [data, query]);

  /** 点击结果：跳转并关闭 */
  const handleSelect = (route: string) => {
    navigate(route);
    setGlobalSearchOpen(false);
  };

  return (
    <AnimatePresence>
      {globalSearchOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[12vh]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          role="dialog"
          aria-modal="true"
          aria-label="全局搜索"
        >
          {/* 遮罩层：点击关闭 */}
          <button
            type="button"
            className="absolute inset-0 cursor-default bg-black/40 backdrop-blur-sm"
            aria-hidden="true"
            tabIndex={-1}
            onClick={() => setGlobalSearchOpen(false)}
          />

          {/* 搜索面板 */}
          <motion.div
            className={cn(
              'relative z-10 flex max-h-[70vh] w-full flex-col overflow-hidden',
              'rounded-xl border border-border bg-background/95 backdrop-blur-md shadow-lifted',
            )}
            style={{ width: '560px', maxWidth: '100%' }}
            initial={{ opacity: 0, scale: 0.97, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -10 }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 搜索输入框 */}
            <div className="flex items-center gap-3.5 border-b border-border/60 px-5 py-4">
              <Search className="h-4 w-4 flex-shrink-0 text-primary" aria-hidden="true" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="搜索章节、角色、世界观、场景、剧情、灵感…"
                className={cn(
                  'flex-1 border-none bg-transparent font-serif text-base text-foreground outline-none',
                  'placeholder:text-muted-foreground focus:outline-none',
                )}
              />
              <kbd className="rounded border border-border/60 bg-muted/50 px-2 py-0.5 font-mono text-[12px] text-muted-foreground shadow-sm">
                ESC
              </kbd>
            </div>

            {/* 结果列表 */}
            <div className="flex-1 overflow-y-auto px-3 py-3">
              {groups.length === 0 ? (
                <div className="px-4 py-12 text-center font-serif text-sm text-muted-foreground">
                  {data === undefined
                    ? '记载检索中…'
                    : query.trim()
                      ? '未找到匹配的条目'
                      : '暂无可搜索的条目'}
                </div>
              ) : (
                groups.map((group) => (
                  <div key={group.label} className="mb-3 last:mb-0">
                    {/* 分组标题 */}
                    <div className="px-3 py-1 font-serif text-[10.5px] font-bold tracking-widest text-secondary uppercase">
                      {group.label}
                    </div>
                    {/* 分组条目 */}
                    <div className="mt-1 flex flex-col gap-0.5">
                      {group.items.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleSelect(item.route)}
                          className={cn(
                            'group/item flex w-full items-center gap-3.5 rounded-lg px-3 py-2 text-left',
                            'transition-all duration-150 hover:bg-primary/5',
                          )}
                        >
                          {/* 优雅小图标或前置标 */ }
                          <span className="flex h-5 w-5 items-center justify-center rounded bg-muted text-[12px] text-muted-foreground group-hover/item:bg-primary/10 group-hover/item:text-primary transition-colors">
                            {group.label.slice(0, 1)}
                          </span>
                          <div className="flex min-w-0 flex-1 flex-col">
                            <span
                              className="truncate text-[13px] font-medium text-foreground group-hover/item:text-primary transition-colors"
                              dangerouslySetInnerHTML={{ __html: item.title }}
                            />
                            {item.snippet && (
                              <span
                                className="truncate text-[10.5px] text-muted-foreground group-hover/item:text-muted-foreground transition-colors mt-0.5"
                                dangerouslySetInnerHTML={{ __html: item.snippet }}
                              />
                            )}
                          </div>
                          <CornerDownLeft
                            className="h-3 w-3 flex-shrink-0 text-muted-foreground group-hover/item:text-primary transition-colors"
                            aria-hidden="true"
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
