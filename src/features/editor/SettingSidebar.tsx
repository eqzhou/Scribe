/**
 * SettingSidebar 设定侧栏
 *
 * 右侧抽屉：三 Tab（角色 / 世界观 / 场景），对齐 uiStore.settingSidebarTab。
 * useLiveQuery 查当前作品设定列表，卡片列表展示（名称 + 简介）。
 * 点击展开/折叠详情，再点击跳转对应详情页。
 */
import { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Search, ChevronDown, ExternalLink } from 'lucide-react';
import { db } from '../../lib/db';
import { useUIStore } from '../../stores';
import type { Character, Scene, SettingSidebarTab, WorldviewEntry } from '../../types';
import { cn } from '../../utils/cn';
import { AIPanel } from './AIPanel';

export interface SettingSidebarProps {
  bookId: string;
}

/** Tab 配置 */
const TABS: ReadonlyArray<{ key: SettingSidebarTab; label: string; icon?: typeof Sparkles }> = [
  { key: 'character', label: '角色' },
  { key: 'worldview', label: '世界观' },
  { key: 'scene', label: '场景' },
  { key: 'ai', label: 'AI', icon: Sparkles },
];

/**
 * 设定侧栏：三 Tab 切换 + 设定卡片列表。
 */
export function SettingSidebar({ bookId }: SettingSidebarProps) {
  const tab = useUIStore((s) => s.settingSidebarTab);
  const setTab = useUIStore((s) => s.setSettingSidebarTab);
  const [searchQuery, setSearchQuery] = useState('');

  // 实时监听三类设定
  const characters = useLiveQuery(
    async () => {
      if (!bookId) return [] as Character[];
      return db.characters.where('bookId').equals(bookId).toArray();
    },
    [bookId],
    [],
  );
  const worldviewEntries = useLiveQuery(
    async () => {
      if (!bookId) return [] as WorldviewEntry[];
      return db.worldview.where('bookId').equals(bookId).toArray();
    },
    [bookId],
    [],
  );
  const scenes = useLiveQuery(
    async () => {
      if (!bookId) return [] as Scene[];
      return db.scenes.where('bookId').equals(bookId).toArray();
    },
    [bookId],
    [],
  );

  // 搜索过滤
  const filteredCharacters = useMemo(() => {
    if (!searchQuery.trim()) return characters ?? [];
    const q = searchQuery.toLowerCase();
    return (characters ?? []).filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.alias?.toLowerCase().includes(q) ||
        c.faction?.toLowerCase().includes(q) ||
        c.personality?.toLowerCase().includes(q) ||
        c.tags?.some((t) => t.toLowerCase().includes(q)),
    );
  }, [characters, searchQuery]);

  const filteredWorldview = useMemo(() => {
    if (!searchQuery.trim()) return worldviewEntries ?? [];
    const q = searchQuery.toLowerCase();
    return (worldviewEntries ?? []).filter(
      (w) =>
        w.title.toLowerCase().includes(q) ||
        w.content.replace(/<[^>]+>/g, '').toLowerCase().includes(q) ||
        w.tags?.some((t) => t.toLowerCase().includes(q)),
    );
  }, [worldviewEntries, searchQuery]);

  const filteredScenes = useMemo(() => {
    if (!searchQuery.trim()) return scenes ?? [];
    const q = searchQuery.toLowerCase();
    return (scenes ?? []).filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.description?.toLowerCase().includes(q) ||
        s.atmosphere?.some((t) => t.toLowerCase().includes(q)),
    );
  }, [scenes, searchQuery]);

  return (
    <aside className="flex h-full w-[280px] flex-col border-l border-border bg-muted/50">
      {/* Tab 切换 */}
      <div
        className="flex border-b border-border"
        role="tablist"
        aria-label="设定侧栏切换"
      >
        {TABS.map((t) => {
          const active = t.key === tab;
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.key)}
              className={cn(
                'flex flex-1 items-center justify-center gap-1 border-b-2 px-1 py-2.5 text-xs tracking-[2px]',
                'transition-all duration-200',
                active
                  ? 'border-primary font-semibold text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {Icon && <Icon className="h-3 w-3" aria-hidden="true" />}
              {t.label}
            </button>
          );
        })}
      </div>

      {/* 内容区 */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {tab === 'ai' ? (
          <AIPanel bookId={bookId} />
        ) : (
          <>
            {/* 搜索框 */}
            <div className="border-b border-border/60 bg-background/50 p-2">
              <div className="relative">
                <Search
                  className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="搜索..."
                  className="w-full rounded-md border border-border bg-background py-1.5 pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-secondary/50 focus:outline-none"
                  aria-label="搜索设定"
                />
              </div>
            </div>

            {/* 列表区 */}
            <div className="flex-1 overflow-y-auto p-3">
              {tab === 'character' && (
                <CharacterList characters={filteredCharacters} />
              )}
              {tab === 'worldview' && (
                <WorldviewList entries={filteredWorldview} />
              )}
              {tab === 'scene' && <SceneList scenes={filteredScenes} />}
            </div>
          </>
        )}
      </div>
    </aside>
  );
}

