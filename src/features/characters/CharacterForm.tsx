/**
 * CharacterForm 角色档案编辑
 *
 * 基于 Modal（宽度 800px）实现：
 * - 基本信息区：姓名/别名/阵营/角色类型/生日/年龄/头像主题色（6 预设）
 * - 详情区（均为 Textarea）：外貌描述/性格/背景/成长线
 * - 标签管理：输入回车添加，点击 x 删除（复用 TagInput）
 * - 关系管理（仅编辑模式）：双向查询 fromId/toId，展示对方角色 + 类型 + 描述 + 删除；新增关系
 * - 保存：调用 characterRepository.create / update
 * - 删除：ConfirmDialog 显示影响范围（关联关系数 + 世界观关联数），并清理反向引用
 *
 * 主文件负责状态管理、副作用、提交/删除/关系处理逻辑，并组合各分区子组件。
 */
import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { X } from 'lucide-react';
import { db } from '../../lib/db';
import {
  characterRepository,
  relationRepository,
  worldviewRepository,
} from '../../lib/repositories';
import { syncCharacterWorldviewRelations } from '../../lib/relationSync';
import { useDeleteWithImpact } from '../../hooks/useDeleteWithImpact';
import type {
  Character,
  CharacterRelation,
  WorldviewEntry,
} from '../../types';
import { cn } from '../../utils/cn';
import {
  Modal,
  Tag,
  TagInput,
  EditModalFooter,
} from '../../components/ui';
import {
  COLOR_PRESETS,
  DEFAULT_FORM,
  EMPTY_NEW_RELATION,
  type CharacterFormState,
  type NewRelationState,
} from './constants';
import { CharacterBasicInfoSection } from './CharacterBasicInfoSection';
import { CharacterProfileSection } from './CharacterProfileSection';
import { CharacterRelationsSection } from './CharacterRelationsSection';
import {
  NameChangeNoticeModal,
  type NameChangeInfo,
} from './NameChangeNoticeModal';

export interface CharacterFormProps {
  /** 是否打开 */
  open: boolean;
  /** 关闭回调 */
  onClose: () => void;
  /** 编辑目标角色；为 null 时表示新建 */
  character: Character | null;
  /** 当前作品 ID */
  bookId: string;
  /** 保存成功回调 */
  onSaved?: (character: Character) => void;
  /** 删除成功回调 */
  onDeleted?: (id: string) => void;
}

/**
 * 角色档案编辑表单。
 */
