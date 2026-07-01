/**
 * RelationGraph 人物关系图谱
 *
 * 纯 SVG 绘制（不引入图表库）：
 * - 圆形布局：主角居中 (400, 210)，其他角色均匀分布在半径 200 的圆上。
 * - 节点：圆形（主角半径 38，其他 30）+ 毛笔字首字 + 渐变填充。
 * - 连线：按关系类型着色，中点标注关系文字。
 * - Framer Motion：节点 scale 0→1 stagger 入场，连线 pathLength 0→1 入场。
 * - 节点悬停 scale 1.1，显示角色名与别名。
 * - 无角色时显示 EmptyState。
 */
import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import type {
  Character,
  CharacterRelation,
  RelationType,
} from '../../types';
import { cn } from '../../utils/cn';
import { EmptyState } from '../../components/ui';

export interface RelationGraphProps {
  /** 当前作品全部角色 */
  characters: Character[];
  /** 当前作品全部关系 */
  relations: CharacterRelation[];
  /** 节点点击回调（可选） */
  onNodeClick?: (character: Character) => void;
  /** 附加类名 */
  className?: string;
}

/** 关系类型 → 中文标签 */
const RELATION_LABEL: Record<RelationType, string> = {
  family: '亲属',
  friend: '知己',
  rival: '宿敌',
  lover: '恋人',
  mentor: '师徒',
  subordinate: '上下级',
  other: '其他',
};

/** 关系类型 → 连线颜色（CSS 变量） */
const RELATION_COLOR: Record<RelationType, string> = {
  family: 'rgb(var(--foreground))',
  friend: 'rgb(var(--moss))',
  rival: 'rgb(var(--primary))',
  lover: 'rgb(var(--primary-deep))',
  mentor: 'rgb(var(--secondary))',
  subordinate: 'rgb(var(--muted-foreground))',
  other: 'rgb(var(--border))',
};

/** 5 种头像渐变方案（与 CharacterCard 一致） */
const AVATAR_GRADIENTS: readonly (readonly [string, string])[] = [
  ['#c8553d', '#8a3528'],
  ['#3d4a3d', '#1a2a1a'],
  ['#b08d57', '#8a6d3f'],
  ['#1a1612', '#3a322a'],
  ['#5a6b8a', '#3a4560'],
];

/** 主角中心坐标 */
const CENTER = { x: 400, y: 210 };
/** 环绕半径 */
const RADIUS = 200;

/** 节点位置计算结果 */
interface NodePosition {
  character: Character;
  x: number;
  y: number;
  r: number;
  gradientId: string;
  gradient: readonly [string, string];
  isProtagonist: boolean;
}

/** 按姓名首字 hash 选择渐变索引 */
function pickGradientIndex(name: string, fallback: number): number {
  if (!name) return fallback % AVATAR_GRADIENTS.length;
  return name.charCodeAt(0) % AVATAR_GRADIENTS.length;
}

/** 取姓名首字作为毛笔字头像内容 */
function getFirstChar(name: string): string {
  return name.trim().charAt(0) || '·';
}

/**
 * 人物关系图谱：SVG 圆形布局 + Framer Motion 入场动画。
 */
