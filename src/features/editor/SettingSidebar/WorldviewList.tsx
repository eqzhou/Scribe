/**
 * WorldviewList 世界观列表
 *
 * 从 src/features/editor/SettingSidebar.tsx 提取。
 * 卡片列表展示世界观条目，点击展开/折叠详情，再点击跳转世界观详情页。
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ExternalLink } from 'lucide-react';
import type { WorldviewEntry } from '../../../types';
import { cn } from '../../../utils/cn';
import { EmptyHint } from './EmptyHint';

/** 世界观列表 */
export function WorldviewList({ entries }: { entries: WorldviewEntry[] }) {
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

export default WorldviewList;