/** 角色列表 */
function CharacterList({ characters }: { characters: Character[] }) {
  const navigate = useNavigate();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedId((prev) => (prev === id ? null : id));
  };

  if (characters.length === 0) {
    return <EmptyHint text="暂无角色" />;
  }
  return (
    <ul className="flex flex-col gap-2">
      {characters.map((c, i) => {
        const isExpanded = expandedId === c.id;
        return (
          <motion.li
            key={c.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
          >
            <div
              className={cn(
                'w-full overflow-hidden rounded border border-border bg-background text-left transition-all hover:border-secondary hover:shadow-soft',
                isExpanded && 'border-secondary/60 shadow-soft',
              )}
            >
              {/* 头部 - 点击展开/折叠 */}
              <button
                type="button"
                onClick={(e) => toggleExpand(c.id, e)}
                className="flex w-full items-center gap-2 px-3 py-2"
              >
                <span
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-brush text-xs text-white"
                  style={{ background: c.appearanceColor || '#3d4a3d' }}
                  aria-hidden="true"
                >
                  {c.name.slice(0, 1)}
                </span>
                <span className="min-w-0 flex-1">
                  <div className="flex items-center gap-1">
                    <span className="truncate font-serif text-sm font-medium text-foreground">
                      {c.name}
                    </span>
                    {c.alias && (
                      <span className="truncate text-[12px] text-muted-foreground">
                        · {c.alias}
                      </span>
                    )}
                  </div>
                  {c.personality && !isExpanded && (
                    <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                      {c.personality}
                    </p>
                  )}
                </span>
                <ChevronDown
                  className={cn(
                    'h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200',
                    isExpanded && 'rotate-180',
                  )}
                  aria-hidden="true"
                />
              </button>

              {/* 展开详情 */}
              <AnimatePresence initial={false}>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: 'easeInOut' }}
                    className="overflow-hidden"
                  >
                    <div className="border-t border-border/60 px-3 py-2.5 space-y-2">
                      {c.faction && (
                        <div className="flex items-start gap-2">
                          <span className="shrink-0 text-[12px] text-muted-foreground w-10">
                            阵营
                          </span>
                          <span className="text-xs text-foreground">
                            {c.faction}
                          </span>
                        </div>
                      )}
                      {c.personality && (
                        <div className="flex items-start gap-2">
                          <span className="shrink-0 text-[12px] text-muted-foreground w-10">
                            性格
                          </span>
                          <span className="text-xs text-foreground">
                            {c.personality}
                          </span>
                        </div>
                      )}
                      {c.tags && c.tags.length > 0 && (
                        <div className="flex items-start gap-2">
                          <span className="shrink-0 text-[12px] text-muted-foreground w-10">
                            标签
                          </span>
                          <div className="flex flex-wrap gap-1">
                            {c.tags.map((tag) => (
                              <span
                                key={tag}
                                className="rounded-full bg-muted px-1.5 py-0.5 text-[12px] text-muted-foreground"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => navigate(`/characters/${c.id}`)}
                        className="mt-1 flex w-full items-center justify-center gap-1 rounded-md bg-primary/5 py-1.5 text-[11px] text-primary hover:bg-primary/10 transition-colors"
                      >
                        <ExternalLink className="h-3 w-3" aria-hidden="true" />
                        查看详情
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.li>
        );
      })}
    </ul>
  );
}

/** 世界观列表 */
function WorldviewList({ entries }: { entries: WorldviewEntry[] }) {
  const navigate = useNavigate();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const getPlainText = (html: string) => html.replace(/<[^>]+>/g, '');

  if (entries.length === 0) {
    return <EmptyHint text="暂无世界观条目" />;
  }
  return (
    <ul className="flex flex-col gap-2">
      {entries.map((w, i) => {
        const isExpanded = expandedId === w.id;
        const plainText = getPlainText(w.content);
        const summary = plainText.slice(0, 200);
        return (
          <motion.li
            key={w.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
          >
            <div
              className={cn(
                'w-full overflow-hidden rounded border border-border bg-background text-left transition-all hover:border-secondary hover:shadow-soft',
                isExpanded && 'border-secondary/60 shadow-soft',
              )}
            >
              {/* 头部 */}
              <button
                type="button"
                onClick={(e) => toggleExpand(w.id, e)}
                className="flex w-full items-start gap-2 px-3 py-2"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-serif text-sm font-medium text-foreground">
                    {w.title}
                  </span>
                  {!isExpanded && plainText && (
                    <p
                      className="mt-1 text-[11px] text-muted-foreground"
                      style={{
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {plainText || '暂无内容'}
                    </p>
                  )}
                </span>
                <ChevronDown
                  className={cn(
                    'h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200 mt-0.5',
                    isExpanded && 'rotate-180',
                  )}
                  aria-hidden="true"
                />
              </button>

              {/* 展开详情 */}
              <AnimatePresence initial={false}>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: 'easeInOut' }}
                    className="overflow-hidden"
                  >
                    <div className="border-t border-border/60 px-3 py-2.5 space-y-2">
                      <div className="flex items-start gap-2">
                        <span className="shrink-0 text-[12px] text-muted-foreground w-10">
                          摘要
                        </span>
                        <p className="flex-1 text-xs text-foreground leading-relaxed">
                          {summary || '暂无内容'}
                          {plainText.length > 200 && '...'}
                        </p>
                      </div>
                      {w.tags && w.tags.length > 0 && (
                        <div className="flex items-start gap-2">
                          <span className="shrink-0 text-[12px] text-muted-foreground w-10">
                            标签
                          </span>
                          <div className="flex flex-wrap gap-1">
                            {w.tags.map((tag) => (
                              <span
                                key={tag}
                                className="rounded-full bg-muted px-1.5 py-0.5 text-[12px] text-muted-foreground"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => navigate(`/worldview/${w.category}/${w.id}`)}
                        className="mt-1 flex w-full items-center justify-center gap-1 rounded-md bg-primary/5 py-1.5 text-[11px] text-primary hover:bg-primary/10 transition-colors"
                      >
                        <ExternalLink className="h-3 w-3" aria-hidden="true" />
                        查看详情
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.li>
        );
      })}
    </ul>
  );
}

/** 场景列表 */
function SceneList({ scenes }: { scenes: Scene[] }) {
  const navigate = useNavigate();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedId((prev) => (prev === id ? null : id));
  };

  if (scenes.length === 0) {
    return <EmptyHint text="暂无场景" />;
  }
  return (
    <ul className="flex flex-col gap-2">
      {scenes.map((s, i) => {
        const isExpanded = expandedId === s.id;
        return (
          <motion.li
            key={s.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
          >
            <div
              className={cn(
                'w-full overflow-hidden rounded border border-border bg-background text-left transition-all hover:border-secondary hover:shadow-soft',
                isExpanded && 'border-secondary/60 shadow-soft',
              )}
            >
              {/* 头部 */}
              <button
                type="button"
                onClick={(e) => toggleExpand(s.id, e)}
                className="flex w-full items-start gap-2 px-3 py-2"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-serif text-sm font-medium text-foreground">
                    {s.name}
                  </span>
                  {!isExpanded && s.atmosphere.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {s.atmosphere.slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full bg-muted px-1.5 py-0.5 text-[12px] text-muted-foreground"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </span>
                <ChevronDown
                  className={cn(
                    'h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200 mt-0.5',
                    isExpanded && 'rotate-180',
                  )}
                  aria-hidden="true"
                />
              </button>

              {/* 展开详情 */}
              <AnimatePresence initial={false}>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: 'easeInOut' }}
                    className="overflow-hidden"
                  >
                    <div className="border-t border-border/60 px-3 py-2.5 space-y-2">
                      {s.atmosphere.length > 0 && (
                        <div className="flex items-start gap-2">
                          <span className="shrink-0 text-[12px] text-muted-foreground w-10">
                            氛围
                          </span>
                          <div className="flex flex-wrap gap-1">
                            {s.atmosphere.map((tag) => (
                              <span
                                key={tag}
                                className="rounded-full bg-muted px-1.5 py-0.5 text-[12px] text-muted-foreground"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {s.description && (
                        <div className="flex items-start gap-2">
                          <span className="shrink-0 text-[12px] text-muted-foreground w-10">
                            描述
                          </span>
                          <p className="flex-1 text-xs text-foreground leading-relaxed">
                            {s.description}
                          </p>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => navigate(`/scenes/${s.id}`)}
                        className="mt-1 flex w-full items-center justify-center gap-1 rounded-md bg-primary/5 py-1.5 text-[11px] text-primary hover:bg-primary/10 transition-colors"
                      >
                        <ExternalLink className="h-3 w-3" aria-hidden="true" />
                        查看详情
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.li>
        );
      })}
    </ul>
  );
}

/** 空提示 */
function EmptyHint({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
      <p className="text-xs text-muted-foreground">{text}</p>
    </div>
  );
}

export default SettingSidebar;
