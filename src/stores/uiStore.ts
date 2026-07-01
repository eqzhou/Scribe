/**
 * UI Store
 *
 * 管理界面层状态：侧栏折叠、设定侧栏 Tab、主题（明暗模式 + 色彩主题）、全局搜索面板。
 * 依据技术架构文档第 8.1 节定义。全量持久化。
 *
 * 主题系统：
 * - 明暗模式（ThemeMode）：light / dark — 控制背景前景亮度
 * - 色彩主题（ColorTheme）：blue / vermilion / moss / purple / gold / rose — 控制主色、辅助色
 * - 组合类名：theme-{color}.theme-{mode} 双层叠加在 document.documentElement 上
 *
 * 主题同步：applyTheme 在 setTheme/setColorTheme 内直接操作 documentElement.classList，
 * 不依赖 React 渲染周期，避免 StrictMode 双调用 effect / HMR 时序导致的同步延迟。
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { SettingSidebarTab, ThemeMode, ColorTheme } from '../types';

/** 将明暗模式同步到 <html> class */
function applyThemeMode(theme: ThemeMode): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.classList.remove('theme-dark', 'theme-light');
  if (theme === 'dark') root.classList.add('theme-dark');
  else if (theme === 'light') root.classList.add('theme-light');
}

/** 将色彩主题同步到 <html> class */
const COLOR_THEME_CLASSES: readonly ColorTheme[] = [
  'blue',
  'vermilion',
  'moss',
  'purple',
  'gold',
  'rose',
];

function applyColorTheme(colorTheme: ColorTheme): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  COLOR_THEME_CLASSES.forEach((t) => root.classList.remove(`theme-${t}`));
  root.classList.add(`theme-${colorTheme}`);
}

/** 从 localStorage 或系统偏好推断初始主题（兼容老数据只有 theme 字段） */
function inferInitialTheme(): { theme: ThemeMode; colorTheme: ColorTheme } {
  if (typeof window === 'undefined') {
    return { theme: 'light', colorTheme: 'blue' };
  }
  // 兼容老版本：如果只有 light/dark，色彩主题默认 blue
  const saved = localStorage.getItem('scribe-ui');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      return {
        theme: (parsed.state?.theme as ThemeMode) ?? 'light',
        colorTheme: (parsed.state?.colorTheme as ColorTheme) ?? 'blue',
      };
    } catch {
      // ignore
    }
  }
  return { theme: 'light', colorTheme: 'blue' };
}

export interface UIStore {
  /** 主侧栏是否折叠 */
  sidebarCollapsed: boolean;
  /** 设定侧栏当前激活的 Tab */
  settingSidebarTab: SettingSidebarTab;
  /** 明暗模式 */
  theme: ThemeMode;
  /** 色彩主题 */
  colorTheme: ColorTheme;
  /** 全局搜索面板是否打开 */
  globalSearchOpen: boolean;
  /** 切换主侧栏折叠状态 */
  toggleSidebar: () => void;
  /** 设置设定侧栏 Tab */
  setSettingSidebarTab: (tab: SettingSidebarTab) => void;
  /** 设置明暗模式（立即同步 DOM，不依赖 React 渲染） */
  setTheme: (theme: ThemeMode) => void;
  /** 设置色彩主题（立即同步 DOM） */
  setColorTheme: (theme: ColorTheme) => void;
  /** 设置全局搜索面板开关 */
  setGlobalSearchOpen: (open: boolean) => void;
}

const initial = inferInitialTheme();

export const useUIStore = create<UIStore>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      settingSidebarTab: 'character',
      theme: initial.theme,
      colorTheme: initial.colorTheme,
      globalSearchOpen: false,
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setSettingSidebarTab: (tab) => set({ settingSidebarTab: tab }),
      setTheme: (theme) => {
        set({ theme });
        applyThemeMode(theme);
      },
      setColorTheme: (colorTheme) => {
        set({ colorTheme });
        applyColorTheme(colorTheme);
      },
      setGlobalSearchOpen: (open) => set({ globalSearchOpen: open }),
    }),
    { name: 'scribe-ui' },
  ),
);

/** 启动时同步一次主题到 DOM（在应用入口处调用） */
export function initThemes(): void {
  const state = useUIStore.getState();
  applyThemeMode(state.theme);
  applyColorTheme(state.colorTheme);
}
