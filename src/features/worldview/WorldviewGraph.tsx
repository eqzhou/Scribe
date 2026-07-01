/**
 * WorldviewGraph 世界观关联图谱
 *
 * 纯 SVG 绘制（不引入图表库）：
 * - 三层径向布局：世界观条目居中环，角色上环，场景下环。
 * - 节点：圆形 + 首字 + 类型色填充（世界观 primary，角色 moss，场景 secondary）。
 * - 连线：世界观-角色 / 世界观-场景 关联关系。
 * - Framer Motion：节点 scale 0→1 stagger 入场，连线 pathLength 0→1 入场。
 * - 节点悬停 scale 1.1，显示名称。
 * - 点击节点跳转对应详情页。
 */
import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import type { Character, Scene, WorldviewEntry } from '../../types';
import { cn } from '../../utils/cn';
import { EmptyState } from '../../components/ui';

export interface WorldviewGraphProps {
  entries: WorldviewEntry[];
  characters: Character[];
  scenes: Scene[];
  onEntryClick?: (entry: WorldviewEntry) => void;
  className?: string;
}

type NodeType = 'worldview' | 'character' | 'scene';

interface GraphNode {
  id: string;
  type: NodeType;
  label: string;
  x: number;
  y: number;
  r: number;
  data: WorldviewEntry | Character | Scene;
}

interface GraphEdge {
  id: string;
  from: string;
  to: string;
  type: 'character' | 'scene';
}

const CENTER = { x: 400, y: 260 };
const WORLDVIEW_RADIUS = 120;
const CHARACTER_RADIUS = 230;
const SCENE_RADIUS = 230;

const NODE_COLORS: Record<NodeType, string> = {
  worldview: 'rgb(var(--primary))',
  character: 'rgb(var(--moss))',
  scene: 'rgb(var(--secondary))',
};

const NODE_STROKE: Record<NodeType, string> = {
  worldview: 'rgb(var(--primary-deep))',
  character: 'rgb(var(--moss))',
  scene: 'rgb(var(--secondary))',
};

function getFirstChar(name: string): string {
  return name.trim().charAt(0) || '·';
}