export function RelationGraph({
  characters,
  relations,
  onNodeClick,
  className,
}: RelationGraphProps) {
  const [hovered, setHovered] = useState<string | null>(null);

  // 计算节点位置：主角居中，其他角色均匀环绕
  const { nodes, positionMap } = useMemo(() => {
    const map = new Map<string, { x: number; y: number }>();
    const nodes: NodePosition[] = [];
    if (characters.length === 0) {
      return { nodes, positionMap: map };
    }

    // 主角：第一个 protagonist；若无则取第一个角色
    const protagonistIdx = characters.findIndex(
      (c) => c.role === 'protagonist',
    );
    const centerIdx = protagonistIdx >= 0 ? protagonistIdx : 0;
    const centerChar = characters[centerIdx];
    const others = characters.filter((_, i) => i !== centerIdx);

    // 中心节点
    nodes.push({
      character: centerChar,
      x: CENTER.x,
      y: CENTER.y,
      r: 38,
      gradientId: `grad-${centerChar.id}`,
      gradient:
        AVATAR_GRADIENTS[pickGradientIndex(centerChar.name, 0)],
      isProtagonist: true,
    });
    map.set(centerChar.id, { x: CENTER.x, y: CENTER.y });

    // 环绕节点：均匀分布，起始角度偏移半步以避免节点落在正上下
    const n = others.length;
    const step = (2 * Math.PI) / Math.max(n, 1);
    const startAngle = -Math.PI / 2 + (n > 1 ? step / 2 : 0);
    others.forEach((char, i) => {
      const angle = startAngle + i * step;
      const x = CENTER.x + RADIUS * Math.cos(angle);
      const y = CENTER.y + RADIUS * Math.sin(angle);
      nodes.push({
        character: char,
        x,
        y,
        r: 30,
        gradientId: `grad-${char.id}`,
        gradient: AVATAR_GRADIENTS[pickGradientIndex(char.name, i + 1)],
        isProtagonist: false,
      });
      map.set(char.id, { x, y });
    });

    return { nodes, positionMap: map };
  }, [characters]);

  // 过滤两端角色均存在的关系
  const validRelations = useMemo(() => {
    return relations.filter(
      (r) => positionMap.has(r.fromId) && positionMap.has(r.toId),
    );
  }, [relations, positionMap]);

  if (characters.length === 0) {
    return (
      <EmptyState
        glyph="谱"
        title="尚无角色入谱"
        description="先创建角色档案，再于此处查看人物关系图谱。"
      />
    );
  }

  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-muted p-6',
        className,
      )}
    >
      <svg
        viewBox="-60 -60 920 540"
        width="100%"
        style={{ height: 'auto', maxHeight: 540 }}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="人物关系图谱"
      >
        <defs>
          {nodes.map((node) => (
            <linearGradient
              key={node.gradientId}
              id={node.gradientId}
              x1="0"
              y1="0"
              x2="1"
              y2="1"
            >
              <stop offset="0" stopColor={node.gradient[0]} />
              <stop offset="1" stopColor={node.gradient[1]} />
            </linearGradient>
          ))}
        </defs>

        {/* 连线层（先于节点渲染，使节点叠在上层） */}
        {validRelations.map((rel, i) => {
          const from = positionMap.get(rel.fromId);
          const to = positionMap.get(rel.toId);
          if (!from || !to) return null;
          const color = RELATION_COLOR[rel.type];
          const midX = (from.x + to.x) / 2;
          const midY = (from.y + to.y) / 2;
          const label = rel.description || RELATION_LABEL[rel.type];
          const labelWidth = label.length * 12 + 10;
          return (
            <g key={rel.id}>
              <motion.line
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                stroke={color}
                strokeWidth={2}
                strokeLinecap="round"
                strokeDasharray={rel.type === 'other' ? '4 3' : undefined}
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{
                  pathLength: {
                    duration: 0.6,
                    delay: 0.2 + i * 0.05,
                    ease: 'easeInOut',
                  },
                  opacity: { duration: 0.3, delay: 0.2 + i * 0.05 },
                }}
              />
              {/* 关系文字背景：羊皮纸底以保证可读性 */}
              <motion.rect
                x={midX - labelWidth / 2}
                y={midY - 10}
                width={labelWidth}
                height={20}
                rx={3}
                fill="rgb(var(--muted))"
                stroke="rgb(var(--border-soft))"
                strokeWidth={0.5}
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.95 }}
                transition={{ duration: 0.3, delay: 0.5 + i * 0.05 }}
              />
              <motion.text
                x={midX}
                y={midY + 4}
                textAnchor="middle"
                fill={color}
                fontSize={11}
                fontFamily="'Noto Serif SC', serif"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3, delay: 0.5 + i * 0.05 }}
              >
                {label}
              </motion.text>
            </g>
          );
        })}

        {/* 节点层 */}
        {nodes.map((node, i) => {
          const isHovered = hovered === node.character.id;
          const firstChar = getFirstChar(node.character.name);
          return (
            <g key={node.character.id}>
              <motion.g
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{
                  type: 'spring',
                  stiffness: 260,
                  damping: 18,
                  delay: i * 0.08,
                }}
                whileHover={{ scale: 1.1 }}
                style={{
                  transformBox: 'fill-box',
                  transformOrigin: 'center',
                }}
                onMouseEnter={() => setHovered(node.character.id)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => onNodeClick?.(node.character)}
                className={cn(onNodeClick && 'cursor-pointer')}
              >
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={node.r}
                  fill={`url(#${node.gradientId})`}
                  stroke="rgb(var(--secondary))"
                  strokeWidth={2}
                />
                <text
                  x={node.x}
                  y={node.y + node.r / 3}
                  textAnchor="middle"
                  fill="rgb(var(--background))"
                  fontSize={node.isProtagonist ? 22 : 18}
                  fontFamily="'Ma Shan Zheng', cursive"
                >
                  {firstChar}
                </text>
              </motion.g>

              {/* 角色名（独立于缩放层，保持稳定可读） */}
              <motion.text
                x={node.x}
                y={node.y + node.r + 16}
                textAnchor="middle"
                fill="rgb(var(--foreground))"
                fontSize={node.isProtagonist ? 13 : 12}
                fontWeight={node.isProtagonist ? 600 : 400}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3, delay: i * 0.08 + 0.15 }}
              >
                {node.character.name}
              </motion.text>

              {/* 悬停时显示别名 */}
              {isHovered && node.character.alias && (
                <text
                  x={node.x}
                  y={node.y + node.r + 30}
                  textAnchor="middle"
                  fill="rgb(var(--secondary))"
                  fontSize={10}
                  fontFamily="'ZCOOL XiaoWei', serif"
                >
                  {node.character.alias}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export default RelationGraph;
