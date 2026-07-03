/**
 * AIPanel AI 助手侧栏面板
 *
 * 在编辑器右栏提供三种 AI 创作辅助：
 * - 角色对话：选择角色 + 场景 + 话题，AI 生成符合性格的对话
 * - 世界观构建：输入分类 + 主题，AI 扩展世界观条目
 * - 章节大纲：基于剧情节点生成多章大纲
 *
 * 结果以流式文本展示，可一键插入到编辑器或复制。
 */
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, MessageSquare, Globe, ListTree, Loader2, Copy, Check } from 'lucide-react';
import { characterRepository, worldviewRepository, plotPointRepository } from '../../lib/repositories';
import { useApiQuery } from '../../hooks/useApiQuery';
import { useAIStore, useToastStore } from '../../stores';
import { executeDialogue, executeWorldview, executeOutline } from '../../lib/aiTools';
import type { Character, WorldviewCategory } from '../../types';
import { cn } from '../../utils/cn';

type AITab = 'dialogue' | 'worldview' | 'outline';

const AI_TABS: ReadonlyArray<{ key: AITab; label: string; icon: typeof Sparkles }> = [
  { key: 'dialogue', label: '角色对话', icon: MessageSquare },
  { key: 'worldview', label: '世界观', icon: Globe },
  { key: 'outline', label: '章节大纲', icon: ListTree },
];

const WORLDVIEW_CATEGORIES: ReadonlyArray<{ value: WorldviewCategory; label: string }> = [
  { value: 'geography', label: '地理' },
  { value: 'history', label: '历史' },
  { value: 'faction', label: '阵营' },
  { value: 'system', label: '体系' },
  { value: 'culture', label: '文化' },
  { value: 'item', label: '物品' },
];

export interface AIPanelProps {
  bookId: string;
}

