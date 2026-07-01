/**
 * EntryCard 世界观条目卡片
 *
 * 羊皮纸质感卡片，顶部朱砂红 3px 色条作为视觉锚点。
 * 展示：标题 / 摘要（3 行截断）/ 标签 / 关联角色与场景计数。
 * Framer Motion 悬停上浮 -3px，阴影加深。
 */
import { motion } from 'framer-motion';
import { Users, Map } from 'lucide-react';
import type { WorldviewEntry } from '../../types';
import { cn } from '../../utils/cn';
import { Tag } from '../../components/ui';

export interface EntryCardProps {
  /** 条目数据 */
  entry: WorldviewEntry;
  /** 点击卡片打开编辑 */
  onClick: (entry: WorldviewEntry) => void;
}

/**
 * 将富文本 HTML 剥离为纯文本，用于卡片摘要展示。
 * 保留换行与空格，去除标签与命名实体。
 */
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

/**
 * 世界观条目卡片。
 */
export function EntryCard({ entry, onClick }: EntryCardProps) {
  const excerpt = htmlToPlainText(entry.content);
  const charCount = entry.relatedCharacterIds.length;
  const sceneCount = entry.relatedSceneIds.length;

  return (
    <motion.article
      whileHover={{ y: -4, scale: 1.01 }}
      transition={{ type: 'spring', stiffness: 350, damping: 24 }}
      onClick={() => onClick(entry)}
      className={cn(
        'group relative cursor-pointer overflow-hidden rounded-xl',
        'border border-border/60 bg-muted/40 p-5 backdrop-blur-sm',
        'transition-all duration-300 hover:shadow-premium hover:border-secondary/50',
      )}
    >
      {/* 顶部右上角朱砂红印章小圆点 */}
      <span
        className="absolute top-4 right-4 h-1.5 w-1.5 rounded-full bg-primary/90 animate-pulse"
        aria-hidden="true"
      />

      {/* 标题 */}
      <h3 className="font-serif text-[15px] font-bold leading-snug text-foreground group-hover:text-primary transition-colors">
        {entry.title || '未命名条目'}
      </h3>

      {/* 摘要：3 行截断 */}
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
          尚无内容，点击补充条目正文。
        </p>
      )}

      {/* 标签 */}
      {entry.tags.length > 0 && (
        <div className="mt-3.5 flex flex-wrap gap-1.5">
          {entry.tags.slice(0, 4).map((tag) => (
            <Tag key={tag} variant="default" size="sm" className="scale-90 font-serif font-medium">
              {tag}
            </Tag>
          ))}
          {entry.tags.length > 4 && (
            <Tag variant="default" size="sm" className="scale-90 font-serif font-medium">
              +{entry.tags.length - 4}
            </Tag>
          )}
        </div>
      )}

      {/* 关联计数 */}
      <div className="mt-3.5 flex items-center gap-3 border-t border-border-soft/40 pt-2.5 text-[12px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5" title="关联角色数">
          <Users className="h-3.5 w-3.5" aria-hidden="true" />
          {charCount} 角色
        </span>
        <span className="text-border-soft/50" aria-hidden="true">
          |
        </span>
        <span className="inline-flex items-center gap-1.5" title="关联场景数">
          <Map className="h-3.5 w-3.5" aria-hidden="true" />
          {sceneCount} 场景
        </span>
      </div>
    </motion.article>
  );
}

export default EntryCard;
