/**
 * CharacterForm 角色档案编辑
 *
 * 基于 Modal（宽度 800px）实现：
 * - 基本信息区：姓名/别名/阵营/角色类型/生日/年龄/头像主题色（6 预设）
 * - 详情区（均为 Textarea）：外貌描述/性格/背景/成长线
 * - 标签管理：输入回车添加，点击 x 删除
 * - 关系管理（仅编辑模式）：双向查询 fromId/toId，展示对方角色 + 类型 + 描述 + 删除；新增关系
 * - 保存：调用 characterRepository.create / update
 * - 删除：ConfirmDialog 显示影响范围（关联关系数 + 世界观关联数），并清理反向引用
 */
import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { X, Trash2, Plus } from 'lucide-react';
import { db } from '../../lib/db';
import {
  characterRepository,
  relationRepository,
  worldviewRepository,
} from '../../lib/repositories';
import { checkReferences } from '../../lib/referenceChecker';
import type {
  Character,
  CharacterRelation,
  CharacterRole,
  RelationType,
  WorldviewEntry,
} from '../../types';
import type { ImpactInfo } from '../../components/ui';
import { cn } from '../../utils/cn';
import {
  Modal,
  Button,
  Input,
  Textarea,
  Tag,
  ConfirmDialog,
} from '../../components/ui';

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

/** 角色类型选项：value + 中文标签 */
const ROLE_OPTIONS: ReadonlyArray<{ value: CharacterRole; label: string }> = [
  { value: 'protagonist', label: '主角' },
  { value: 'supporting', label: '配角' },
  { value: 'antagonist', label: '反派' },
  { value: 'minor', label: '次要' },
];

/** 关系类型选项：value + 中文标签 */
const RELATION_OPTIONS: ReadonlyArray<{
  value: RelationType;
  label: string;
}> = [
  { value: 'family', label: '亲属' },
  { value: 'friend', label: '朋友' },
  { value: 'rival', label: '对手' },
  { value: 'lover', label: '恋人' },
  { value: 'mentor', label: '师徒' },
  { value: 'subordinate', label: '上下级' },
  { value: 'other', label: '其他' },
];

/** 关系类型 → 中文标签映射 */
const RELATION_LABEL: Record<RelationType, string> = {
  family: '亲属',
  friend: '朋友',
  rival: '对手',
  lover: '恋人',
  mentor: '师徒',
  subordinate: '上下级',
  other: '其他',
};

/** 头像主题色 6 预设 */
const COLOR_PRESETS: readonly string[] = [
  '#c8553d', // 朱砂
  '#3d4a3d', // 墨绿
  '#b08d57', // 铜金
  '#1a1612', // 墨黑
  '#5a6b8a', // 青黛
  '#7a8ca0', // 雪青
];

/** 表单状态 */
interface CharacterFormState {
  name: string;
  alias: string;
  faction: string;
  role: CharacterRole;
  birthday: string;
  age: string;
  appearanceColor: string;
  appearance: string;
  personality: string;
  background: string;
  arc: string;
  tags: string[];
  relatedWorldviewIds: string[];
}

/** 默认表单值 */
const DEFAULT_FORM: CharacterFormState = {
  name: '',
  alias: '',
  faction: '',
  role: 'supporting',
  birthday: '',
  age: '',
  appearanceColor: COLOR_PRESETS[0],
  appearance: '',
  personality: '',
  background: '',
  arc: '',
  tags: [],
  relatedWorldviewIds: [],
};

/** 新增关系表单状态 */
interface NewRelationState {
  toId: string;
  type: RelationType;
  description: string;
}

const EMPTY_NEW_RELATION: NewRelationState = {
  toId: '',
  type: 'friend',
  description: '',
};

/**
 * 取关系中的"另一方"角色 ID。
 * 若 rel 双端均非 currentId，返回 null（理论不该发生）。
 */
