/**
 * SceneCard 场景卡片
 *
 * 设计规范：
 * - 圆角：rounded-xl
 * - 背景：bg-card，border border-border
 * - 阴影：默认 shadow-sm，悬停 shadow-md
 * - 顶部氛围色 banner：h-16，首字毛笔字装饰
 * - 底部：border-t border-border-soft，关联统计
 */
import { motion } from 'framer-motion';
import { Users, BookOpen, Globe } from 'lucide-react';
import type { Scene } from '../../types';
import { cn } from '../../utils/cn';
import { Tag } from '../../components/ui';

export interface SceneCardProps {
  scene: Scene;
  onClick: () => void;
}

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

export function SceneCard({ scene, onClick }: SceneCardProps) {
  const color = hashColor(scene.name);
  const stats = [
    { icon: Users, label: '角色', count: scene.characterIds.length },
    { icon: BookOpen, label: '章节', count: scene.chapterIds.length },
    { icon: Globe, label: '世界观', count: scene.worldviewEntryIds.length },
  ];

  return (
    <motion.li
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ y: -3 }}
      transition={{ type: 'spring', stiffness: 320, damping: 24 }}
      onClick={onClick}
      className={cn(
        'group flex cursor-pointer flex-col overflow-hidden',
        'rounded-xl border border-border bg-card shadow-sm',
        'transition-all duration-300 hover:shadow-md hover:border-primary/40',
      )}
    >
      {/* 氛围色 banner */}
      <div
        className="relative h-16 w-full"
        style={{
          background: `linear-gradient(135deg, ${color.from}, ${color.to})`,
        }}
        aria-hidden="true"
      >
        <span className="absolute bottom-2 left-3 font-serif text-2xl text-white/80">
          {scene.name.slice(0, 1) || '景'}
        </span>
      </div>

      {/* 主体 */}
      <div className="flex flex-1 flex-col gap-2 p-4">
        {/* 场景名 */}
        <h3 className="font-sans text-sm font-semibold leading-snug text-foreground">
          {scene.name || '未命名场景'}
        </h3>

        {/* 描述截断 */}
        {scene.description ? (
          <p className="text-xs leading-relaxed text-muted-foreground line-clamp-2">
            {scene.description}
          </p>
        ) : (
          <p className="text-xs italic leading-relaxed text-muted-foreground">
            尚无描述，点击补充。
          </p>
        )}

        {/* 氛围标签 */}
        {scene.atmosphere.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {scene.atmosphere.slice(0, 3).map((tag) => (
              <Tag key={tag} variant="secondary" size="sm">
                {tag}
              </Tag>
            ))}
            {scene.atmosphere.length > 3 && (
              <Tag variant="default" size="sm">
                +{scene.atmosphere.length - 3}
              </Tag>
            )}
          </div>
        )}

        {/* 关联统计 */}
        <div className="mt-auto flex items-center gap-3 border-t border-border-soft pt-2">
          {stats.map((s) => {
            const Icon = s.icon;
            return (
              <span
                key={s.label}
                className="flex items-center gap-1 text-[11px] text-muted-foreground"
                title={`${s.count} 个${s.label}`}
              >
                <Icon className="h-3 w-3" aria-hidden="true" />
                <span className="font-medium text-foreground">{s.count}</span>
              </span>
            );
          })}
        </div>
      </div>
    </motion.li>
  );
}

export default SceneCard;
