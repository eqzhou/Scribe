/**
 * SettingSidebar 设定侧栏
 *
 * 右侧抽屉：三 Tab（角色 / 世界观 / 场景），对齐 uiStore.settingSidebarTab。
 * useLiveQuery 查当前作品设定列表，卡片列表展示（名称 + 简介）。
 * 点击展开/折叠详情，再点击跳转对应详情页。
 */
import { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Sparkles, Search } from 'lucide-react';
import { db } from '../../lib/db';
import { useUIStore } from '../../stores';
import type { Character, Scene, SettingSidebarTab, WorldviewEntry } from '../../types';
import { cn } from '../../utils/cn';
import { AIPanel } from './AIPanel';
import { CharacterList } from './SettingSidebar/CharacterList';
import { WorldviewList } from './SettingSidebar/WorldviewList';
import { SceneList } from './SettingSidebar/SceneList';

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

export default SettingSidebar;
