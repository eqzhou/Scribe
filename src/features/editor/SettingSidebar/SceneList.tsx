/**
 * SceneList 场景列表
 *
 * 从 src/features/editor/SettingSidebar.tsx 提取。
 * 卡片列表展示场景，点击展开/折叠详情，再点击跳转场景详情页。
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ExternalLink } from 'lucide-react';
import type { Scene } from '../../../types';
import { cn } from '../../../utils/cn';
import { EmptyHint } from './EmptyHint';

/** 场景列表 */
export function SceneList({ scenes }: { scenes: Scene[] }) {
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

export default SceneList;
