/**
 * 角色页面
 *
 * 顶部欢迎区：大标题「角色 · 群英谱」+ 副文案。
 * 视图切换：角色列表 / 关系图谱 两个 Tab。
 * 数据：useBook 获取当前作品；useApiQuery 轮询当前作品的角色与关系。
 * 右上角「新建角色」按钮（primary 变体），两个视图下均显示。
 */
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, MessageSquare } from 'lucide-react';
import { characterRepository, relationRepository } from '../lib/repositories';
import { useApiQuery } from '../hooks/useApiQuery';
import { useBook } from '../hooks';
import type { Character, CharacterRelation } from '../types';
import { cn } from '../utils/cn';
import { Button, EmptyState, SkeletonGrid } from '../components/ui';
import { CharacterCard } from '../features/characters/CharacterCard';
import { CharacterForm } from '../features/characters/CharacterForm';
import { RelationGraph } from '../features/characters/RelationGraph';
import { DialogueGenerator } from '../features/characters/DialogueGenerator';

/** Tab 类型：角色列表 / 关系图谱 */
type CharactersTab = 'list' | 'graph';

/** Tab 配置 */
const TABS: ReadonlyArray<{ key: CharactersTab; label: string }> = [
  { key: 'list', label: '角色列表' },
  { key: 'graph', label: '关系图谱' },
];

/**
 * 角色页面：欢迎区 + Tab 切换 + 角色卡片网格 / 关系图谱。
 */
export default function CharactersPage() {
  const book = useBook();
  const bookId = book?.id ?? null;

  // 实时监听当前作品的角色（主角优先、updatedAt 倒序）
  const charactersData = useApiQuery<Character[]>(
    async () => {
      if (!bookId) return [];
      const list = await characterRepository.list(bookId);
      const roleOrder: Record<string, number> = {
        protagonist: 0,
        supporting: 1,
        antagonist: 2,
        minor: 3,
      };
      return list.sort((a, b) => {
        const ra = roleOrder[a.role] ?? 9;
        const rb = roleOrder[b.role] ?? 9;
        if (ra !== rb) return ra - rb;
        return (b.updatedAt ?? 0) - (a.updatedAt ?? 0);
      });
    },
    [bookId],
  );
  const characters = charactersData;

  // 实时监听当前作品的关系
  const relations = useApiQuery<CharacterRelation[]>(
    async () => (bookId ? relationRepository.list(bookId) : []),
    [bookId],
  ) ?? [];

  const [tab, setTab] = useState<CharactersTab>('list');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Character | null>(null);
  const [dialogueOpen, setDialogueOpen] = useState(false);

  /** 打开新建表单 */
  const handleNew = (): void => {
    setEditing(null);
    setFormOpen(true);
  };

  /** 打开编辑表单 */
  const handleEdit = (character: Character): void => {
    setEditing(character);
    setFormOpen(true);
  };

  /** 关闭表单 */
  const handleClose = (): void => {
    setFormOpen(false);
    setEditing(null);
  };

  /** 打开 AI 对话生成器 */
  const handleOpenDialogue = (): void => {
    setDialogueOpen(true);
  };

  const list = characters ?? [];
  const loading = characters === undefined;
  const isEmpty = !loading && list.length === 0;

  return (
    <div className="px-8 py-6">
      {/* 欢迎区 + 操作行 */}
      <header className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold tracking-wider text-foreground">
            角色
          </h1>
          <p className="mt-1.5 font-serif text-sm text-muted-foreground">
            管理角色档案、性格设定与关系图谱。
          </p>
        </div>

        {/* 操作按钮（右上角，两个视图均显示） */}
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="md"
            icon={<MessageSquare className="h-4 w-4" aria-hidden="true" />}
            onClick={handleOpenDialogue}
            disabled={!bookId || list.length === 0}
          >
            AI 对话
          </Button>
          <Button
            variant="primary"
            size="md"
            icon={<Plus className="h-4 w-4" aria-hidden="true" />}
            onClick={handleNew}
            disabled={!bookId}
          >
            新建角色
          </Button>
        </div>
      </header>

      {/* Tab 切换 */}
      <div
        className="mb-6 flex gap-6 border-b border-border/60"
        role="tablist"
        aria-label="角色视图切换"
      >
        {TABS.map((t) => {
          const active = t.key === tab;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.key)}
              className={cn(
                'relative px-1 pb-3 font-serif text-sm tracking-[2px]',
                'transition-colors duration-200 focus:outline-none',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
                active
                  ? 'font-semibold text-primary'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {t.label}
              {active && (
                <motion.span
                  layoutId="charActiveTabLine"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full"
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* 内容区 */}
      {!bookId ? (
        <EmptyState
          glyph="卷"
          title="尚未选择作品"
          description="请在项目页选择或创建一部作品后，再管理其角色档案。"
        />
      ) : loading ? (
        <SkeletonGrid count={6} minColumnWidth={220} />
      ) : tab === 'list' ? (
        isEmpty ? (
          <EmptyState
            glyph="侠"
            title="尚无角色入谱"
            description="江湖未启，群英待录。点击「新建角色」开始塑造你的第一位登场人物。"
            action={{ label: '新建角色', onClick: handleNew }}
          />
        ) : (
          <motion.div
            layout
            className="grid gap-4"
            style={{
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            }}
          >
            <AnimatePresence mode="popLayout">
              {list.map((character, i) => (
                <CharacterCard
                  key={character.id}
                  character={character}
                  index={i}
                  onClick={handleEdit}
                />
              ))}
            </AnimatePresence>
          </motion.div>
        )
      ) : (
        // 关系图谱视图
        <RelationGraph
          characters={list}
          relations={relations}
          onNodeClick={handleEdit}
        />
      )}

      {/* 角色档案编辑表单 */}
      {bookId && (
        <CharacterForm
          open={formOpen}
          onClose={handleClose}
          character={editing}
          bookId={bookId}
        />
      )}

      {/* AI 角色对话生成器 */}
      {bookId && (
        <DialogueGenerator
          open={dialogueOpen}
          onClose={() => setDialogueOpen(false)}
          characters={list}
          bookId={bookId}
        />
      )}
    </div>
  );
}
