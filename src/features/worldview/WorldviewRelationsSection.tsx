/**
 * WorldviewRelationsSection 世界观条目关联实体区
 *
 * 从 EntryEditor 提取的「关联角色 + 关联场景」双栏 checkbox 列表。
 * 与父表单通过受控的选中 ID 列表与切换回调通信。
 */
import type { Character, Scene } from '../../types';
import { cn } from '../../utils/cn';

interface WorldviewRelationsSectionProps {
  /** 当前作品可选的角色列表 */
  characters: Character[];
  /** 当前作品可选的场景列表 */
  scenes: Scene[];
  /** 已选中的角色 ID 列表 */
  selectedCharacterIds: string[];
  /** 已选中的场景 ID 列表 */
  selectedSceneIds: string[];
  /** 切换角色选中状态 */
  onToggleCharacter: (id: string) => void;
  /** 切换场景选中状态 */
  onToggleScene: (id: string) => void;
}

/**
 * 世界观条目的关联角色与关联场景双栏选择区。
 */
export function WorldviewRelationsSection({
  characters,
  scenes,
  selectedCharacterIds,
  selectedSceneIds,
  onToggleCharacter,
  onToggleScene,
}: WorldviewRelationsSectionProps) {
  return (
    <div className="grid grid-cols-2 gap-4">
      {/* 关联角色 */}
      <div className="flex flex-col">
        <label className="mb-1.5 block font-serif text-sm text-foreground">
          关联角色
        </label>
        <div className="max-h-44 overflow-y-auto rounded border border-border bg-muted px-2 py-1.5">
          {characters.length === 0 ? (
            <p className="px-1 py-2 text-xs text-muted-foreground">
              当前作品尚无角色
            </p>
          ) : (
            <ul className="flex flex-col gap-0.5">
              {characters.map((c) => {
                const checked = selectedCharacterIds.includes(c.id);
                return (
                  <li key={c.id}>
                    <label
                      className={cn(
                        'flex cursor-pointer items-center gap-2 rounded px-1.5 py-1',
                        'font-serif text-sm transition-colors',
                        checked
                          ? 'bg-primary/8 text-foreground'
                          : 'text-muted-foreground hover:bg-muted',
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => onToggleCharacter(c.id)}
                        className="h-3.5 w-3.5 accent-primary"
                      />
                      <span className="font-medium">{c.name}</span>
                      {c.alias && (
                        <span className="text-[11px] text-secondary">
                          · {c.alias}
                        </span>
                      )}
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* 关联场景 */}
      <div className="flex flex-col">
        <label className="mb-1.5 block font-serif text-sm text-foreground">
          关联场景
        </label>
        <div className="max-h-44 overflow-y-auto rounded border border-border bg-muted px-2 py-1.5">
          {scenes.length === 0 ? (
            <p className="px-1 py-2 text-xs text-muted-foreground">
              当前作品尚无场景
            </p>
          ) : (
            <ul className="flex flex-col gap-0.5">
              {scenes.map((s) => {
                const checked = selectedSceneIds.includes(s.id);
                return (
                  <li key={s.id}>
                    <label
                      className={cn(
                        'flex cursor-pointer items-center gap-2 rounded px-1.5 py-1',
                        'font-serif text-sm transition-colors',
                        checked
                          ? 'bg-moss/10 text-foreground'
                          : 'text-muted-foreground hover:bg-muted',
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => onToggleScene(s.id)}
                        className="h-3.5 w-3.5 accent-primary"
                      />
                      <span className="font-medium">{s.name}</span>
                      {s.atmosphere.length > 0 && (
                        <span className="text-[11px] text-moss">
                          · {s.atmosphere.slice(0, 2).join(' / ')}
                        </span>
                      )}
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

export default WorldviewRelationsSection;
