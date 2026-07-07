/**
 * Topbar 顶部栏
 *
 * 参考HTML原型 .topbar 样式：
 * - 高度 64px，bg-background/80 + backdrop-blur-md（毛玻璃），border-b border-border
 * - 左侧：作品切换器（封面色块 + 书名 + 类型，点击下拉切换作品）
 * - 中间：页面标题（useLocation 解析路由，§ 前缀装饰）
 * - 右侧：搜索框（Ctrl+K 唤起）、导出按钮、主题切换、设置头像
 */
import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Search, Download, Sun, Moon, Settings, ChevronDown, LogOut, Feather, Library } from 'lucide-react';
import { useBookStore, useUIStore, useToastStore, useUserStore } from '../../stores';
import type { ThemeMode } from '../../types';
import { withAppBasePath } from '../../lib/appBase';
import { exportBook, downloadJson } from '../../lib/exporter';
import { cn } from '../../utils/cn';

/** 路由前缀 → 中文标题映射 */
const TITLE_MAP: Array<{ prefix: string; title: string }> = [
  { prefix: '/dashboard', title: '工作台' },
  { prefix: '/projects', title: '项目' },
  { prefix: '/worldview', title: '世界观' },
  { prefix: '/characters', title: '角色' },
  { prefix: '/plot', title: '剧情' },
  { prefix: '/scenes', title: '场景' },
  { prefix: '/editor', title: '写作' },
  { prefix: '/inspiration', title: '灵感库' },
  { prefix: '/settings', title: '设置' },
];

/** 主题循环顺序：明亮 → 暗黑 */
const THEME_CYCLE: ThemeMode[] = ['light', 'dark'];

/** 主题中文名 */
const THEME_LABEL: Record<ThemeMode, string> = {
  light: '明亮',
  dark: '暗黑',
};

/** 根据当前路径解析页面标题 */
function resolveTitle(pathname: string): string {
  for (const item of TITLE_MAP) {
    if (pathname === item.prefix || pathname.startsWith(item.prefix + '/')) {
      return item.title;
    }
  }
  return 'Scribe';
}

/**
 * 顶部栏：作品切换 + 页面标题 + 搜索/导出/主题/设置。
 */
