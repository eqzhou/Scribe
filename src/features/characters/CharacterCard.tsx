/**
 * CharacterCard 角色卡片
 *
 * 设计规范：
 * - 圆角：rounded-xl
 * - 背景：bg-card，border border-border
 * - 阴影：默认 shadow-sm，悬停 shadow-md
 * - 左侧色彩条：按角色类型区分，1px 宽
 * - 圆形头像：首字母 + 渐变背景
 * - 底部标签：使用 Tag 组件
 */
import { motion } from 'framer-motion';
import type { Character, CharacterRole } from '../../types';
import { cn } from '../../utils/cn';
import { Tag } from '../../components/ui';

export interface CharacterCardProps {
  character: Character;
  index?: number;
  onClick: (character: Character) => void;
}

const ROLE_COLOR_BAR: Record<CharacterRole, string> = {
  protagonist: 'bg-primary',
  supporting: 'bg-moss',
  antagonist: 'bg-destructive',
  minor: 'bg-muted-foreground',
};

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

export function CharacterCard({
  character,
  index = 0,
  onClick,
}: CharacterCardProps) {
  const gradient = pickGradient(character.name, index);

  return (
    <motion.article
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ y: -3 }}
      transition={{ type: 'spring', stiffness: 350, damping: 24 }}
      onClick={() => onClick(character)}
      className={cn(
        'group relative cursor-pointer overflow-hidden rounded-xl',
        'border border-border bg-card shadow-sm p-4 text-center',
        'transition-all duration-300 hover:shadow-md hover:border-primary/40',
      )}
    >
      {/* 左侧色彩条 */}
      <span
        className={cn(
          'absolute inset-y-0 left-0 w-1 transition-all duration-200 group-hover:w-1.5',
          ROLE_COLOR_BAR[character.role],
        )}
        aria-hidden="true"
      />

      {/* 头像 */}
      <div
        className={cn(
          'mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full',
          'border border-white/20 font-sans text-base font-bold text-white shadow-sm transition-transform duration-300 group-hover:scale-105',
        )}
        style={{
          background: gradient,
          boxShadow: '0 2px 6px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.15)',
        }}
        aria-hidden="true"
      >
        {character.name.trim().slice(0, 2).toUpperCase() || 'CH'}
      </div>

      {/* 姓名 */}
      <h3 className="font-sans text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
        {character.name || '未命名'}
      </h3>

      {/* 别名 */}
      {character.alias ? (
        <p className="mt-1 text-[11px] text-muted-foreground">
          {character.alias}
        </p>
      ) : (
        <p className="mt-1 h-[16.5px]" />
      )}

      {/* 阵营 */}
      {character.faction ? (
        <p className="mt-1.5 text-[11px] text-muted-foreground truncate">{character.faction}</p>
      ) : (
        <p className="mt-1.5 text-[11px] text-muted-foreground italic">隐世散人</p>
      )}

      {/* 标签 */}
      {character.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap justify-center gap-1.5">
          {character.tags.slice(0, 3).map((tag) => (
            <Tag key={tag} variant={character.role === 'protagonist' ? 'primary' : 'default'} size="sm">
              {tag}
            </Tag>
          ))}
          {character.tags.length > 3 && (
            <Tag variant="default" size="sm">
              +{character.tags.length - 3}
            </Tag>
          )}
        </div>
      )}
    </motion.article>
  );
}

export default CharacterCard;