export function CharacterForm({
  open,
  onClose,
  character,
  bookId,
  onSaved,
  onDeleted,
}: CharacterFormProps) {
  const [form, setForm] = useState<CharacterFormState>(DEFAULT_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newRel, setNewRel] = useState<NewRelationState>(EMPTY_NEW_RELATION);
  /** 姓名变更提示信息（保存后若有章节引用则弹出） */
  const [nameChangeInfo, setNameChangeInfo] = useState<NameChangeInfo | null>(
    null,
  );

  // 删除影响检测：复用通用 Hook（打开确认弹窗 + 检测引用影响）
  const {
    confirmOpen,
    deleteImpact,
    requestDelete,
    cancelDelete,
  } = useDeleteWithImpact();

  const isEditing = Boolean(character);
  const charId = character?.id ?? null;
  const [arcView, setArcView] = useState<'text' | 'timeline'>('text');

  // 实时监听当前作品全部角色（供关系选择与名称查询）
  const allCharacters = useLiveQuery(
    () => db.characters.where('bookId').equals(bookId).toArray(),
    [bookId],
    [] as Character[],
  );

  // 实时监听当前作品全部世界观条目（供关联多选）
  const allWorldview = useLiveQuery(
    () => db.worldview.where('bookId').equals(bookId).toArray(),
    [bookId],
    [] as WorldviewEntry[],
  );

  // 编辑模式：实时监听当前角色的全部关系（双向）
  const charRelations = useLiveQuery(
    async () => {
      if (!charId) return [];
      return relationRepository.listByCharacter(charId);
    },
    [charId],
    [] as CharacterRelation[],
  );

  // 弹窗打开或目标变化时同步表单
  useEffect(() => {
    if (!open) return;
    if (character) {
      setForm({
        name: character.name,
        alias: character.alias,
        faction: character.faction,
        role: character.role,
        birthday: character.birthday ?? '',
        age: character.age != null ? String(character.age) : '',
        appearanceColor: character.appearanceColor || COLOR_PRESETS[0],
        appearance: character.appearance,
        personality: character.personality,
        background: character.background,
        arc: character.arc,
        tags: [...character.tags],
        relatedWorldviewIds: [...(character.relatedWorldviewIds ?? [])],
      });
    } else {
      setForm(DEFAULT_FORM);
    }
    setNewRel(EMPTY_NEW_RELATION);
    setError(null);
    cancelDelete();
  }, [open, character]);

  /** 通用字段更新 */
  const updateField = <K extends keyof CharacterFormState>(
    key: K,
    value: CharacterFormState[K],
  ): void => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  /** 提交保存：校验 + Repository 写入 + 世界观双向同步 + 姓名变更检测 */
  const handleSubmit = async (): Promise<void> => {
    if (!form.name.trim()) {
      setError('请填写角色姓名');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const ageNum = form.age.trim() ? Number(form.age) : undefined;
      const newName = form.name.trim();
      const oldName = character?.name;
      const nameChanged = character != null && oldName !== newName;
      // 姓名变更时扫描章节中引用该角色的 CharacterMention 节点
      let mentionCount = 0;
      if (nameChanged) {
        const chapters = await db.chapters.where('bookId').equals(bookId).toArray();
        mentionCount = chapters.filter((c) => c.content.includes(character!.id)).length;
      }

      const newWorldviewIds = form.relatedWorldviewIds;
      const oldWorldviewIds = character?.relatedWorldviewIds ?? [];

      const payload = {
        bookId,
        name: newName,
        alias: form.alias.trim(),
        faction: form.faction.trim(),
        role: form.role,
        appearance: form.appearance.trim(),
        personality: form.personality.trim(),
        background: form.background.trim(),
        arc: form.arc.trim(),
        birthday: form.birthday.trim() || undefined,
        age: ageNum != null && Number.isFinite(ageNum) ? ageNum : undefined,
        appearanceColor: form.appearanceColor,
        tags: form.tags,
        relatedWorldviewIds: newWorldviewIds,
      };

      const saved = character
        ? await characterRepository.update(character.id, payload)
        : await characterRepository.create(payload);

      // 世界观条目双向同步：将 saved.id 写入/移出 worldview.relatedCharacterIds
      await syncCharacterWorldviewRelations(
        saved.id,
        oldWorldviewIds,
        newWorldviewIds,
      );

      // 姓名变更：若有章节引用，提示用户刷新提及节点显示名
      if (nameChanged && mentionCount > 0) {
        setNameChangeInfo({ oldName: oldName!, newName, mentionCount, charId: saved.id });
      }

      onSaved?.(saved);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSubmitting(false);
    }
  };

  /** 触发删除确认：由 Hook 打开弹窗并检测引用影响 */
  const handleDelete = async (): Promise<void> => {
    if (!character) return;
    await requestDelete('character', character.id, bookId);
  };

  /** 确认删除：清理关联关系 + 世界观反向引用 + 删除角色本身 */
  const handleDeleteConfirm = async (): Promise<void> => {
    if (!character) return;
    setDeleting(true);
    try {
      await db.transaction(
        'rw',
        [db.characters, db.relations, db.worldview],
        async () => {
          // 1. 删除涉及该角色的全部关系
          const rels = await relationRepository.listByCharacter(character.id);
          for (const rel of rels) {
            await relationRepository.delete(rel.id);
          }
          // 2. 清理世界观条目的反向引用
          if ((character.relatedWorldviewIds ?? []).length > 0) {
            const linkedEntries = await db.worldview
              .where('id')
              .anyOf(character.relatedWorldviewIds ?? [])
              .toArray();
            for (const entry of linkedEntries) {
              const next = entry.relatedCharacterIds.filter(
                (id) => id !== character.id,
              );
              await worldviewRepository.update(entry.id, {
                relatedCharacterIds: next,
              });
            }
          }
          // 3. 删除角色本身
          await characterRepository.delete(character.id);
        },
      );
      onDeleted?.(character.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败');
    } finally {
      setDeleting(false);
    }
  };

  /** 新增关系 */
  const handleAddRelation = async (): Promise<void> => {
    if (!character || !newRel.toId) return;
    if (newRel.toId === character.id) {
      setError('不能与自身建立关系');
      return;
    }
    try {
      await relationRepository.create({
        bookId,
        fromId: character.id,
        toId: newRel.toId,
        type: newRel.type,
        description: newRel.description.trim(),
      });
      setNewRel(EMPTY_NEW_RELATION);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '添加关系失败');
    }
  };

  /** 删除关系 */
  const handleDeleteRelation = async (relId: string): Promise<void> => {
    try {
      await relationRepository.delete(relId);
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除关系失败');
    }
  };

  const title = character ? '编辑角色' : '新建角色';

  return (
    <>
      <Modal open={open} onClose={onClose} title={title} width="800px">
        <div className="flex flex-col gap-5">
          {/* ============ 基本信息区 ============ */}
          <CharacterBasicInfoSection form={form} updateField={updateField} />

          {/* ============ 角色档案详情区 ============ */}
          <CharacterProfileSection
            form={form}
            updateField={updateField}
            arcView={arcView}
            setArcView={setArcView}
          />

          {/* ============ 标签管理 ============ */}
          <TagInput
            tags={form.tags}
            onChange={(tags) => updateField('tags', tags)}
          />

          {/* ============ 关联世界观 ============ */}
          <section>
            <label className="mb-1.5 block font-serif text-sm text-foreground">
              关联世界观
            </label>
            {allWorldview.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                当前作品暂无世界观条目，可先在「世界观」模块创建。
              </p>
            ) : (
              <div className="flex flex-wrap items-center gap-2 rounded border border-border bg-muted px-2 py-2">
                {form.relatedWorldviewIds.map((wvId) => {
                  const wv = allWorldview.find((w) => w.id === wvId);
                  if (!wv) return null;
                  return (
                    <Tag key={wvId} variant="secondary" size="sm">
                      <span className="inline-flex items-center gap-1">
                        {wv.title}
                        <button
                          type="button"
                          onClick={() =>
                            updateField(
                              'relatedWorldviewIds',
                              form.relatedWorldviewIds.filter((id) => id !== wvId),
                            )
                          }
                          className="text-secondary transition-colors hover:text-primary"
                          aria-label={`移除关联 ${wv.title}`}
                        >
                          <X className="h-3 w-3" aria-hidden="true" />
                        </button>
                      </span>
                    </Tag>
                  );
                })}
                <select
                  value=""
                  onChange={(e) => {
                    const id = e.target.value;
                    if (!id) return;
                    if (!form.relatedWorldviewIds.includes(id)) {
                      updateField('relatedWorldviewIds', [
                        ...form.relatedWorldviewIds,
                        id,
                      ]);
                    }
                    e.target.value = '';
                  }}
                  className={cn(
                    'min-w-[140px] flex-1 rounded border border-border bg-background px-2 py-1',
                    'font-serif text-sm text-foreground',
                    'focus:border-secondary focus:outline-none',
                  )}
                >
                  <option value="">添加关联世界观…</option>
                  {allWorldview
                    .filter((w) => !form.relatedWorldviewIds.includes(w.id))
                    .map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.title}
                      </option>
                    ))}
                </select>
              </div>
            )}
          </section>

          {/* ============ 关系管理（仅编辑模式） ============ */}
          {isEditing && character && (
            <CharacterRelationsSection
              character={character}
              allCharacters={allCharacters}
              charRelations={charRelations}
              onAddRelation={handleAddRelation}
              onDeleteRelation={handleDeleteRelation}
              newRel={newRel}
              setNewRel={setNewRel}
            />
          )}

          {/* 错误提示 */}
          {error && (
            <p className="rounded border border-primary/40 bg-primary/8 px-3 py-2 text-xs text-primary">
              {error}
            </p>
          )}

          {/* 操作区 + 删除确认弹窗 */}
          <EditModalFooter
            isEditing={isEditing}
            deleteLabel="删除角色"
            submitLabel={isEditing ? '保存修改' : '创建角色'}
            submitting={submitting}
            deleting={deleting}
            onCancel={onClose}
            onSubmit={handleSubmit}
            onDelete={() => void handleDelete()}
            onConfirmDelete={handleDeleteConfirm}
            onCancelDelete={() => {
              if (deleting) return;
              cancelDelete();
            }}
            confirmOpen={confirmOpen}
            deleteImpact={deleteImpact}
            deleteTitle="删除角色"
            deleteMessage={`确认永久删除角色「${character?.name ?? ''}」？此操作不可撤销。`}
          />
        </div>
      </Modal>

      {/* 姓名变更同步提示 */}
      <NameChangeNoticeModal
        nameChangeInfo={nameChangeInfo}
        onClose={() => setNameChangeInfo(null)}
        onSync={async () => {
          if (!nameChangeInfo) return;
          await applyNameSync(
            nameChangeInfo.charId,
            nameChangeInfo.oldName,
            nameChangeInfo.newName,
            bookId,
          );
          setNameChangeInfo(null);
        }}
      />
    </>
  );
}

