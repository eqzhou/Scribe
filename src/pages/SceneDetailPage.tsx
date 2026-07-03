/**
 * 场景详情页
 *
 * 展示完整场景信息，参考 WorldviewPage 的页面布局风格。
 * 路由：/scenes/:id
 *
 * 页面结构：
 * - 顶部欢迎区：场景名 + 所属世界 + 返回按钮
 * - 场景描述：富文本内容（从 Scene.content 渲染，用 dangerouslySetInnerHTML）
 * - 氛围标签：标签胶囊展示
 * - 关联角色：角色头像+姓名列表，点击跳转到角色页
 * - 关联世界观：世界观条目卡片列表
 * - 出现章节：章节列表，点击跳转到编辑器对应章节
 * - 编辑按钮：右上角编辑按钮，打开 SceneForm 弹窗
 */
import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Pencil, Users, Globe, BookOpen } from 'lucide-react';
import {
  sceneRepository,
  characterRepository,
  worldviewRepository,
  chapterRepository,
} from '../lib/repositories';
import { useApiQuery } from '../hooks/useApiQuery';
import { useBook } from '../hooks';
import type { Scene, Character, WorldviewEntry, Chapter } from '../types';
import { cn } from '../utils/cn';
import { Button, Tag, EmptyState, Skeleton } from '../components/ui';
import { SceneForm } from '../features/scenes/SceneForm';

const ATMOSPHERE_COLORS: ReadonlyArray<{ from: string; to: string }> = [
  { from: '#3d4a3d', to: '#1a2a1a' },
  { from: '#c8553d', to: '#8a3528' },
  { from: '#b08d57', to: '#8a6d3a' },
  { from: '#3a322a', to: '#1a1612' },
  { from: '#5a4a6d', to: '#3a2a4d' },
  { from: '#2a5a6d', to: '#1a3a4d' },
];

function hashColor(name: string): { from: string; to: string } {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return ATMOSPHERE_COLORS[hash % ATMOSPHERE_COLORS.length];
}

const AVATAR_GRADIENTS: readonly string[] = [
  'linear-gradient(135deg, #c8553d, #8a3528)',
  'linear-gradient(135deg, #3d4a3d, #1a2a1a)',
  'linear-gradient(135deg, #b08d57, #8a6d3f)',
  'linear-gradient(135deg, #1a1612, #3a322a)',
  'linear-gradient(135deg, #5a6b8a, #3a4560)',
];

function pickGradient(name: string, index: number): string {
  if (!name) {
    return AVATAR_GRADIENTS[index % AVATAR_GRADIENTS.length];
  }
  return AVATAR_GRADIENTS[name.charCodeAt(0) % AVATAR_GRADIENTS.length];
}