export function WorldviewGraph({
  entries,
  characters,
  scenes,
  onEntryClick,
  className,
}: WorldviewGraphProps) {
  const navigate = useNavigate();
  const [hovered, setHovered] = useState<string | null>(null);

  const { nodes, edges, nodeMap } = useMemo(() => {
    const nodeMap = new Map<string, GraphNode>();
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];

    if (entries.length === 0) {
      return { nodes, edges, nodeMap };
    }

    const validEntries = entries;
    const charMap = new Map(characters.map((c) => [c.id, c]));
    const sceneMap = new Map(scenes.map((s) => [s.id, s]));

    const relatedCharIds = new Set<string>();
    const relatedSceneIds = new Set<string>();
    for (const e of validEntries) {
      for (const cid of e.relatedCharacterIds) {
        if (charMap.has(cid)) relatedCharIds.add(cid);
      }
      for (const sid of e.relatedSceneIds) {
        if (sceneMap.has(sid)) relatedSceneIds.add(sid);
      }
    }

    const relatedChars = characters.filter((c) => relatedCharIds.has(c.id));
    const relatedScenes = scenes.filter((s) => relatedSceneIds.has(s.id));

    const wvCount = validEntries.length;
    const wvStep = (2 * Math.PI) / Math.max(wvCount, 1);
    const wvStart = -Math.PI / 2;
    validEntries.forEach((entry, i) => {
      const angle = wvStart + i * wvStep;
      const x = CENTER.x + WORLDVIEW_RADIUS * Math.cos(angle);
      const y = CENTER.y + WORLDVIEW_RADIUS * Math.sin(angle);
      const node: GraphNode = {
        id: `wv-${entry.id}`,
        type: 'worldview',
        label: entry.title,
        x,
        y,
        r: 32,
        data: entry,
      };
      nodes.push(node);
      nodeMap.set(node.id, node);
    });

    const charCount = relatedChars.length;
    if (charCount > 0) {
      const charStep = Math.PI / Math.max(charCount, 1);
      const charStart = Math.PI;
      relatedChars.forEach((char, i) => {
        const angle = charStart + i * charStep;
        const x = CENTER.x + CHARACTER_RADIUS * Math.cos(angle);
        const y = CENTER.y + CHARACTER_RADIUS * Math.sin(angle);
        const node: GraphNode = {
          id: `ch-${char.id}`,
          type: 'character',
          label: char.name,
          x,
          y,
          r: 26,
          data: char,
        };
        nodes.push(node);
        nodeMap.set(node.id, node);
      });
    }

    const sceneCount = relatedScenes.length;
    if (sceneCount > 0) {
      const sceneStep = Math.PI / Math.max(sceneCount, 1);
      const sceneStart = 0;
      relatedScenes.forEach((scene, i) => {
        const angle = sceneStart + i * sceneStep;
        const x = CENTER.x + SCENE_RADIUS * Math.cos(angle);
        const y = CENTER.y + SCENE_RADIUS * Math.sin(angle);
        const node: GraphNode = {
          id: `sc-${scene.id}`,
          type: 'scene',
          label: scene.name,
          x,
          y,
          r: 26,
          data: scene,
        };
        nodes.push(node);
        nodeMap.set(node.id, node);
      });
    }

    for (const entry of validEntries) {
      const wvNodeId = `wv-${entry.id}`;
      for (const cid of entry.relatedCharacterIds) {
        const charNodeId = `ch-${cid}`;
        if (nodeMap.has(charNodeId)) {
          edges.push({
            id: `${wvNodeId}-${charNodeId}`,
            from: wvNodeId,
            to: charNodeId,
            type: 'character',
          });
        }
      }
      for (const sid of entry.relatedSceneIds) {
        const sceneNodeId = `sc-${sid}`;
        if (nodeMap.has(sceneNodeId)) {
          edges.push({
            id: `${wvNodeId}-${sceneNodeId}`,
            from: wvNodeId,
            to: sceneNodeId,
            type: 'scene',
          });
        }
      }
    }

    return { nodes, edges, nodeMap };
  }, [entries, characters, scenes]);

  const handleNodeClick = (node: GraphNode): void => {
    if (node.type === 'worldview') {
      onEntryClick?.(node.data as WorldviewEntry);
    } else if (node.type === 'character') {
      const char = node.data as Character;
      navigate(`/characters/${char.id}`);
    } else if (node.type === 'scene') {
      const scene = node.data as Scene;
      navigate(`/scenes/${scene.id}`);
    }
  };

  if (entries.length === 0) {
    return (
      <EmptyState
        glyph="谱"
        title="尚无世界观条目"
        description="先创建世界观条目，再于此处查看关联图谱。"
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
      <div className="mb-4 flex gap-6">
        <div className="flex items-center gap-2">
          <span
            className="inline-block h-3 w-3 rounded-full"
            style={{ backgroundColor: NODE_COLORS.worldview }}
          />
          <span className="font-serif text-sm text-foreground">世界观</span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="inline-block h-3 w-3 rounded-full"
            style={{ backgroundColor: NODE_COLORS.character }}
          />
          <span className="font-serif text-sm text-foreground">角色</span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="inline-block h-3 w-3 rounded-full"
            style={{ backgroundColor: NODE_COLORS.scene }}
          />
          <span className="font-serif text-sm text-foreground">场景</span>
        </div>
      </div>

      <svg
        viewBox="-60 -60 920 640"
        width="100%"
        style={{ height: 'auto', maxHeight: 580 }}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="世界观关联图谱"
      >
        <defs>
          {nodes.map((node) => (
            <radialGradient
              key={`grad-${node.id}`}
              id={`grad-${node.id}`}
              cx="30%"
              cy="30%"
              r="70%"
            >
              <stop offset="0%" stopColor="white" stopOpacity="0.3" />
              <stop offset="100%" stopColor={NODE_COLORS[node.type]} stopOpacity="1" />
            </radialGradient>
          ))}
        </defs>

        {edges.map((edge, i) => {
          const from = nodeMap.get(edge.from);
          const to = nodeMap.get(edge.to);
          if (!from || !to) return null;
          const color = edge.type === 'character'
            ? NODE_COLORS.character
            : NODE_COLORS.scene;
          return (
            <motion.line
              key={edge.id}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke={color}
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeOpacity={0.5}
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 0.5 }}
              transition={{
                pathLength: {
                  duration: 0.6,
                  delay: 0.3 + i * 0.03,
                  ease: 'easeInOut',
                },
                opacity: { duration: 0.3, delay: 0.3 + i * 0.03 },
              }}
            />
          );
        })}

        {nodes.map((node, i) => {
          const isHovered = hovered === node.id;
          const firstChar = getFirstChar(node.label);
          return (
            <g key={node.id}>
              <motion.g
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{
                  type: 'spring',
                  stiffness: 260,
                  damping: 18,
                  delay: 0.1 + i * 0.06,
                }}
                whileHover={{ scale: 1.15 }}
                style={{
                  transformBox: 'fill-box',
                  transformOrigin: 'center',
                }}
                onMouseEnter={() => setHovered(node.id)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => handleNodeClick(node)}
                className="cursor-pointer"
              >
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={node.r}
                  fill={`url(#grad-${node.id})`}
                  stroke={NODE_STROKE[node.type]}
                  strokeWidth={2}
                />
                <text
                  x={node.x}
                  y={node.y + node.r / 3}
                  textAnchor="middle"
                  fill="rgb(var(--background))"
                  fontSize={node.type === 'worldview' ? 20 : 16}
                  fontFamily="'Ma Shan Zheng', cursive"
                >
                  {firstChar}
                </text>
              </motion.g>

              <motion.text
                x={node.x}
                y={node.y + node.r + 14}
                textAnchor="middle"
                fill="rgb(var(--foreground))"
                fontSize={11}
                fontWeight={node.type === 'worldview' ? 600 : 400}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3, delay: 0.2 + i * 0.06 }}
              >
                {node.label.length > 6
                  ? node.label.slice(0, 6) + '…'
                  : node.label}
              </motion.text>

              {isHovered && node.label.length > 6 && (
                <motion.text
                  x={node.x}
                  y={node.y - node.r - 8}
                  textAnchor="middle"
                  fill={NODE_COLORS[node.type]}
                  fontSize={11}
                  fontFamily="'ZCOOL XiaoWei', serif"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  {node.label}
                </motion.text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export default WorldviewGraph;
