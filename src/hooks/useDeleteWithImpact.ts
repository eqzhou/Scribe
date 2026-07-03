/**
 * 通用删除影响检测 Hook
 *
 * 从 CharacterForm / EntryEditor / ChapterTree 中提取的公共删除流程：
 * 1. 打开确认弹窗 + 通过 repository 预加载作品数据，再调用 checkReferences 检测引用影响
 * 2. 展示影响详情供用户确认
 * 3. 调用方执行实际删除逻辑
 *
 * 实际删除逻辑因实体类型不同而异，由调用方通过 onConfirm 回调实现。
 */
import { useState } from 'react';
import { checkReferences } from '../lib/referenceChecker';
import { useToastStore } from '../stores';
import type { ImpactInfo } from '../components/ui/ConfirmDialog';
import {
  chapterRepository,
  characterRepository,
  sceneRepository,
  relationRepository,
  plotPointRepository,
  foreshadowingRepository,
  worldviewRepository,
} from '../lib/repositories';

interface UseDeleteWithImpactResult {
  /** 删除确认弹窗是否打开 */
  confirmOpen: boolean;
  /** 引用影响信息 */
  deleteImpact: ImpactInfo | null;
  /** 是否正在检测引用 */
  checking: boolean;
  /** 请求删除：打开确认弹窗并检测引用影响 */
  requestDelete: (
    entityType: string,
    entityId: string,
    bookId: string,
  ) => Promise<void>;
  /** 关闭确认弹窗并重置状态 */
  cancelDelete: () => void;
}

export function useDeleteWithImpact(): UseDeleteWithImpactResult {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteImpact, setDeleteImpact] = useState<ImpactInfo | null>(null);
  const [checking, setChecking] = useState(false);

  const requestDelete = async (
    entityType: string,
    entityId: string,
    bookId: string,
  ): Promise<void> => {
    setConfirmOpen(true);
    setDeleteImpact(null);
    setChecking(true);
    try {
      // 并发预加载引用检测所需的全部实体数组
      const [
        chapters,
        characters,
        worldviews,
        scenes,
        relations,
        plotPoints,
        foreshadowing,
      ] = await Promise.all([
        chapterRepository.list(bookId),
        characterRepository.list(bookId),
        worldviewRepository.list(bookId),
        sceneRepository.list(bookId),
        relationRepository.list(bookId),
        plotPointRepository.list(bookId),
        foreshadowingRepository.list(bookId),
      ]);

      const impact = checkReferences(entityType, entityId, {
        chapters,
        characters,
        worldviews,
        scenes,
        relations,
        plotPoints,
        foreshadowing,
      });
      setDeleteImpact(impact);
    } catch (err) {
      // 引用检测失败时关闭弹窗并通过 toast 提示，避免 unhandled rejection
      setConfirmOpen(false);
      useToastStore.getState().pushToast(
        'error',
        `检测引用失败：${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setChecking(false);
    }
  };

  const cancelDelete = (): void => {
    setConfirmOpen(false);
    setDeleteImpact(null);
  };

  return {
    confirmOpen,
    deleteImpact,
    checking,
    requestDelete,
    cancelDelete,
  };
}
