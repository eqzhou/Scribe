import type { ProjectBlueprintResult } from '../../types/ai';

export type BlueprintSectionKey = keyof Pick<
  ProjectBlueprintResult,
  | 'worldview'
  | 'characters'
  | 'scenes'
  | 'plotLines'
  | 'plotPoints'
  | 'inspirations'
  | 'foreshadowing'
  | 'chapters'
>;

export function countBlueprintItems(blueprint: ProjectBlueprintResult): number {
  return blueprint.worldview.length
    + blueprint.characters.length
    + blueprint.scenes.length
    + blueprint.plotLines.length
    + blueprint.plotPoints.length
    + blueprint.inspirations.length
    + blueprint.foreshadowing.length
    + blueprint.chapters.length;
}

export function removeBlueprintItem(
  blueprint: ProjectBlueprintResult,
  section: BlueprintSectionKey,
  index: number,
): ProjectBlueprintResult {
  const removed = blueprint[section][index] as Record<string, unknown> | undefined;
  const next = {
    ...blueprint,
    [section]: blueprint[section].filter((_, itemIndex) => itemIndex !== index),
  } as ProjectBlueprintResult;
  if (!removed) return next;

  if (section === 'plotLines') {
    const removedTitle = String(removed.title ?? '');
    return {
      ...next,
      plotPoints: next.plotPoints.filter((item) => item.plotLineTitle !== removedTitle),
    };
  }
  if (section === 'chapters') {
    const removedTitle = String(removed.title ?? '');
    return {
      ...next,
      scenes: next.scenes.map((item) => ({
        ...item,
        chapterTitles: (item.chapterTitles ?? []).filter((title) => title !== removedTitle),
      })),
      plotPoints: next.plotPoints.map((item) => (
        item.chapterTitle === removedTitle ? { ...item, chapterTitle: undefined } : item
      )),
      foreshadowing: next.foreshadowing.map((item) => ({
        ...item,
        setupChapterTitle: item.setupChapterTitle === removedTitle ? undefined : item.setupChapterTitle,
        payoffChapterTitle: item.payoffChapterTitle === removedTitle ? undefined : item.payoffChapterTitle,
      })),
    };
  }
  if (section === 'characters') {
    const removedName = String(removed.name ?? '');
    return {
      ...next,
      scenes: next.scenes.map((item) => ({
        ...item,
        characterNames: (item.characterNames ?? []).filter((name) => name !== removedName),
      })),
      plotPoints: next.plotPoints.map((item) => ({
        ...item,
        characterNames: (item.characterNames ?? []).filter((name) => name !== removedName),
      })),
    };
  }
  if (section === 'worldview') {
    const removedTitle = String(removed.title ?? '');
    return {
      ...next,
      characters: next.characters.map((item) => ({
        ...item,
        relatedWorldviewTitles: (item.relatedWorldviewTitles ?? []).filter((title) => title !== removedTitle),
      })),
      scenes: next.scenes.map((item) => ({
        ...item,
        worldviewTitles: (item.worldviewTitles ?? []).filter((title) => title !== removedTitle),
      })),
    };
  }
  return next;
}