function getOtherId(
  rel: CharacterRelation,
  currentId: string,
): string | null {
  if (rel.fromId === currentId) return rel.toId;
  if (rel.toId === currentId) return rel.fromId;
  return null;
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
  const [tagInput, setTagInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteImpact, setDeleteImpact] = useState<ImpactInfo | null>(null);
  const [newRel, setNewRel] = useState<NewRelationState>(EMPTY_NEW_RELATION);
  /** 姓名变更提示信息（保存后若有章节引用则弹出） */
  const [nameChangeInfo, setNameChangeInfo] = useState<{
    oldName: string;
    newName: string;
    mentionCount: number;
    charId: string;
  } | null>(null);

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
    setTagInput('');
    setNewRel(EMPTY_NEW_RELATION);
    setError(null);
    setDeleteImpact(null);
  }, [open, character]);

  /** 通用字段更新 */
  const updateField = <K extends keyof CharacterFormState>(
    key: K,
    value: CharacterFormState[K],
  ): void => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  /** 添加标签：回车触发，去重并清空输入 */
  const handleTagAdd = (): void => {
    const value = tagInput.trim();
    if (!value) return;
    if (form.tags.includes(value)) {
      setTagInput('');
      return;
    }
    updateField('tags', [...form.tags, value]);
    setTagInput('');
  };

  /** 删除标签 */
  const handleTagRemove = (tag: string): void => {
    updateField(
      'tags',
      form.tags.filter((t) => t !== tag),
    );
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
      await syncWorldviewRelations(saved.id, oldWorldviewIds, newWorldviewIds);

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

  /** 触发删除确认：先检测引用影响 */
  const handleDelete = async (): Promise<void> => {
    if (!character) return;
    setConfirmOpen(true);
    setDeleteImpact(null);
    const impact = await checkReferences('character', character.id, bookId);
    setDeleteImpact(impact);
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

  // 角色 id → name 映射，供关系列表查询对方名称
  const charNameMap = new Map<string, Character>();
  for (const c of allCharacters) charNameMap.set(c.id, c);

  // 可选的"对方角色"：排除自身
  const otherCharOptions = allCharacters.filter((c) => c.id !== charId);

  const title = character ? '编辑角色' : '新建角色';

  return (
    <>
      <Modal open={open} onClose={onClose} title={title} width="800px">
        <div className="flex flex-col gap-5">
          {/* ============ 基本信息区 ============ */}
          <section>
            <h3 className="mb-3 font-serif text-sm font-semibold tracking-wide text-secondary">
              § 基本信息
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="姓名"
                name="name"
                value={form.name}
                onChange={(e) => updateField('name', e.target.value)}
                placeholder="如：沈云舟"
                maxLength={30}
                required
              />
              <Input
                label="别名 / 称号"
                name="alias"
                value={form.alias}
                onChange={(e) => updateField('alias', e.target.value)}
                placeholder="如：孤剑客"
                maxLength={30}
              />
              <Input
                label="阵营"
                name="faction"
                value={form.faction}
                onChange={(e) => updateField('faction', e.target.value)}
                placeholder="如：听雨楼"
                maxLength={30}
              />
              {/* 角色类型 select */}
              <div className="flex flex-col">
                <label className="mb-1.5 block font-serif text-sm text-foreground">
                  角色类型
                </label>
                <select
                  value={form.role}
                  onChange={(e) =>
                    updateField('role', e.target.value as CharacterRole)
                  }
                  className={cn(
                    'w-full rounded border border-border bg-muted px-3 py-2',
                    'font-serif text-sm text-foreground',
                    'transition-all duration-200',
                    'focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary/25',
                  )}
                >
                  {ROLE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <Input
                label="生日"
                name="birthday"
                type="date"
                value={form.birthday}
                onChange={(e) => updateField('birthday', e.target.value)}
              />
              <Input
                label="年龄"
                name="age"
                type="number"
                min={0}
                value={form.age}
                onChange={(e) => updateField('age', e.target.value)}
                placeholder="如：24"
              />
              {/* 头像主题色选择器 */}
              <div className="col-span-2 flex flex-col">
                <label className="mb-1.5 block font-serif text-sm text-foreground">
                  头像主题色
                </label>
                <div className="flex items-center gap-2.5">
                  {COLOR_PRESETS.map((color) => {
                    const selected = form.appearanceColor === color;
                    return (
                      <button
                        key={color}
                        type="button"
                        onClick={() => updateField('appearanceColor', color)}
                        title={color}
                        aria-label={`选择主题色 ${color}`}
                        aria-pressed={selected}
                        className={cn(
                          'h-8 w-8 rounded-full border-2 transition-all duration-200',
                          selected
                            ? 'scale-110 border-foreground shadow-soft'
                            : 'border-border hover:scale-105 hover:border-secondary',
                        )}
                        style={{ backgroundColor: color }}
                      />
                    );
                  })}
                  <span className="ml-1 font-mono text-[11px] text-muted-foreground">
                    {form.appearanceColor}
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* ============ 角色档案详情区 ============ */}
          <section>
            <h3 className="mb-3 font-serif text-sm font-semibold tracking-wide text-secondary">
              § 角色档案
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <Textarea
                label="外貌描述"
                name="appearance"
                value={form.appearance}
                onChange={(e) => updateField('appearance', e.target.value)}
                placeholder="身形、面容、衣着、随身之物…"
                rows={4}
              />
              <Textarea
                label="性格"
                name="personality"
                value={form.personality}
                onChange={(e) => updateField('personality', e.target.value)}
                placeholder="性情、脾性、行事作风…"
                rows={4}
              />
              <Textarea
                label="背景"
                name="background"
                value={form.background}
                onChange={(e) => updateField('background', e.target.value)}
                placeholder="出身、经历、重要往事…"
                rows={4}
              />
              <div className="flex flex-col">
                <div className="mb-1.5 flex items-center justify-between">
                  <label className="block font-serif text-sm text-foreground">
                    成长线
                  </label>
                  <div className="flex items-center gap-1 rounded-lg border border-border bg-muted p-0.5">
                    <button
                      type="button"
                      onClick={() => setArcView('text')}
                      className={cn(
                        'rounded-md px-2 py-0.5 text-xs transition-colors',
                        arcView === 'text'
                          ? 'bg-background text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground',
                      )}
                    >
                      文本视图
                    </button>
                    <button
                      type="button"
                      onClick={() => setArcView('timeline')}
                      className={cn(
                        'rounded-md px-2 py-0.5 text-xs transition-colors',
                        arcView === 'timeline'
                          ? 'bg-background text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground',
                      )}
                    >
                      时间线视图
                    </button>
                  </div>
                </div>
                {arcView === 'text' ? (
                  <Textarea
                    name="arc"
                    value={form.arc}
                    onChange={(e) => updateField('arc', e.target.value)}
                    placeholder="角色在故事中的转变与成长轨迹…"
                    rows={4}
                  />
                ) : (
                  <div className="rounded border border-border bg-muted px-3 py-3">
                    {form.arc.trim() ? (
                      <div className="relative pl-6">
                        <div
                          className="absolute left-[7px] top-1 bottom-1 w-px bg-border"
                          aria-hidden="true"
                        />
                        <ul className="space-y-3">
                          {form.arc
                            .split('\n')
                            .map((line) => line.trim())
                            .filter(Boolean)
                            .map((line, idx) => {
                              const match = line.match(/^(.+?)[：:](.+)$/);
                              const timePoint = match ? match[1].trim() : null;
                              const description = match ? match[2].trim() : line;
                              return (
                                <li key={idx} className="relative">
                                  <span
                                    className={cn(
                                      'absolute -left-6 top-1 h-3 w-3 rounded-full border-2 border-primary bg-background',
                                    )}
                                    aria-hidden="true"
                                  />
                                  <div className="flex flex-col gap-0.5">
                                    {timePoint && (
                                      <span className="text-xs font-semibold text-primary">
                                        {timePoint}
                                      </span>
                                    )}
                                    <p className="text-xs leading-relaxed text-foreground">
                                      {description}
                                    </p>
                                  </div>
                                </li>
                              );
                            })}
                        </ul>
                      </div>
                    ) : (
                      <p className="text-xs italic text-muted-foreground">
                        暂无成长线内容，切换到文本视图添加。
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* ============ 标签管理 ============ */}
          <section>
            <label className="mb-1.5 block font-serif text-sm text-foreground">
              标签
            </label>
            <div className="flex flex-wrap items-center gap-2 rounded border border-border bg-muted px-2 py-2">
              {form.tags.map((tag) => (
                <Tag key={tag} variant="secondary" size="sm">
                  <span className="inline-flex items-center gap-1">
                    {tag}
                    <button
                      type="button"
                      onClick={() => handleTagRemove(tag)}
                      className="text-secondary/70 transition-colors hover:text-primary"
                      aria-label={`删除标签 ${tag}`}
                    >
                      <X className="h-3 w-3" aria-hidden="true" />
                    </button>
                  </span>
                </Tag>
              ))}
              <input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleTagAdd();
                  }
                }}
                placeholder={
                  form.tags.length === 0
                    ? '输入标签后回车添加'
                    : '继续添加…'
                }
                className={cn(
                  'min-w-[120px] flex-1 bg-transparent px-1 py-0.5',
                  'font-serif text-sm text-foreground',
                  'placeholder:text-muted-foreground focus:outline-none',
                )}
              />
            </div>
          </section>

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
                          className="text-secondary/70 transition-colors hover:text-primary"
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
            <section>
              <h3 className="mb-3 font-serif text-sm font-semibold tracking-wide text-secondary">
                § 人物关系
              </h3>

              {/* 已有关系列表 */}
              {charRelations && charRelations.length > 0 ? (
                <ul className="mb-3 flex flex-col gap-1.5">
                  {charRelations.map((rel) => {
                    const otherId = getOtherId(rel, character.id);
                    const other = otherId
                      ? charNameMap.get(otherId)
                      : undefined;
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
                          onClick={() => handleDeleteRelation(rel.id)}
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
                  onClick={handleAddRelation}
                  disabled={!newRel.toId}
                >
                  添加
                </Button>
              </div>
            </section>
          )}

          {/* 错误提示 */}
          {error && (
            <p className="rounded border border-primary/40 bg-primary/8 px-3 py-2 text-xs text-primary">
              {error}
            </p>
          )}

          {/* 操作区 */}
          <div className="flex items-center justify-between gap-2 pt-2">
            {/* 左侧：删除（仅编辑态） */}
            <div>
              {isEditing && (
                <Button
                  variant="ghost"
                  size="md"
                  icon={<Trash2 className="h-4 w-4" aria-hidden="true" />}
                  onClick={() => void handleDelete()}
                  disabled={submitting || deleting}
                  className="text-primary hover:bg-primary hover:text-primary-foreground"
                >
                  删除角色
                </Button>
              )}
            </div>
            {/* 右侧：取消 + 保存 */}
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="md"
                onClick={onClose}
                disabled={submitting || deleting}
              >
                取消
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={handleSubmit}
                loading={submitting}
                disabled={deleting}
              >
                {isEditing ? '保存修改' : '创建角色'}
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      {/* 删除确认 */}
      <ConfirmDialog
        open={confirmOpen}
        onClose={() => {
          if (deleting) return;
          setConfirmOpen(false);
          setDeleteImpact(null);
        }}
        onConfirm={handleDeleteConfirm}
        title="删除角色"
        message={`确认永久删除角色「${character?.name ?? ''}」？此操作不可撤销。`}
        impactDetails={deleteImpact}
        confirmText="永久删除"
        danger
      />

      {/* 姓名变更同步提示 */}
      <Modal
        open={nameChangeInfo !== null}
        onClose={() => setNameChangeInfo(null)}
        title="检测到角色姓名变更"
        width="460px"
      >
        <div className="flex flex-col gap-4">
          <p className="font-serif text-sm leading-relaxed text-foreground">
            角色姓名已由「{nameChangeInfo?.oldName}」改为「{nameChangeInfo?.newName}」。
            该角色在 {nameChangeInfo?.mentionCount} 个章节的正文存在提及节点（@{nameChangeInfo?.oldName}）。
          </p>
          <p className="text-xs text-muted-foreground">
            提及节点存储了显示名快照，不会随角色档案自动更新。是否立即同步这些节点的显示名？
          </p>
          <div className="flex justify-end gap-2 border-t border-border/60 pt-3">
            <Button variant="ghost" size="md" onClick={() => setNameChangeInfo(null)}>
              稍后手动处理
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={async () => {
                if (!nameChangeInfo) return;
                await applyNameSync(
                  nameChangeInfo.charId,
                  nameChangeInfo.oldName,
                  nameChangeInfo.newName,
                  bookId,
                );
                setNameChangeInfo(null);
              }}
            >
              立即同步
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

export default CharacterForm;

/**
 * 世界观条目双向同步：将 characterId 写入/移出对应 worldview.relatedCharacterIds。
 * 与 EntryEditor.syncRelations 的角色方向互补，确保 character↔worldview 双向一致。
 */
async function syncWorldviewRelations(
  characterId: string,
  oldIds: string[],
  newIds: string[],
): Promise<void> {
  const added = newIds.filter((id) => !oldIds.includes(id));
  const removed = oldIds.filter((id) => !newIds.includes(id));
  if (added.length === 0 && removed.length === 0) return;

  await db.transaction('rw', db.worldview, async () => {
    for (const id of added) {
      const w = await db.worldview.get(id);
      if (!w) continue;
      const set = new Set(w.relatedCharacterIds);
      set.add(characterId);
      await worldviewRepository.update(id, {
        relatedCharacterIds: Array.from(set),
      });
    }
    for (const id of removed) {
      const w = await db.worldview.get(id);
      if (!w) continue;
      const next = w.relatedCharacterIds.filter((x) => x !== characterId);
      await worldviewRepository.update(id, {
        relatedCharacterIds: next,
      });
    }
  });
}

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
