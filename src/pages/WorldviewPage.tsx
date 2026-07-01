/**
 * 世界观页面
 *
 * 双栏布局：左侧 200px 分类导航 + 右侧内容区。
 * 视图切换：卡片视图 / 图谱视图。
 * 顶部欢迎区：大标题「世界观」+ 副文案。
 *
 * 数据：useBook 获取当前作品；useLiveQuery 监听当前作品的全部世界观条目、
 * 角色、场景。卡片视图按分类聚合计数与列表。图谱视图展示关联关系。
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import { useBook } from '../hooks';
import type {
  Character,
  Scene,
  WorldviewCategory,
  WorldviewEntry,
} from '../types';
import { cn } from '../utils/cn';
import { EmptyState, SkeletonCard } from '../components/ui';
import {
  CategoryNav,
  type CategoryCounts,
} from '../features/worldview/CategoryNav';
import { EntryCard } from '../features/worldview/EntryCard';
import { EntryEditor } from '../features/worldview/EntryEditor';
import { WorldviewGraph } from '../features/worldview/WorldviewGraph';

type WorldviewView = 'card' | 'graph';

/** 分类顺序：用于查找首个有数据的分类 */
const CATEGORY_ORDER: WorldviewCategory[] = [
  'geography',
  'history',
  'faction',
  'system',
  'culture',
  'item',
];

/** 空状态毛笔字 glyph 按分类映射 */
const CATEGORY_GLYPH: Record<WorldviewCategory, string> = {
  geography: '山',
  history: '史',
  faction: '派',
  system: '术',
  culture: '俗',
  item: '物',
};

/** 分类中文名映射 */
const CATEGORY_LABEL: Record<WorldviewCategory, string> = {
  geography: '地理',
  history: '历史',
  faction: '势力',
  system: '体系',
  culture: '文化',
  item: '物品',
};

/** 构造全 0 计数对象 */
function emptyCounts(): CategoryCounts {
  return {
    geography: 0,
    history: 0,
    faction: 0,
    system: 0,
    culture: 0,
    item: 0,
  };
}

export default function WorldviewPage() {
  const bookId = useBook()?.id ?? null;

  const entries = useLiveQuery(
    async () => {
      if (!bookId) return [];
      return db.worldview.where('bookId').equals(bookId).toArray();
    },
    [bookId],
  );

  const characters = useLiveQuery(
    async () => {
      if (!bookId) return [] as Character[];
      return db.characters.where('bookId').equals(bookId).toArray();
    },
    [bookId],
    [] as Character[],
  );

  const scenes = useLiveQuery(
    async () => {
      if (!bookId) return [] as Scene[];
      return db.scenes.where('bookId').equals(bookId).toArray();
    },
    [bookId],
    [] as Scene[],
  );

  const { counts, byCategory } = useMemo(() => {
    const counts = emptyCounts();
    const byCategory: Record<WorldviewCategory, WorldviewEntry[]> = {
      geography: [],
      history: [],
      faction: [],
      system: [],
      culture: [],
      item: [],
    };
    for (const e of entries ?? []) {
      counts[e.category] = (counts[e.category] ?? 0) + 1;
      byCategory[e.category].push(e);
    }
    for (const cat of Object.keys(byCategory) as WorldviewCategory[]) {
      byCategory[cat].sort((a, b) => b.updatedAt - a.updatedAt);
    }
    return { counts, byCategory };
  }, [entries]);

  const [active, setActive] = useState<WorldviewCategory>('geography');
  const didInitRef = useRef(false);
  useEffect(() => {
    if (entries === undefined) {
      didInitRef.current = false;
      return;
    }
    if (didInitRef.current) return;
    didInitRef.current = true;
    if (counts[active] > 0) return;
    const firstWithData = CATEGORY_ORDER.find((cat) => counts[cat] > 0);
    if (firstWithData) {
      setActive(firstWithData);
    }
  }, [counts, active, entries]);

  const [view, setView] = useState<WorldviewView>('card');

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<WorldviewEntry | null>(null);

  const handleNew = (): void => {
    setEditingEntry(null);
    setEditorOpen(true);
  };

  const handleEdit = (entry: WorldviewEntry): void => {
    setEditingEntry(entry);
    setEditorOpen(true);
  };

  const handleClose = (): void => {
    setEditorOpen(false);
    setEditingEntry(null);
  };

  const loading = entries === undefined;
  const currentList = byCategory[active] ?? [];
  const currentLabel = CATEGORY_LABEL[active];
  const entryList = entries ?? [];
  const charList = characters ?? [];
  const sceneList = scenes ?? [];

  return (
    <div className="px-8 py-6">
      <header className="mb-6">
      <h1 className="font-serif text-3xl font-bold tracking-wider text-foreground">
        世界观
      </h1>
      <p className="mt-1.5 font-serif text-sm text-muted-foreground">
        管理地理、历史、势力、文化等世界设定。
      </p>
    </header>

      <div className="mb-6 flex gap-6 border-b border-border/60">
        {([
          { key: 'card', label: '卡片视图' },
          { key: 'graph', label: '图谱视图' },
        ] as const).map((t) => {
          const activeView = t.key === view;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setView(t.key)}
              className={cn(
                'relative px-1 pb-3 font-serif text-sm tracking-[2px]',
                'transition-colors duration-200 focus:outline-none',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
                activeView
                  ? 'font-semibold text-primary'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {t.label}
              {activeView && (
                <motion.span
                  layoutId="worldviewActiveTabLine"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full"
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
            </button>
          );
        })}
      </div>

      {view === 'card' ? (
        <div
          className="grid gap-6"
          style={{ gridTemplateColumns: '200px 1fr' }}
        >
          <CategoryNav
            active={active}
            onChange={setActive}
            counts={counts}
            onNew={handleNew}
          />

          <section aria-label={`${currentLabel}条目列表`}>
            {loading ? (
              <div
                className="grid gap-4"
                style={{
                  gridTemplateColumns:
                    'repeat(auto-fill, minmax(260px, 1fr))',
                }}
              >
                {Array.from({ length: 6 }).map((_, i) => (
                  <SkeletonCard key={i} coverHeight={120} />
                ))}
              </div>
            ) : currentList.length === 0 ? (
              <EmptyState
                glyph={CATEGORY_GLYPH[active]}
                title={`尚无${currentLabel}条目`}
                description={`构建你的世界，从一处${currentLabel}开始。点击「新建条目」记录设定。`}
                action={{ label: `新建${currentLabel}条目`, onClick: handleNew }}
              />
            ) : (
              <div
                className="grid gap-4"
                style={{
                  gridTemplateColumns:
                    'repeat(auto-fill, minmax(260px, 1fr))',
                }}
              >
                {currentList.map((entry) => (
                  <EntryCard
                    key={entry.id}
                    entry={entry}
                    onClick={handleEdit}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      ) : (
        <section aria-label="世界观关联图谱">
          {loading ? (
            <div
              className="grid gap-4"
              style={{
                gridTemplateColumns:
                  'repeat(auto-fill, minmax(260px, 1fr))',
              }}
            >
              {Array.from({ length: 6 }).map((_, i) => (
                <SkeletonCard key={i} coverHeight={120} />
              ))}
            </div>
          ) : (
            <WorldviewGraph
              entries={entryList}
              characters={charList}
              scenes={sceneList}
              onEntryClick={handleEdit}
            />
          )}
        </section>
      )}

      {bookId && (
        <EntryEditor
          open={editorOpen}
          onClose={handleClose}
          entry={editingEntry}
          category={active}
          bookId={bookId}
        />
      )}
    </div>
  );
}
