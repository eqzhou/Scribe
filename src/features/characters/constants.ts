/**
 * CharacterForm 共享常量与类型定义
 *
 * 从 CharacterForm.tsx 提取的角色表单常量、类型与默认值，
 * 供主表单与各分区子组件复用。
 */
import type {
  CharacterRelation,
  CharacterRole,
  RelationType,
} from '../../types';

/** 角色类型选项：value + 中文标签 */
export const ROLE_OPTIONS: ReadonlyArray<{ value: CharacterRole; label: string }> = [
  { value: 'protagonist', label: '主角' },
  { value: 'supporting', label: '配角' },
  { value: 'antagonist', label: '反派' },
  { value: 'minor', label: '次要' },
];

/** 关系类型选项：value + 中文标签 */
export const RELATION_OPTIONS: ReadonlyArray<{
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
export const RELATION_LABEL: Record<RelationType, string> = {
  family: '亲属',
  friend: '朋友',
  rival: '对手',
  lover: '恋人',
  mentor: '师徒',
  subordinate: '上下级',
  other: '其他',
};

/** 头像主题色 6 预设 */
export const COLOR_PRESETS: readonly string[] = [
  '#c8553d', // 朱砂
  '#3d4a3d', // 墨绿
  '#b08d57', // 铜金
  '#1a1612', // 墨黑
  '#5a6b8a', // 青黛
  '#7a8ca0', // 雪青
];

/** 表单状态 */
export interface CharacterFormState {
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
export const DEFAULT_FORM: CharacterFormState = {
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
export interface NewRelationState {
  toId: string;
  type: RelationType;
  description: string;
}

export const EMPTY_NEW_RELATION: NewRelationState = {
  toId: '',
  type: 'friend',
  description: '',
};

/**
 * 取关系中的"另一方"角色 ID。
 * 若 rel 双端均非 currentId，返回 null（理论不该发生）。
 */
export function getOtherId(
  rel: CharacterRelation,
  currentId: string,
): string | null {
  if (rel.fromId === currentId) return rel.toId;
  if (rel.toId === currentId) return rel.fromId;
  return null;
}
