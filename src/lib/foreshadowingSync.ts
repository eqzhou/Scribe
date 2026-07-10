import type { Foreshadowing } from '../types';

export type ForeshadowingAction = 'plant' | 'payoff';

/**
 * 根据实际章节分析结果更新伏笔状态。
 * 蓝图中的章节关联只是计划；只有分析命中该章节或原本没有计划章节时才修改。
 */
export function resolveForeshadowingSyncPatch(
  existing: Foreshadowing,
  action: ForeshadowingAction,
  chapterId: string,
): Partial<Foreshadowing> {
  if (action === 'plant') {
    if (existing.setupChapterId && existing.setupChapterId !== chapterId) return {};
    return {
      ...(existing.setupChapterId ? {} : { setupChapterId: chapterId }),
      ...(existing.status === 'pending' ? { status: 'planted' } : {}),
    };
  }

  if (existing.payoffChapterId && existing.payoffChapterId !== chapterId) return {};
  return {
    ...(existing.payoffChapterId ? {} : { payoffChapterId: chapterId }),
    ...(existing.status === 'paidoff' ? {} : { status: 'paidoff' }),
  };
}