export default function Topbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { books, currentBookId, setCurrentBook } = useBookStore();
  const { theme, setTheme, setGlobalSearchOpen } = useUIStore();
  const pushToast = useToastStore((s) => s.pushToast);
  const user = useUserStore((s) => s.user);
  const logout = useUserStore((s) => s.logout);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  // 用户菜单下拉
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  // 下拉菜单键盘导航：当前高亮项索引
  const [highlightedIdx, setHighlightedIdx] = useState(-1);

  // 点击外部关闭用户菜单
  useEffect(() => {
    if (!userMenuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [userMenuOpen]);

  // 打开下拉时将高亮项初始化到当前选中作品
  useEffect(() => {
    if (switcherOpen) {
      const idx = books.findIndex((b) => b.id === currentBookId);
      setHighlightedIdx(idx >= 0 ? idx : 0);
    }
  }, [switcherOpen, books, currentBookId]);

  // 主题同步已由 uiStore.setTheme 直接操作 DOM，无需 useEffect

  const currentBook = books.find((b) => b.id === currentBookId) ?? books[0];
  const title = resolveTitle(location.pathname);

  /** 循环切换主题 */
  const cycleTheme = () => {
    const idx = THEME_CYCLE.indexOf(theme);
    const next = THEME_CYCLE[(idx + 1) % THEME_CYCLE.length];
    setTheme(next);
  };

  /** 导出当前作品 */
  const handleExport = async () => {
    if (!currentBookId) {
      pushToast('warning', '请先选择作品');
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

  /** 登出：清除认证态并跳转登录页 */
  const handleLogout = () => {
    logout();
    pushToast('success', '已登出');
    navigate('/login', { replace: true });
  };

  return (
    <header
      className={cn(
        'z-20 flex h-16 shrink-0 items-center gap-5 border-b border-border/50 px-8',
        'bg-background/75 backdrop-blur-xl shadow-premium transition-all duration-200',
      )}
    >
      {/* 品牌图标：点击回到首页 */}
      <a
        href={withAppBasePath('/')}
        className="group flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-secondary/40 bg-secondary/10 text-primary transition-all duration-200 hover:border-primary hover:bg-primary/15 hover:shadow-soft"
        title="返回首页"
        aria-label="返回首页"
      >
        <Feather className="h-4 w-4" />
      </a>

      {/* 左侧：作品切换器 */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setSwitcherOpen((v) => !v)}
          onKeyDown={(e) => {
            if (!switcherOpen) return;
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setHighlightedIdx((i) => Math.min(i + 1, books.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setHighlightedIdx((i) => Math.max(i - 1, 0));
            } else if (e.key === 'Enter') {
              e.preventDefault();
              const target = books[highlightedIdx];
              if (target) {
                setCurrentBook(target.id);
                setSwitcherOpen(false);
              }
            } else if (e.key === 'Escape') {
              e.preventDefault();
              setSwitcherOpen(false);
            }
          }}
          className={cn(
            'flex items-center gap-2.5 rounded-lg border border-border bg-muted/40 px-3 py-1.5',
            'transition-all duration-200 hover:border-secondary hover:bg-muted hover:shadow-soft',
          )}
          aria-haspopup="listbox"
          aria-expanded={switcherOpen}
          aria-activedescendant={
            switcherOpen && highlightedIdx >= 0
              ? `book-opt-${books[highlightedIdx]?.id ?? ''}`
              : undefined
          }
        >
          {/* 书名 + 类型 */}
          <span className="flex flex-col items-start min-w-[70px]">
            <b className="text-[12px] font-semibold leading-tight tracking-wide text-foreground truncate max-w-[120px]">
              {currentBook?.title ?? '未选择作品'}
            </b>
            <small className="text-[12px] tracking-wide text-muted-foreground">
              {currentBook?.genre ?? '—'}
            </small>
          </span>
          <ChevronDown
            className={cn(
              'h-3 w-3 text-muted-foreground transition-transform duration-200 ml-1',
              switcherOpen && 'rotate-180',
            )}
            aria-hidden="true"
          />
        </button>

        {/* 下拉菜单 */}
        <AnimatePresence>
          {switcherOpen && (
            <>
              {/* 透明遮罩：点击关闭 */}
              <button
                type="button"
                className="fixed inset-0 z-30 cursor-default"
                aria-hidden="true"
                tabIndex={-1}
                onClick={() => setSwitcherOpen(false)}
              />
              <motion.ul
                role="listbox"
                className={cn(
                  'absolute left-0 top-full z-40 mt-2 min-w-[260px] overflow-hidden p-1.5',
                  'rounded-lg border border-border bg-background/95 backdrop-blur-md shadow-lifted',
                )}
                initial={{ opacity: 0, y: -8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.98 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              >
                {books.length === 0 && (
                  <li className="px-4 py-3 text-xs text-muted-foreground">暂无作品</li>
                )}
                {books.map((book, idx) => (
                  <li key={book.id}>
                    <button
                      type="button"
                      id={`book-opt-${book.id}`}
                      role="option"
                      aria-selected={book.id === currentBookId}
                      onClick={() => {
                        setCurrentBook(book.id);
                        setSwitcherOpen(false);
                      }}
                      onMouseEnter={() => setHighlightedIdx(idx)}
                      className={cn(
                        'flex w-full items-center gap-3 px-3 py-2 rounded-md text-left',
                        'transition-all duration-150',
                        book.id === currentBookId
                          ? 'bg-primary/8 text-primary'
                          : 'hover:bg-muted text-muted-foreground hover:text-foreground',
                        idx === highlightedIdx && book.id !== currentBookId && 'bg-muted text-foreground',
                      )}
                    >
                      <span
                        className="h-7 w-5 shrink-0 rounded-[2px]"
                        style={{
                          background: `linear-gradient(135deg, ${book.coverColor}, #111e11)`,
                          boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
                        }}
                        aria-hidden="true"
                      />
                      <span className="flex flex-1 flex-col overflow-hidden">
                        <span className="text-[12.5px] font-medium truncate">{book.title}</span>
                        <span className="text-[9.5px] opacity-70">{book.genre}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </motion.ul>
            </>
          )}
        </AnimatePresence>
      </div>

      {/* 中间：页面标题（优雅的红边条） */}
      <div className="flex items-center ml-2">
        <span className="mr-2 h-4 w-[2.5px] bg-primary rounded-full inline-block" aria-hidden="true" />
        <h1 className="font-serif text-base font-semibold tracking-widest text-foreground">
          {title}
        </h1>
      </div>

      {/* 右侧：搜索 / 导出 / 主题 / 设置 */}
      <div className="ml-auto flex items-center gap-3">
        {/* 搜索框（按钮形态，点击或 Ctrl+K 唤起全局搜索） */}
        <button
          type="button"
          onClick={() => setGlobalSearchOpen(true)}
          className={cn(
            'flex items-center gap-2 rounded-full border border-border/60 bg-muted/30 px-3.5 py-1.5',
            'w-[220px] transition-all duration-200 hover:border-secondary hover:bg-muted/60',
          )}
          title="打开全局搜索 (Ctrl+K)"
        >
          <Search className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
          <span className="flex-1 text-left text-[11.5px] text-muted-foreground">搜索章节、角色、设定…</span>
          <kbd className="rounded border border-border/50 bg-background px-1.5 py-0.5 font-mono text-[12px] text-muted-foreground shadow-sm">
            ⌘K
          </kbd>
        </button>

        {/* 导出按钮 */}
        <button
          type="button"
          title="导出作品"
          aria-label="导出当前作品"
          onClick={handleExport}
          disabled={exporting}
          className={cn(
            'flex h-9 w-9 items-center justify-center rounded-lg border border-border/60 bg-muted/30',
            'text-muted-foreground transition-all duration-200 shadow-sm active:scale-95',
            'hover:border-primary hover:bg-primary/5 hover:text-primary',
            'disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100',
          )}
        >
          <Download className="h-4 w-4" aria-hidden="true" />
        </button>

        {/* 主题切换按钮 */}
        <button
          type="button"
          onClick={cycleTheme}
          title={`主题：${THEME_LABEL[theme]}（点击切换）`}
          aria-label={`切换主题，当前为${THEME_LABEL[theme]}`}
          className={cn(
            'flex h-9 w-9 items-center justify-center rounded-lg border border-border/60 bg-muted/30',
            'text-muted-foreground transition-all duration-200 shadow-sm active:scale-95',
            'hover:border-primary hover:bg-primary/5 hover:text-primary',
          )}
        >
          {theme === 'dark' ? (
            <Moon className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Sun className="h-4 w-4" aria-hidden="true" />
          )}
        </button>

        {/* 用户头像 + 下拉菜单（设置 / 退出） */}
        {user && (
          <div ref={userMenuRef} className="relative">
            <button
              type="button"
              onClick={() => setUserMenuOpen((v) => !v)}
              title={user.username}
              aria-label="用户菜单"
              aria-haspopup="menu"
              aria-expanded={userMenuOpen}
              className={cn(
                'flex items-center gap-2 rounded-full border border-border/60 bg-muted/30 py-1 pl-1 pr-2.5',
                'transition-all duration-200 hover:border-primary hover:bg-primary/5',
              )}
            >
              <span
                className="flex h-7 w-7 items-center justify-center rounded-full bg-primary font-sans text-[12px] font-semibold text-primary-foreground"
                aria-hidden="true"
              >
                {(user.displayName || user.username).slice(0, 1).toUpperCase()}
              </span>
              <span className="max-w-[80px] truncate font-sans text-[12px] text-foreground">
                {user.displayName || user.username}
              </span>
              <ChevronDown
                className={cn(
                  'h-3 w-3 text-muted-foreground transition-transform duration-200',
                  userMenuOpen && 'rotate-180',
                )}
                aria-hidden="true"
              />
            </button>

            <AnimatePresence>
              {userMenuOpen && (
                <motion.div
                  role="menu"
                  className={cn(
                    'absolute right-0 top-full z-40 mt-2 min-w-[180px] overflow-hidden rounded-lg',
                    'border border-border bg-background/95 backdrop-blur-md shadow-lifted p-1.5',
                  )}
                  initial={{ opacity: 0, y: -8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.98 }}
                  transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                >
                  {/* 用户信息头部 */}
                  <div className="px-3 py-2 border-b border-border/60 mb-1">
                    <p className="font-sans text-[12px] font-medium text-foreground truncate">
                      {user.displayName || user.username}
                    </p>
                    <p className="font-mono text-[10px] text-muted-foreground truncate">
                      @{user.username}
                    </p>
                  </div>
                  {/* 我的项目 */}
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setUserMenuOpen(false);
                      navigate('/projects');
                    }}
                    className={cn(
                      'flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left',
                      'text-[12.5px] text-muted-foreground transition-colors',
                      'hover:bg-muted hover:text-foreground',
                    )}
                  >
                    <Library className="h-3.5 w-3.5" aria-hidden="true" />
                    我的项目
                  </button>
                  {/* 设置 */}
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setUserMenuOpen(false);
                      navigate('/settings');
                    }}
                    className={cn(
                      'flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left',
                      'text-[12.5px] text-muted-foreground transition-colors',
                      'hover:bg-muted hover:text-foreground',
                    )}
                  >
                    <Settings className="h-3.5 w-3.5" aria-hidden="true" />
                    设置
                  </button>
                  {/* 分隔线 */}
                  <div className="my-1 border-t border-border/60" />
                  {/* 退出登录 */}
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setUserMenuOpen(false);
                      handleLogout();
                    }}
                    className={cn(
                      'flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left',
                      'text-[12.5px] text-muted-foreground transition-colors',
                      'hover:bg-destructive/5 hover:text-destructive',
                    )}
                  >
                    <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                    退出登录
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </header>
  );
}
