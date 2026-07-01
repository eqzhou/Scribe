/**
 * CharacterList 角色列表
 *
 * 从 src/features/editor/SettingSidebar.tsx 提取。
 * 卡片列表展示角色，点击展开/折叠详情，再点击跳转角色详情页。
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ExternalLink } from 'lucide-react';
import type { Character } from '../../../types';
import { cn } from '../../../utils/cn';
import { EmptyHint } from './EmptyHint';

/** 角色列表 */
export function CharacterList({ characters }: { characters: Character[] }) {
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

export default CharacterList;