function htmlToPlainText(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

export default function SceneDetailPage() {
  const navigate = useNavigate();
  const params = useParams<{ id: string }>();
  const sceneId = params.id ?? null;
  const book = useBook();
  const bookId = book?.id ?? null;

  // 实时监听目标场景；未传入 ID 或不属于当前作品时返回 null
  // useApiQuery 在加载未完成时返回 undefined，故用 sceneState 区分加载与未找到
  const sceneState = useApiQuery<Scene | null>(
    async () => {
      if (!sceneId || !bookId) return null;
      const s = await sceneRepository.get(sceneId);
      if (s && s.bookId === bookId) return s;
      return null;
    },
    [sceneId, bookId],
  );
  const scene = sceneState;
  const loading = sceneState === undefined;
  const notFound = !loading && scene === null;

  const characters = useApiQuery<Character[]>(
    async () => (bookId ? characterRepository.list(bookId) : []),
    [bookId],
  ) ?? [];

  const worldviewEntries = useApiQuery<WorldviewEntry[]>(
    async () => (bookId ? worldviewRepository.list(bookId) : []),
    [bookId],
  ) ?? [];

  const chapters = useApiQuery<Chapter[]>(
    async () => (bookId ? chapterRepository.list(bookId) : []),
    [bookId],
  ) ?? [];

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Scene | null>(null);

  const handleEdit = (): void => {
    if (!scene) return;
    setEditing(scene);
    setFormOpen(true);
  };

  const handleClose = (): void => {
    setFormOpen(false);
    setEditing(null);
  };

  const handleBack = (): void => {
    navigate('/scenes');
  };

  const relatedCharacters = characters.filter((c) => scene?.characterIds.includes(c.id));
  const relatedWorldview = worldviewEntries.filter((w) => scene?.worldviewEntryIds.includes(w.id));
  const relatedChapters = chapters.filter((ch) => scene?.chapterIds.includes(ch.id));

  if (notFound) {
    return (
      <div className="px-8 py-6">
        <Button variant="ghost" size="md" icon={<ArrowLeft className="h-4 w-4" />} onClick={handleBack}>
          返回场景列表
        </Button>
        <div className="mt-8">
          <EmptyState
            glyph="景"
            title="场景不存在"
            description="该场景可能已被删除，或您访问的链接有误。"
            action={{ label: '返回场景列表', onClick: handleBack }}
          />
        </div>
      </div>
    );
  }

  const color = scene ? hashColor(scene.name) : ATMOSPHERE_COLORS[0];

  return (
    <div className="px-8 py-6">
      <header className="mb-6">
        <div className="mb-4 flex items-center justify-between">
          <Button variant="ghost" size="md" icon={<ArrowLeft className="h-4 w-4" />} onClick={handleBack}>
            返回场景列表
          </Button>
          {scene && (
            <Button
              variant="primary"
              size="md"
              icon={<Pencil className="h-4 w-4" aria-hidden="true" />}
              onClick={handleEdit}
            >
              编辑场景
            </Button>
          )}
        </div>

        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-4 w-40" />
          </div>
        ) : scene ? (
          <div>
            <h1 className="font-serif text-3xl font-bold tracking-wider text-foreground">
              {scene.name}
            </h1>
            <p className="mt-1.5 font-serif text-sm text-muted-foreground">
              所属作品：{book?.title ?? '未知作品'}
            </p>
          </div>
        ) : null}
      </header>

      {loading ? (
        <div className="space-y-6">
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      ) : scene ? (
        <div className="space-y-8">
          <section
            className="relative overflow-hidden rounded-xl"
            style={{
              background: `linear-gradient(135deg, ${color.from}, ${color.to})`,
            }}
          >
            <div className="px-6 py-8">
              <span className="font-serif text-5xl text-white/20">
                {scene.name.slice(0, 1) || '景'}
              </span>
              <h2 className="mt-2 font-serif text-2xl font-bold text-white">
                {scene.name}
              </h2>
              {scene.description && (
                <p className="mt-2 max-w-2xl text-sm text-white/80">
                  {scene.description}
                </p>
              )}
            </div>
          </section>

          {scene.atmosphere.length > 0 && (
            <section>
              <h3 className="mb-3 font-serif text-sm font-semibold tracking-wide text-secondary">
                § 氛围标签
              </h3>
              <div className="flex flex-wrap gap-2">
                {scene.atmosphere.map((tag) => (
                  <Tag key={tag} variant="primary" size="md">
                    {tag}
                  </Tag>
                ))}
              </div>
            </section>
          )}

          <section>
            <h3 className="mb-3 flex items-center gap-2 font-serif text-sm font-semibold tracking-wide text-secondary">
              <Users className="h-4 w-4" aria-hidden="true" />
              § 关联角色
              <span className="font-normal text-muted-foreground">
                （{relatedCharacters.length} 位）
              </span>
            </h3>
            {relatedCharacters.length === 0 ? (
              <p className="text-sm italic text-muted-foreground">
                暂无关联角色
              </p>
            ) : (
              <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
                {relatedCharacters.map((char, i) => {
                  const gradient = pickGradient(char.name, i);
                  return (
                    <Link
                      key={char.id}
                      to={`/characters/${char.id}`}
                      className={cn(
                        'group flex items-center gap-3 rounded-xl border border-border bg-card p-3',
                        'transition-all duration-200 hover:shadow-md hover:border-primary/40',
                      )}
                    >
                      <div
                        className={cn(
                          'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
                          'border border-white/20 text-sm font-bold text-white shadow-sm transition-transform duration-300 group-hover:scale-105',
                        )}
                        style={{ background: gradient }}
                        aria-hidden="true"
                      >
                        {char.name.trim().slice(0, 2).toUpperCase() || 'CH'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                          {char.name}
                        </p>
                        {char.faction && (
                          <p className="truncate text-xs text-muted-foreground">
                            {char.faction}
                          </p>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>

          <section>
            <h3 className="mb-3 flex items-center gap-2 font-serif text-sm font-semibold tracking-wide text-secondary">
              <Globe className="h-4 w-4" aria-hidden="true" />
              § 关联世界观
              <span className="font-normal text-muted-foreground">
                （{relatedWorldview.length} 条）
              </span>
            </h3>
            {relatedWorldview.length === 0 ? (
              <p className="text-sm italic text-muted-foreground">
                暂无关联世界观条目
              </p>
            ) : (
              <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
                {relatedWorldview.map((entry) => {
                  const excerpt = htmlToPlainText(entry.content);
                  return (
                    <article
                      key={entry.id}
                      className={cn(
                        'group relative cursor-pointer overflow-hidden rounded-xl',
                        'border border-border/60 bg-muted/40 p-5 backdrop-blur-sm',
                        'transition-all duration-300 hover:shadow-premium hover:border-secondary/50',
                      )}
                    >
                      <span
                        className="absolute top-4 right-4 h-1.5 w-1.5 rounded-full bg-primary/90 animate-pulse"
                        aria-hidden="true"
                      />
                      <h4 className="font-serif text-[15px] font-bold leading-snug text-foreground group-hover:text-primary transition-colors">
                        {entry.title || '未命名条目'}
                      </h4>
                      {excerpt ? (
                        <p
                          className="mt-2 text-[11px] leading-relaxed text-muted-foreground"
                          style={{
                            display: '-webkit-box',
                            WebkitLineClamp: 3,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                          }}
                        >
                          {excerpt}
                        </p>
                      ) : (
                        <p className="mt-2 text-[11px] italic leading-relaxed text-muted-foreground">
                          尚无内容
                        </p>
                      )}
                      {entry.tags.length > 0 && (
                        <div className="mt-3.5 flex flex-wrap gap-1.5">
                          {entry.tags.slice(0, 3).map((tag) => (
                            <Tag key={tag} variant="default" size="sm" className="scale-90 font-serif font-medium">
                              {tag}
                            </Tag>
                          ))}
                          {entry.tags.length > 3 && (
                            <Tag variant="default" size="sm" className="scale-90 font-serif font-medium">
                              +{entry.tags.length - 3}
                            </Tag>
                          )}
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <section>
            <h3 className="mb-3 flex items-center gap-2 font-serif text-sm font-semibold tracking-wide text-secondary">
              <BookOpen className="h-4 w-4" aria-hidden="true" />
              § 出现章节
              <span className="font-normal text-muted-foreground">
                （{relatedChapters.length} 章）
              </span>
            </h3>
            {relatedChapters.length === 0 ? (
              <p className="text-sm italic text-muted-foreground">
                暂无出现章节
              </p>
            ) : (
              <ul className="space-y-2">
                {relatedChapters.map((ch, idx) => (
                  <li key={ch.id}>
                    <Link
                      to={`/editor?chapter=${ch.id}`}
                      className={cn(
                        'flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3',
                        'transition-all duration-200 hover:shadow-sm hover:border-primary/40',
                      )}
                    >
                      <span className="text-xs font-medium text-muted-foreground">
                        第 {idx + 1} 章
                      </span>
                      <span className="text-sm text-foreground group-hover:text-primary transition-colors">
                        {ch.title || '未命名章节'}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      ) : null}

      {bookId && (
        <SceneForm
          open={formOpen}
          onClose={handleClose}
          scene={editing}
          bookId={bookId}
        />
      )}
    </div>
  );
}
