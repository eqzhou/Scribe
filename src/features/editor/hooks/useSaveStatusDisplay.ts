/**
 * useSaveStatusDisplay
 *
 * 根据 saveStatus + lastSavedAt 推导出顶栏保存状态徽章的展示信息：
 * 图标、文案、样式类与是否旋转。
 */
import { useEffect, useState } from 'react';
import { Save, Check, AlertCircle, Loader2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { SaveStatus } from '../../../types';

export interface SaveStatusDisplay {
  icon: LucideIcon;
  text: string;
  cls: string;
  spin: boolean;
}

/**
 * @param saveStatus 当前保存状态
 * @param lastSavedAt 最近一次保存成功的时间戳（毫秒）
 */
export function useSaveStatusDisplay(
  saveStatus: SaveStatus,
  lastSavedAt: number | null,
): SaveStatusDisplay {
  const [timeStr, setTimeStr] = useState('');

  useEffect(() => {
    if (saveStatus === 'saved' && lastSavedAt) {
      const d = new Date(lastSavedAt);
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      setTimeStr(`${hh}:${mm}`);
    }
  }, [saveStatus, lastSavedAt]);

  if (saveStatus === 'saving') {
    return { icon: Loader2, text: '保存中…', cls: 'text-foreground', spin: true };
  }
  if (saveStatus === 'saved') {
    return { icon: Check, text: `已保存于 ${timeStr}`, cls: 'text-moss', spin: false };
  }
  if (saveStatus === 'failed') {
    return { icon: AlertCircle, text: '保存失败', cls: 'text-primary', spin: false };
  }
  return { icon: Save, text: '待保存', cls: 'text-muted-foreground', spin: false };
}
