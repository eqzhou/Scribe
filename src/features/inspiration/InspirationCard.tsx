/**
 * InspirationCard 灵感卡片
 *
 * 设计规范：
 * - 圆角：rounded-xl
 * - 背景：bg-card，border border-border
 * - 阴影：默认 shadow-sm，悬停 shadow-md
 * - 瀑布流：break-inside-avoid
 * - 顶部装饰：毛笔字引号
 * - 标签：使用 Tag 组件
 * - 底部分隔：border-t border-border-soft
 */
import { motion } from 'framer-motion';
import type { Inspiration } from '../../types';
import { getRelativeTime } from '../../utils/date';
import { cn } from '../../utils/cn';
import { Tag } from '../../components/ui';

export interface InspirationCardProps {
  inspiration: Inspiration;
  index: number;
  onClick: () => void;
}

export function InspirationCard({ inspiration, index, onClick }: InspirationCardProps) {
  const hasTitle = inspiration.title.trim().length > 0;
  const hasContent = inspiration.content.trim().length > 0;

  return (
    <motion.li
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.03, 0.3), ease: 'easeOut' }}
      whileHover={{ y: -3 }}
      onClick={onClick}
      className={cn(
        'mb-4 flex cursor-pointer flex-col gap-2 break-inside-avoid',
        'rounded-xl border border-border bg-card shadow-sm p-4',
        'transition-all duration-300 hover:shadow-md hover:border-primary/40',
      )}
    >
      {/* 引号装饰 */}
      <span
        className="font-brush text-2xl leading-none text-muted-foreground/20 select-none"
        aria-hidden="true"
      >
        「
      </span>

      {/* 标题 */}
      {hasTitle && (
        <h3 className="-mt-1 font-sans text-sm font-semibold leading-snug text-foreground">
          {inspiration.title}
        </h3>
      )}

      {/* 内容（纯文本，保留换行） */}
      {hasContent ? (
        <p className="whitespace-pre-wrap font-serif text-sm leading-relaxed text-foreground/80 line-clamp-[6]">
          {inspiration.content}
        </p>
      ) : (
        <p className="font-serif text-sm italic leading-relaxed text-muted-foreground">
          空白灵感，点击补充。
        </p>
      )}

      {/* 标签列表 */}
      {inspiration.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {inspiration.tags.map((tag) => (
            <Tag key={tag} variant="default" size="sm">
              {tag}
            </Tag>
          ))}
        </div>
      )}

      {/* 底部：分类 + 时间 */}
      <div className="mt-1 flex items-center gap-2 border-t border-border-soft pt-2">
        {inspiration.category && (
          <Tag variant="primary" size="sm">
            {inspiration.category}
          </Tag>
        )}
        <span className="ml-auto text-[12px] text-muted-foreground font-mono">
          {getRelativeTime(inspiration.createdAt)}
        </span>
      </div>
    </motion.li>
  );
}

export default InspirationCard;
