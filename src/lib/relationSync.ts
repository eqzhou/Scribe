/**
 * 双向关联同步工具
 *
 * 从 CharacterForm.syncWorldviewRelations 和 EntryEditor.syncRelations 提取。
 * 负责 character↔worldview 和 worldview↔scene 的双向引用一致性。
 */
import {
  worldviewRepository,
  characterRepository,
  sceneRepository,
} from './repositories';

/**
 * 同步角色 → 世界观的双向引用。
 *
 * 当角色的 relatedWorldviewIds 变化时，将 characterId 写入/移出对应
 * worldview 条目的 relatedCharacterIds。
 *
 * @param characterId 角色ID
 * @param oldIds 旧的关联世界观ID列表
 * @param newIds 新的关联世界观ID列表
 */
export async function syncCharacterWorldviewRelations(
  characterId: string,
  oldIds: string[],
  newIds: string[],
): Promise<void> {
  const added = newIds.filter((id) => !oldIds.includes(id));
  const removed = oldIds.filter((id) => !newIds.includes(id));
  if (added.length === 0 && removed.length === 0) return;

  // 逐条读取并更新；后端无事务，依赖单条 PATCH 的幂等性
  for (const id of added) {
    const w = await worldviewRepository.get(id);
    if (!w) continue;
    const set = new Set(w.relatedCharacterIds);
    set.add(characterId);
    await worldviewRepository.update(id, {
      relatedCharacterIds: Array.from(set),
    });
  }
  for (const id of removed) {
    const w = await worldviewRepository.get(id);
    if (!w) continue;
    const next = w.relatedCharacterIds.filter((x) => x !== characterId);
    await worldviewRepository.update(id, {
      relatedCharacterIds: next,
    });
  }
}

/**
 * 同步世界观 → 角色/场景的双向引用。
 *
 * 当世界观条目的 relatedCharacterIds / relatedSceneIds 变化时，
 * 将 entryId 写入/移出对应 character 和 scene 的反向引用列表。
 *
 * @param entryId 世界观条目ID
 * @param oldCharIds 旧的关联角色ID列表
 * @param newCharIds 新的关联角色ID列表
 * @param oldSceneIds 旧的关联场景ID列表
 * @param newSceneIds 新的关联场景ID列表
 */
export async function syncWorldviewRelations(
  entryId: string,
  oldCharIds: string[],
  newCharIds: string[],
  oldSceneIds: string[],
  newSceneIds: string[],
): Promise<void> {
  const addedChars = newCharIds.filter((id) => !oldCharIds.includes(id));
  const removedChars = oldCharIds.filter((id) => !newCharIds.includes(id));
  const addedScenes = newSceneIds.filter((id) => !oldSceneIds.includes(id));
  const removedScenes = oldSceneIds.filter((id) => !newSceneIds.includes(id));

  // 角色：新增引用
  for (const id of addedChars) {
    const c = await characterRepository.get(id);
    if (!c) continue;
    const set = new Set(c.relatedWorldviewIds ?? []);
    set.add(entryId);
    await characterRepository.update(c.id, {
      relatedWorldviewIds: Array.from(set),
    });
  }
  // 角色：移除引用
  for (const id of removedChars) {
    const c = await characterRepository.get(id);
    if (!c) continue;
    const next = (c.relatedWorldviewIds ?? []).filter((x) => x !== entryId);
    await characterRepository.update(c.id, {
      relatedWorldviewIds: next,
    });
  }
  // 场景：新增引用
  for (const id of addedScenes) {
    const s = await sceneRepository.get(id);
    if (!s) continue;
    const set = new Set(s.worldviewEntryIds);
    set.add(entryId);
    await sceneRepository.update(s.id, {
      worldviewEntryIds: Array.from(set),
    });
  }
  // 场景：移除引用
  for (const id of removedScenes) {
    const s = await sceneRepository.get(id);
    if (!s) continue;
    const next = s.worldviewEntryIds.filter((x) => x !== entryId);
    await sceneRepository.update(s.id, {
      worldviewEntryIds: next,
    });
  }
}