export function AIPanel({ bookId }: AIPanelProps) {
  const [tab, setTab] = useState<AITab>('dialogue');
  const { status, streamText } = useAIStore();
  const pushToast = useToastStore((s) => s.pushToast);
  const [copied, setCopied] = useState(false);
  const aiBusy = status === 'loading' || status === 'streaming';

  const handleCopy = async (): Promise<void> => {
    if (!streamText) return;
    try {
      await navigator.clipboard.writeText(streamText);
      setCopied(true);
      pushToast('success', '已复制到剪贴板');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      pushToast('error', '复制失败');
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* 子 Tab 切换 */}
      <div className="flex border-b border-border" role="tablist" aria-label="AI 助手切换">
        {AI_TABS.map((t) => {
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
                'flex flex-1 items-center justify-center gap-1 border-b-2 px-1 py-2.5 text-xs tracking-[1px]',
                'transition-all duration-200',
                active
                  ? 'border-primary font-semibold text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon className="h-3 w-3" aria-hidden="true" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* 内容区 */}
      <div className="flex-1 overflow-y-auto p-3">
        {tab === 'dialogue' && <DialogueForm bookId={bookId} aiBusy={aiBusy} />}
        {tab === 'worldview' && <WorldviewForm bookId={bookId} aiBusy={aiBusy} />}
        {tab === 'outline' && <OutlineForm bookId={bookId} aiBusy={aiBusy} />}

        {/* 流式输出展示 */}
        {streamText && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-3 rounded border border-secondary/30 bg-secondary/5 p-3"
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1 text-[11px] text-secondary">
                <Sparkles className="h-3 w-3" aria-hidden="true" />
                AI 输出
                {aiBusy && <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />}
              </span>
              {!aiBusy && (
                <button
                  type="button"
                  onClick={handleCopy}
                  className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[12px] text-muted-foreground hover:bg-foreground/5"
                  aria-label="复制结果"
                >
                  {copied ? (
                    <Check className="h-3 w-3" aria-hidden="true" />
                  ) : (
                    <Copy className="h-3 w-3" aria-hidden="true" />
                  )}
                  {copied ? '已复制' : '复制'}
                </button>
              )}
            </div>
            <pre className="whitespace-pre-wrap break-words text-xs leading-relaxed text-foreground">
              {streamText}
            </pre>
          </motion.div>
        )}
      </div>
    </div>
  );
}

/** 角色对话生成表单 */
function DialogueForm({ bookId, aiBusy }: { bookId: string; aiBusy: boolean }) {
  const pushToast = useToastStore((s) => s.pushToast);
  const [characterId, setCharacterId] = useState('');
  const [scene, setScene] = useState('');
  const [topic, setTopic] = useState('');

  const characters = useApiQuery<Character[]>(
    async () => (bookId ? characterRepository.list(bookId) : []),
    [bookId],
  ) ?? [];

  const handleGenerate = async (): Promise<void> => {
    if (!characterId) {
      pushToast('warning', '请选择角色');
      return;
    }
    if (!topic.trim()) {
      pushToast('warning', '请输入对话话题');
      return;
    }
    const character = characters.find((c) => c.id === characterId);
    if (!character) return;

    try {
      await executeDialogue(
        {
          name: character.name,
          personality: character.personality,
          background: character.background,
        },
        scene || '未指定场景',
        topic,
        characters
          .filter((c) => c.id !== characterId)
          .slice(0, 3)
          .map((c) => ({ name: c.name, personality: c.personality })),
        () => {},
      );
    } catch {
      // 错误已在 executeDialogue 内通过 toast 提示
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <Field label="角色">
        <select
          value={characterId}
          onChange={(e) => setCharacterId(e.target.value)}
          className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs text-foreground focus:border-secondary focus:outline-none"
        >
          <option value="">选择角色…</option>
          {characters.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="场景（可选）">
        <input
          type="text"
          value={scene}
          onChange={(e) => setScene(e.target.value)}
          placeholder="如：雨夜客栈"
          className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs text-foreground focus:border-secondary focus:outline-none"
        />
      </Field>
      <Field label="话题">
        <input
          type="text"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="如：询问师父下落"
          className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs text-foreground focus:border-secondary focus:outline-none"
        />
      </Field>
      <GenerateButton onClick={handleGenerate} busy={aiBusy} />
    </div>
  );
}

/** 世界观构建表单 */
function WorldviewForm({ bookId, aiBusy }: { bookId: string; aiBusy: boolean }) {
  const pushToast = useToastStore((s) => s.pushToast);
  const [category, setCategory] = useState<WorldviewCategory>('geography');
  const [topic, setTopic] = useState('');

  const existing = useApiQuery(
    async () => (bookId ? worldviewRepository.list(bookId) : []),
    [bookId],
  ) ?? [];

  const handleGenerate = async (): Promise<void> => {
    if (!topic.trim()) {
      pushToast('warning', '请输入主题');
      return;
    }
    try {
      await executeWorldview(
        category,
        topic,
        existing.map((w) => ({ title: w.title, content: w.content.replace(/<[^>]+>/g, '').slice(0, 100) })),
        () => {},
      );
    } catch {
      // 错误已在 executeWorldview 内通过 toast 提示
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <Field label="分类">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as WorldviewCategory)}
          className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs text-foreground focus:border-secondary focus:outline-none"
        >
          {WORLDVIEW_CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="主题">
        <input
          type="text"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="如：北境雪原的势力格局"
          className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs text-foreground focus:border-secondary focus:outline-none"
        />
      </Field>
      <GenerateButton onClick={handleGenerate} busy={aiBusy} />
    </div>
  );
}

/** 章节大纲生成表单 */
function OutlineForm({ bookId, aiBusy }: { bookId: string; aiBusy: boolean }) {
  const pushToast = useToastStore((s) => s.pushToast);
  const [chapterCount, setChapterCount] = useState(5);

  const plotPoints = useApiQuery(
    async () => (bookId ? plotPointRepository.list(bookId) : []),
    [bookId],
  ) ?? [];

  const characters = useApiQuery<Character[]>(
    async () => (bookId ? characterRepository.list(bookId) : []),
    [bookId],
  ) ?? [];

  const worldview = useApiQuery(
    async () => (bookId ? worldviewRepository.list(bookId) : []),
    [bookId],
  ) ?? [];

  const handleGenerate = async (): Promise<void> => {
    if (plotPoints.length === 0) {
      pushToast('warning', '请先在剧情页创建剧情节点');
      return;
    }
    try {
      const items = await executeOutline(
        bookId,
        undefined,
        plotPoints.map((p) => ({ title: p.title, description: p.description })),
        characters.map((c) => ({ name: c.name, role: c.role, personality: c.personality })),
        worldview.map((w) => ({ title: w.title, content: w.content.replace(/<[^>]+>/g, '').slice(0, 200) })),
        chapterCount,
      );
      pushToast('success', `已生成 ${items.length} 章大纲`);
    } catch {
      // 错误已在 executeOutline 内通过 toast 提示
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="rounded border border-border/60 bg-muted/40 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
        基于剧情页的 {plotPoints.length} 个节点 + {characters.length} 个角色，生成 {chapterCount} 章大纲。
      </div>
      <Field label={`章节数：${chapterCount}`}>
        <input
          type="range"
          min="3"
          max="20"
          step="1"
          value={chapterCount}
          onChange={(e) => setChapterCount(Number(e.target.value))}
          className="w-full accent-primary"
        />
      </Field>
      <GenerateButton onClick={handleGenerate} busy={aiBusy} label="生成大纲" />
    </div>
  );
}

/** 表单字段容器 */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

/** 生成按钮 */
function GenerateButton({
  onClick,
  busy,
  label = '生成',
}: {
  onClick: () => void | Promise<void>;
  busy: boolean;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className={cn(
        'mt-1 flex items-center justify-center gap-1.5 rounded border border-primary/40 bg-primary/5 px-3 py-2',
        'text-xs font-medium text-primary transition-all',
        'hover:bg-primary/10 hover:shadow-soft',
        'disabled:cursor-not-allowed disabled:opacity-50',
      )}
    >
      {busy ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
      ) : (
        <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
      )}
      {busy ? '生成中…' : label}
    </button>
  );
}

export default AIPanel;
