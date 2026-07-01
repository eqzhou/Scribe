/**
 * 人物关系管理区（仅编辑模式）
 *
 * 从 CharacterForm.tsx 提取：已有关系列表 + 新增关系表单。
 */
import type { Dispatch, SetStateAction } from 'react';
import { Trash2, Plus } from 'lucide-react';
import { Button, Input, Tag } from '../../components/ui';
import { cn } from '../../utils/cn';
import type {
  Character,
  CharacterRelation,
  RelationType,
} from '../../types';
import {
  RELATION_LABEL,
  RELATION_OPTIONS,
  getOtherId,
  type NewRelationState,
} from './constants';

interface CharacterRelationsSectionProps {
  character: Character;
  allCharacters: Character[];
  charRelations: CharacterRelation[];
  onAddRelation: () => void;
  onDeleteRelation: (relId: string) => void;
  newRel: NewRelationState;
  setNewRel: Dispatch<SetStateAction<NewRelationState>>;
}

export function CharacterRelationsSection({
  character,
  allCharacters,
  charRelations,
  onAddRelation,
  onDeleteRelation,
  newRel,
  setNewRel,
}: CharacterRelationsSectionProps) {
  // 角色 id → name 映射，供关系列表查询对方名称
  const charNameMap = new Map<string, Character>();
  for (const c of allCharacters) charNameMap.set(c.id, c);

  // 可选的"对方角色"：排除自身
  const otherCharOptions = allCharacters.filter((c) => c.id !== character.id);

  return (
    <section>
      <h3 className="mb-3 font-serif text-sm font-semibold tracking-wide text-secondary">
        § 人物关系
      </h3>

      {/* 已有关系列表 */}
      {charRelations && charRelations.length > 0 ? (
        <ul className="mb-3 flex flex-col gap-1.5">
          {charRelations.map((rel) => {
            const otherId = getOtherId(rel, character.id);
            const other = otherId ? charNameMap.get(otherId) : undefined;
            return (
              <li
                key={rel.id}
                className={cn(
                  'flex items-center gap-2 rounded border border-border bg-muted px-3 py-2',
                )}
              >
                <span className="font-serif text-sm font-medium text-foreground">
                  {other?.name ?? '（未知角色）'}
                </span>
                <Tag variant="secondary" size="sm">
                  {RELATION_LABEL[rel.type]}
                </Tag>
                {rel.description && (
                  <span className="truncate text-xs text-muted-foreground">
                    {rel.description}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => onDeleteRelation(rel.id)}
                  className={cn(
                    'ml-auto rounded p-1 text-muted-foreground transition-colors',
                    'hover:bg-primary/10 hover:text-primary',
                  )}
                  aria-label={`删除与 ${other?.name ?? '未知角色'} 的关系`}
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mb-3 text-xs text-muted-foreground">
          尚无人物关系，可在下方新增。
        </p>
      )}

      {/* 新增关系表单 */}
      <div className="grid grid-cols-[1fr_120px_1fr_auto] items-end gap-2">
        <div className="flex flex-col">
          <label className="mb-1.5 block text-xs text-muted-foreground">
            对方角色
          </label>
          <select
            value={newRel.toId}
            onChange={(e) =>
              setNewRel((p) => ({ ...p, toId: e.target.value }))
            }
            className={cn(
              'w-full rounded border border-border bg-muted px-2 py-2',
              'font-serif text-sm text-foreground',
              'focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary/25',
            )}
          >
            <option value="">选择角色…</option>
            {otherCharOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.alias ? ` · ${c.alias}` : ''}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col">
          <label className="mb-1.5 block text-xs text-muted-foreground">
            关系类型
          </label>
          <select
            value={newRel.type}
            onChange={(e) =>
              setNewRel((p) => ({
                ...p,
                type: e.target.value as RelationType,
              }))
            }
            className={cn(
              'w-full rounded border border-border bg-muted px-2 py-2',
              'font-serif text-sm text-foreground',
              'focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary/25',
            )}
          >
            {RELATION_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <Input
          name="relDesc"
          value={newRel.description}
          onChange={(e) =>
            setNewRel((p) => ({ ...p, description: e.target.value }))
          }
          placeholder="关系描述（可选）"
        />
        <Button
          variant="ghost"
          size="md"
          icon={<Plus className="h-4 w-4" aria-hidden="true" />}
          onClick={onAddRelation}
          disabled={!newRel.toId}
        >
          添加
        </Button>
      </div>
    </section>
  );
}
