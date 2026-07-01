/**
 * 设置页面
 *
 * 顶部 Tab 导航 + 内容区切换，避免长滚动。
 * 六大 Tab：通用（字数目标 + 字号偏好）/ 外观（主题）/ 快捷键 / AI 大模型 / 数据管理 / 关于。
 * - 通用：每日字数目标 + 字号偏好
 * - 外观：双选项卡片（明亮/暗夜），对齐 uiStore.theme
 * - 快捷键：只读表格，数据来自 settingStore.shortcuts
 * - AI 大模型：多模型管理（添加/编辑/删除/启用停用/默认切换/连通性测试），localStorage 持久化
 * - 数据管理：导出当前/全部 + 导入文件 + 清除全部数据
 * - 关于：版本号 + 说明
 */
import { useState, useEffect, type ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Download,
  Upload,
  FileText,
  Archive,
  Trash2,
  Type,
  Sliders,
  Palette,
  Keyboard,
  Sparkles,
  Database,
  Info,
} from 'lucide-react';
import { useSettingStore, useUIStore, useBookStore, useToastStore } from '../stores';
import type { ThemeMode, ColorTheme } from '../types';
import { DuplicateBookError, importJson, importJsonWithMode } from '../lib/importer';
import { exportBook, exportAll, downloadJson } from '../lib/exporter';
import { db } from '../lib/db';
import { cn } from '../utils/cn';
import { Button, Modal, ConfirmDialog } from '../components/ui';
import { AIModelManager } from '../components/settings/AIModelManager';

/** 快捷键动作 → 中文标签 */
const SHORTCUT_LABELS: Record<string, string> = {
  save: '保存',
  bold: '加粗',
  italic: '斜体',
  blockquote: '引文块',
  sceneDivider: '场景分隔符',
  focusMode: '专注模式',
  prevChapter: '上一章',
  nextChapter: '下一章',
  globalSearch: '全局搜索',
  newChapter: '新建章节',
};

const THEME_MODE_OPTIONS: ReadonlyArray<{
  key: ThemeMode;
  label: string;
  desc: string;
  preview: string;
}> = [
  { key: 'light', label: '明亮', desc: '清爽明亮，日光下清晰', preview: 'linear-gradient(135deg, #f8fafc, #e2e8f0)' },
  { key: 'dark', label: '暗黑', desc: '极客深灰，沉浸护眼', preview: 'linear-gradient(135deg, #1e293b, #0f172a)' },
];

const COLOR_THEME_OPTIONS: ReadonlyArray<{
  key: ColorTheme;
  label: string;
  desc: string;
  primary: string;
}> = [
  { key: 'blue', label: '蓝调', desc: '沉静理性，现代简约', primary: '#2563eb' },
  { key: 'vermilion', label: '朱砂红', desc: 'Scribe 品牌色，温润典雅', primary: '#c73e2a' },
  { key: 'moss', label: '墨绿', desc: '文人雅致，沉稳内敛', primary: '#2d7a52' },
  { key: 'purple', label: '紫调', desc: '神秘高贵，梦幻遐想', primary: '#8b5cf6' },
  { key: 'gold', label: '铜金', desc: '典雅复古，岁月沉淀', primary: '#b8860b' },
  { key: 'rose', label: '玫瑰', desc: '柔美温婉，浪漫诗意', primary: '#e11d72' },
];

/** Tab 定义 */
interface TabItem {
  key: string;
  label: string;
  icon: React.ReactNode;
}

const TABS: TabItem[] = [
  { key: 'general', label: '通用', icon: <Sliders className="h-3.5 w-3.5" /> },
  { key: 'appearance', label: '外观', icon: <Palette className="h-3.5 w-3.5" /> },
  { key: 'shortcuts', label: '快捷键', icon: <Keyboard className="h-3.5 w-3.5" /> },
  { key: 'ai', label: 'AI 大模型', icon: <Sparkles className="h-3.5 w-3.5" /> },
  { key: 'data', label: '数据管理', icon: <Database className="h-3.5 w-3.5" /> },
  { key: 'about', label: '关于', icon: <Info className="h-3.5 w-3.5" /> },
];

/** 区块标题样式：左侧 3px 朱砂红竖条 + 衬线字体 */
function SectionTitle({ children }: { children: string }) {
  return (
    <h2 className="mb-4 flex items-center gap-2 font-serif text-lg font-semibold text-foreground">
      <span className="h-4 w-[3px] rounded-r-sm bg-primary" aria-hidden="true" />
      {children}
    </h2>
  );
}

