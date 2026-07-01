/**
 * MobileTabBar 移动端底部 Tab 导航
 *
 * 仅在移动端显示（md:hidden），桌面端使用左侧 Sidebar。
 *
 * 功能：
 * - 5 个 Tab 项：工作台、角色、写作（中间主操作）、剧情、设置
 * - 点击跳转对应路由，当前路由高亮
 * - 中间"写作"Tab 圆形凸起设计，突出主操作
 * - 毛玻璃效果（backdrop-blur）
 * - 高度约 60px，固定定位底部
 */
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  Users,
  PenTool,
  GitBranch,
  Settings,
  type LucideIcon,
} from 'lucide-react';
import { useBookStore } from '../../stores';
import { cn } from '../../utils/cn';

/** Tab 项配置 */
interface TabItem {
  /** 路由路径 */
  to: string;
  /** 中文标签 */
  label: string;
  /** lucide 图标 */
  icon: LucideIcon;
  /** 是否为中间主操作按钮 */
  isMain?: boolean;
  /** 是否需要选中作品才能访问 */
  requireProject?: boolean;
}

/** 底部 Tab 配置（5 个核心功能） */
const TAB_ITEMS: TabItem[] = [
  { to: '/dashboard', label: '工作台', icon: LayoutDashboard, requireProject: true },
  { to: '/characters', label: '角色', icon: Users, requireProject: true },
  { to: '/editor', label: '写作', icon: PenTool, isMain: true, requireProject: true },
  { to: '/plot', label: '剧情', icon: GitBranch, requireProject: true },
  { to: '/settings', label: '设置', icon: Settings },
];

/**
 * 移动端底部 Tab 导航栏
 */
export default function MobileTabBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const currentBookId = useBookStore((s) => s.currentBookId);
  const hasProject = !!currentBookId;

  /** 检查当前路径是否匹配某个 Tab（支持子路由） */
  const isActive = (to: string) => {
    return location.pathname === to || location.pathname.startsWith(to + '/');
  };

  /** 处理 Tab 点击 */
  const handleClick = (item: TabItem) => {
    if (item.requireProject && !hasProject) {
      navigate('/projects');
      return;
    }
    navigate(item.to);
  };

  return (
    <nav
      className={cn(
        'fixed bottom-0 left-0 right-0 z-50 md:hidden',
        'border-t border-border bg-card/80 backdrop-blur-xl',
        'pb-[env(safe-area-inset-bottom)]',
      )}
    >
      <div className="relative flex h-16 items-center justify-around px-2">
        {TAB_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.to);
          const disabled = item.requireProject && !hasProject;

          if (item.isMain) {
            return (
              <button
                key={item.to}
                onClick={() => handleClick(item)}
                className={cn(
                  'relative -mt-6 flex flex-col items-center justify-center',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                )}
                aria-label={item.label}
              >
                <motion.div
                  whileHover={disabled ? {} : { scale: 1.05, y: -2 }}
                  whileTap={disabled ? {} : { scale: 0.95 }}
                  className={cn(
                    'flex h-14 w-14 items-center justify-center rounded-full',
                    'bg-gradient-to-br from-primary to-primary-deep text-primary-foreground',
                    'shadow-lg shadow-primary/30 ring-4 ring-card',
                    disabled && 'cursor-not-allowed opacity-50',
                  )}
                >
                  <Icon className="h-6 w-6" strokeWidth={2} />
                </motion.div>
                <span
                  className={cn(
                    'mt-1 text-[12px] font-medium tracking-wide',
                    active ? 'text-primary' : 'text-muted-foreground',
                  )}
                >
                  {item.label}
                </span>
              </button>
            );
          }

          return (
            <button
              key={item.to}
              onClick={() => handleClick(item)}
              className={cn(
                'flex flex-1 flex-col items-center justify-center gap-1 py-2',
                'transition-colors duration-200',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 rounded-lg',
                disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer',
              )}
              aria-label={item.label}
            >
              <Icon
                className={cn(
                  'h-5 w-5 transition-colors duration-200',
                  active ? 'text-primary' : 'text-muted-foreground',
                )}
                strokeWidth={active ? 2 : 1.5}
              />
              <span
                className={cn(
                  'text-[12px] font-medium tracking-wide transition-colors duration-200',
                  active ? 'text-primary font-semibold' : 'text-muted-foreground',
                )}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