export default CharacterForm;

/**
 * 同步章节正文中角色提及节点的显示名。
 *
 * CharacterMention 节点的 HTML 形如：
 *   <span data-character-mention data-character-id="char-1" data-label="旧名">@旧名</span>
 * 此函数扫描所有包含该 characterId 的章节，将 data-label 与文本节点中的旧名替换为新名。
 */
async function applyNameSync(
  characterId: string,
  oldName: string,
  newName: string,
  bookId: string,
): Promise<void> {
  const chapters = await db.chapters.where('bookId').equals(bookId).toArray();
  // 转义正则特殊字符
  const escapeReg = (s: string): string =>
    s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const labelRe = new RegExp(
    `(<span[^>]*data-character-id="${escapeReg(characterId)}"[^>]*data-label=")${escapeReg(oldName)}(")(.*?>@)${escapeReg(oldName)}(<\\/span>)`,
    'g',
  );
  await db.transaction('rw', db.chapters, async () => {
    for (const ch of chapters) {
      if (!ch.content.includes(characterId)) continue;
      const next = ch.content.replace(labelRe, `$1${newName}$2$3${newName}$4`);
      if (next !== ch.content) {
        await db.chapters.update(ch.id, { content: next, updatedAt: Date.now() });
      }
    }
  });
}