/** 读取文件为文本字符串 */
function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error('文件读取失败'));
    reader.readAsText(file);
  });
}

/** 区块容器样式 */
const sectionCls = 'rounded-lg border border-border bg-muted/60 p-6';

/**
 * 设置页面：目标 / 快捷键 / 主题 / 数据管理 / 关于。
 */
export default function SettingsPage() {
  const { dailyGoal, setDailyGoal, fontSize, setFontSize, shortcuts } = useSettingStore();
  const { theme, colorTheme, setTheme, setColorTheme } = useUIStore();
  const { currentBookId, refreshBooks } = useBookStore();
  const pushToast = useToastStore((s) => s.pushToast);

  const [exporting, setExporting] = useState(false);
  const [duplicateDialog, setDuplicateDialog] = useState<{
    error: DuplicateBookError;
    content: string;
  } | null>(null);
  const [importing, setImporting] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('general');

  /** 字号变化时同步到 <html> style，立即生效 */
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.style.fontSize = `${fontSize}px`;
    }
  }, [fontSize]);

  /** 导出当前作品 */
  const handleExportCurrent = async (): Promise<void> => {
    if (!currentBookId) {
      pushToast('warning', '请先在顶部选择作品');
      return;
    }
    setExporting(true);
    try {
      const json = await exportBook(currentBookId);
      downloadJson(json, `scribe-${Date.now()}.json`);
      pushToast('success', '已导出当前作品');
    } catch (e) {
      pushToast('error', `导出失败：${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setExporting(false);
    }
  };

  /** 导出全部作品 */
  const handleExportAll = async (): Promise<void> => {
    setExporting(true);
    try {
      const json = await exportAll();
      downloadJson(json, `scribe-all-${Date.now()}.json`);
      pushToast('success', '已导出全部作品');
    } catch (e) {
      pushToast('error', `导出失败：${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setExporting(false);
    }
  };

  /** 导入文件 */
  const handleImportFile = async (e: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.target.files?.[0];
    if (!file) return;
    // 重置 input 以便重复选择同一文件
    e.target.value = '';
    setImporting(true);
    let text = '';
    try {
      text = await readFileAsText(file);
      await importJson(text);
      await refreshBooks();
      pushToast('success', '导入成功');
    } catch (err) {
      if (err instanceof DuplicateBookError) {
        setDuplicateDialog({ error: err, content: text });
      } else {
        pushToast('error', err instanceof Error ? err.message : '导入失败');
      }
    } finally {
      setImporting(false);
    }
  };

  /** 按指定模式导入（覆盖 / 新建） */
  const handleImportWithMode = async (mode: 'overwrite' | 'new'): Promise<void> => {
    if (!duplicateDialog) return;
    const { content } = duplicateDialog;
    setDuplicateDialog(null);
    setImporting(true);
    try {
      const result = await importJsonWithMode(content, mode);
      await refreshBooks();
      pushToast('success', result.message);
    } catch (e) {
      pushToast('error', e instanceof Error ? e.message : '导入失败');
    } finally {
      setImporting(false);
    }
  };

  /** 滑块与输入框联动 */
  const handleGoalChange = (n: number): void => {
    const clamped = Math.max(500, Math.min(20000, Math.round(n / 500) * 500));
    setDailyGoal(clamped);
  };

  /** 清除全部本地数据（不可恢复，需二次确认） */
  const handleClearAllData = async (): Promise<void> => {
    setClearing(true);
    try {
      await db.transaction(
        'rw',
        [
          db.books,
          db.worldview,
          db.characters,
          db.relations,
          db.plotLines,
          db.plotPoints,
          db.foreshadowing,
          db.scenes,
          db.volumes,
          db.chapters,
          db.inspiration,
          db.writingLogs,
        ],
        async () => {
          await Promise.all([
            db.books.clear(),
            db.worldview.clear(),
            db.characters.clear(),
            db.relations.clear(),
            db.plotLines.clear(),
            db.plotPoints.clear(),
            db.foreshadowing.clear(),
            db.scenes.clear(),
            db.volumes.clear(),
            db.chapters.clear(),
            db.inspiration.clear(),
            db.writingLogs.clear(),
          ]);
        },
      );
      // 同步清除 localStorage 中的降级备份数据
      try {
        const keys = Object.keys(localStorage).filter((k) =>
          k.startsWith('scribe:fallback:chapter:'),
        );
        keys.forEach((k) => localStorage.removeItem(k));
      } catch {
        // localStorage 不可用时忽略
      }
      await refreshBooks();
      pushToast('success', '已清除全部本地数据');
    } catch (e) {
      pushToast('error', `清除失败：${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-8 py-6">
      {/* 欢迎区 */}
      <header className="mb-5">
        <h1 className="font-serif text-3xl font-bold tracking-wider text-foreground">
          设置
        </h1>
        <p className="mt-1.5 font-serif text-sm text-muted-foreground">
          调整创作偏好与应用配置。
        </p>
      </header>

      {/* Tab 导航 */}
      <nav
        className="sticky top-[64px] z-10 mb-6 -mx-2 flex items-center gap-1 overflow-x-auto border-b border-border bg-background/80 px-2 py-2 backdrop-blur-md"
        aria-label="设置分类"
      >
        {TABS.map((tab) => {
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'relative flex flex-shrink-0 items-center gap-1.5 rounded-md px-3.5 py-1.5 font-serif text-sm transition-colors',
                active
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground',
              )}
              aria-pressed={active}
            >
              {tab.icon}
              {tab.label}
              {active && (
                <motion.span
                  layoutId="settings-tab-indicator"
                  className="absolute inset-x-2 -bottom-2 h-[2px] rounded-full bg-primary"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
            </button>
          );
        })}
      </nav>

      {/* 内容区 */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* 通用：字数目标 + 字号偏好 */}
          {activeTab === 'general' && (
            <div className="space-y-4">
              <section className={sectionCls}>
                <SectionTitle>每日字数目标</SectionTitle>
                <div className="flex flex-col gap-4">
                  <div className="flex items-end gap-4">
                    <div>
                      <label
                        htmlFor="daily-goal"
                        className="mb-1.5 block font-serif text-sm text-foreground"
                      >
                        目标字数
                      </label>
                      <input
                        id="daily-goal"
                        type="number"
                        min="500"
                        max="20000"
                        step="500"
                        value={dailyGoal}
                        onChange={(e) => handleGoalChange(Number(e.target.value))}
                        className="w-32 rounded border border-border bg-background px-3 py-2 font-mono text-sm text-foreground focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary/20"
                      />
                    </div>
                    <span className="text-xs text-muted-foreground">
                      字 / 天
                    </span>
                    <span className="ml-auto font-brush text-2xl text-primary/60" aria-hidden="true">
                      {dailyGoal.toLocaleString()}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="500"
                    max="20000"
                    step="500"
                    value={dailyGoal}
                    onChange={(e) => handleGoalChange(Number(e.target.value))}
                    className="w-full accent-primary"
                    aria-label="每日字数目标滑块"
                  />
                  <div className="flex justify-between font-mono text-[12px] text-muted-foreground">
                    <span>500</span>
                    <span>5,000</span>
                    <span>10,000</span>
                    <span>15,000</span>
                    <span>20,000</span>
                  </div>
                </div>
              </section>

              <section className={sectionCls}>
                <SectionTitle>字号偏好</SectionTitle>
                <div className="flex flex-col gap-4">
                  <div className="flex items-end gap-4">
                    <Type className="h-5 w-5 text-secondary" aria-hidden="true" />
                    <div className="flex-1">
                      <label
                        htmlFor="font-size"
                        className="mb-1.5 block font-serif text-sm text-foreground"
                      >
                        全局正文字号
                      </label>
                      <input
                        id="font-size"
                        type="range"
                        min="13"
                        max="20"
                        step="1"
                        value={fontSize}
                        onChange={(e) => setFontSize(Number(e.target.value))}
                        className="w-full accent-primary"
                        aria-label="全局字号滑块"
                      />
                      <div className="mt-1 flex justify-between font-mono text-[12px] text-muted-foreground">
                        <span>13</span>
                        <span>16</span>
                        <span>20</span>
                      </div>
                    </div>
                    <span className="font-mono text-sm text-foreground">{fontSize}px</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    影响全局 UI 字号；编辑器正文字号会随之等比缩放，保证阅读舒适度。
                  </p>
                </div>
              </section>
            </div>
          )}

          {/* 外观：色彩主题 + 明暗模式 */}
          {activeTab === 'appearance' && (
            <div className="space-y-4">
              <section className={sectionCls}>
                <SectionTitle>色彩主题</SectionTitle>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {COLOR_THEME_OPTIONS.map((opt) => {
                    const active = opt.key === colorTheme;
                    return (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => setColorTheme(opt.key)}
                        className={cn(
                          'flex flex-col gap-2.5 rounded-lg border p-4 text-left transition-all duration-200',
                          active
                            ? 'border-primary bg-primary/5 shadow-soft'
                            : 'border-border bg-background hover:border-primary/40 hover:shadow-soft',
                        )}
                        aria-pressed={active}
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className="flex h-10 w-10 items-center justify-center rounded-full shadow-sm"
                            style={{ background: opt.primary }}
                            aria-hidden="true"
                          >
                            <span className="h-5 w-5 rounded-full bg-white/20 backdrop-blur-sm" />
                          </span>
                          <div className="flex-1">
                            <span className="block font-serif text-sm font-semibold text-foreground">
                              {opt.label}
                            </span>
                            <span className="block text-[11px] leading-relaxed text-muted-foreground">
                              {opt.desc}
                            </span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className={sectionCls}>
                <SectionTitle>明暗模式</SectionTitle>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {THEME_MODE_OPTIONS.map((opt) => {
                    const active = opt.key === theme;
                    return (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => setTheme(opt.key)}
                        className={cn(
                          'flex flex-col gap-2.5 rounded-lg border p-4 text-left transition-all duration-200',
                          active
                            ? 'border-primary bg-primary/5 shadow-soft'
                            : 'border-border bg-background hover:border-primary/40 hover:shadow-soft',
                        )}
                        aria-pressed={active}
                      >
                        <span
                          className="h-12 w-full rounded-md border border-border/50"
                          style={{ background: opt.preview }}
                          aria-hidden="true"
                        />
                        <span className="font-serif text-sm font-semibold text-foreground">
                          {opt.label}
                        </span>
                        <span className="text-[11px] leading-relaxed text-muted-foreground">
                          {opt.desc}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            </div>
          )}

          {/* 快捷键 */}
          {activeTab === 'shortcuts' && (
            <section className={sectionCls}>
              <SectionTitle>快捷键</SectionTitle>
              <div className="overflow-hidden rounded border border-border">
                <table className="w-full">
                  <thead>
                    <tr className="bg-muted/60">
                      <th className="px-4 py-2 text-left text-xs font-semibold tracking-wide text-muted-foreground">
                        动作
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-semibold tracking-wide text-muted-foreground">
                        按键
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(shortcuts).map(([action, keys], i) => (
                      <tr
                        key={action}
                        className={cn(
                          'border-t border-border/60',
                          i % 2 === 1 && 'bg-muted/30',
                        )}
                      >
                        <td className="px-4 py-2 font-serif text-sm text-foreground">
                          {SHORTCUT_LABELS[action] ?? action}
                        </td>
                        <td className="px-4 py-2">
                          <kbd className="rounded border border-border bg-background px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
                            {keys}
                          </kbd>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* AI 大模型 */}
          {activeTab === 'ai' && (
            <section className={sectionCls}>
              <SectionTitle>AI 大模型</SectionTitle>
              <AIModelManager />
            </section>
          )}

          {/* 数据管理 */}
          {activeTab === 'data' && (
            <section className={sectionCls}>
              <SectionTitle>数据管理</SectionTitle>
              <div className="flex flex-col gap-3">
                <button
                  type="button"
                  onClick={handleExportCurrent}
                  disabled={exporting}
                  className={cn(
                    'flex items-center gap-3 rounded-lg border border-border bg-background p-3 text-left',
                    'transition-all duration-200 hover:border-secondary hover:shadow-soft',
                    'disabled:cursor-not-allowed disabled:opacity-60',
                  )}
                >
                  <Download className="h-5 w-5 flex-shrink-0 text-primary" aria-hidden="true" />
                  <div className="flex-1">
                    <p className="font-serif text-sm font-medium text-foreground">导出当前作品</p>
                    <p className="text-[11px] text-muted-foreground">
                      将当前作品的全部章节、角色、设定等导出为 JSON 文件
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={handleExportAll}
                  disabled={exporting}
                  className={cn(
                    'flex items-center gap-3 rounded-lg border border-border bg-background p-3 text-left',
                    'transition-all duration-200 hover:border-secondary hover:shadow-soft',
                    'disabled:cursor-not-allowed disabled:opacity-60',
                  )}
                >
                  <Archive className="h-5 w-5 flex-shrink-0 text-secondary" aria-hidden="true" />
                  <div className="flex-1">
                    <p className="font-serif text-sm font-medium text-foreground">导出全部作品</p>
                    <p className="text-[11px] text-muted-foreground">
                      备份所有作品及其关联数据
                    </p>
                  </div>
                </button>

                <label
                  className={cn(
                    'flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-background p-3 text-left',
                    'transition-all duration-200 hover:border-secondary hover:shadow-soft',
                    'disabled:cursor-not-allowed disabled:opacity-60',
                  )}
                >
                  <Upload className="h-5 w-5 flex-shrink-0 text-moss" aria-hidden="true" />
                  <div className="flex-1">
                    <p className="font-serif text-sm font-medium text-foreground">
                      导入文件
                      {importing && <span className="ml-2 text-muted-foreground">导入中…</span>}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      从 JSON 备份文件导入作品；重名时可选择覆盖或导入为新作品
                    </p>
                  </div>
                  <input
                    type="file"
                    accept=".json,application/json"
                    onChange={handleImportFile}
                    className="hidden"
                    aria-label="选择导入文件"
                  />
                </label>

                <button
                  type="button"
                  onClick={() => setConfirmClear(true)}
                  disabled={clearing}
                  className={cn(
                    'flex items-center gap-3 rounded-lg border border-primary/40 bg-primary/5 p-3 text-left',
                    'transition-all duration-200 hover:bg-primary/10 hover:shadow-soft',
                    'disabled:cursor-not-allowed disabled:opacity-60',
                  )}
                >
                  <Trash2 className="h-5 w-5 flex-shrink-0 text-primary" aria-hidden="true" />
                  <div className="flex-1">
                    <p className="font-serif text-sm font-medium text-primary">
                      清除全部本地数据
                      {clearing && <span className="ml-2 text-muted-foreground">清除中…</span>}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      删除所有作品及其关联数据。建议先导出备份，此操作不可撤销。
                    </p>
                  </div>
                </button>
              </div>
            </section>
          )}

          {/* 关于 */}
          {activeTab === 'about' && (
            <section className={sectionCls}>
              <SectionTitle>关于</SectionTitle>
              <div className="flex items-center gap-4">
                <div
                  className="flex h-14 w-14 items-center justify-center rounded-lg border border-secondary/40 bg-secondary/10 font-serif text-2xl font-bold text-primary"
                  aria-hidden="true"
                >
                  M
                </div>
                <div>
                  <p className="font-serif text-base font-semibold text-foreground">
                    Scribe · Novel Crafting System
                  </p>
                  <p className="mt-0.5 flex items-center gap-2 font-mono text-xs text-muted-foreground">
                    <FileText className="h-3 w-3" aria-hidden="true" />
                    版本 0.0.0
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    本地优先的小说创作工具，数据存储于浏览器，无需注册。
                  </p>
                </div>
              </div>
            </section>
          )}
        </motion.div>
      </AnimatePresence>

      {/* 重名作品导入选择 Modal */}
      <Modal
        open={duplicateDialog !== null}
        onClose={() => setDuplicateDialog(null)}
        title="发现重名作品"
        width="480px"
      >
        <div className="flex flex-col gap-4">
          <p className="font-serif text-sm leading-relaxed text-foreground">
            {duplicateDialog?.error.message}
          </p>
          <div className="flex flex-col gap-2 rounded border border-secondary/40 bg-secondary/10 px-3 py-2.5">
            <p className="text-xs text-muted-foreground">
              请选择处理方式：
            </p>
            <ul className="ml-4 list-disc text-[11px] leading-relaxed text-muted-foreground">
              <li>
                <b className="text-foreground">覆盖</b>：删除原作品及其全部关联数据，替换为导入内容
              </li>
              <li>
                <b className="text-foreground">导入为新作品</b>：重映射全部 ID，标题追加「（副本）」
              </li>
            </ul>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="md" onClick={() => setDuplicateDialog(null)}>
              取消
            </Button>
            <Button
              variant="danger"
              size="md"
              onClick={() => handleImportWithMode('overwrite')}
            >
              覆盖
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={() => handleImportWithMode('new')}
            >
              导入为新作品
            </Button>
          </div>
        </div>
      </Modal>

      {/* 清除数据二次确认 */}
      <ConfirmDialog
        open={confirmClear}
        title="清除全部本地数据"
        message="此操作将永久删除所有作品、章节、角色、世界观、剧情、场景、灵感与写作日志，且不可撤销。"
        impactInfo="建议在清除前先导出全部作品作为备份。清除后浏览器存储将恢复为初始状态。"
        confirmText="永久清除"
        cancelText="取消"
        danger
        onConfirm={() => void handleClearAllData()}
        onClose={() => (clearing ? undefined : setConfirmClear(false))}
      />
    </div>
  );
}
