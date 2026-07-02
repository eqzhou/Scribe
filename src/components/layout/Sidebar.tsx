/**
 * Sidebar 左侧导航栏（分组折叠式）
 *
 * 导航层级：
 * - 顶部固定「项目」入口（作品选择/切换）
 * - 选中作品后，下方展开项目内功能子菜单：
 *   工作台 / 世界观 / 角色 / 剧情 / 场景 / 写作 / 灵感
 * - 未选中作品时，子菜单整体置灰，点击跳转至 /projects 引导选择
 *
 * 视觉：
 * - 宽度 72px，墨黑底（bg-card），固定高度
 * - 顶部"Scribe"品牌（竖排 writing-mode: vertical-rl）
 * - 激活项：bg-primary/15 + 左侧 3px 朱砂红指示条
 * - 悬停：opacity 提升 + bg-background/8 + Framer Motion scale 1.05
 * - 底部圆形头像（朱砂渐变 + 毛笔字 Logo）
 *
 * 主题适配：使用语义 token（card/card-foreground/border），
 * sepia 下墨黑侧栏，light 下浅色侧栏，dark 下深色侧栏，三主题自动适配。
 */
import { NavLink, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  BookOpen,
  Globe,
  Users,
  TrendingUp,
  MapPin,
  PenTool,
  Lightbulb,
  type LucideIcon,
} from 'lucide-react';
import { useBookStore } from '../../stores';
import { cn } from '../../utils/cn';

/** 导航项配置 */
interface NavItem {
  /** 路由路径 */
  to: string;
  /** 中文标签 */
  label: string;
  /** lucide 图标 */
  icon: LucideIcon;
}

/** 项目内功能子菜单（选中作品后可用） */
const PROJECT_NAV_ITEMS: NavItem[] = [
  { to: '/dashboard', label: '工作台', icon: LayoutDashboard },
  { to: '/worldview', label: '世界观', icon: Globe },
  { to: '/characters', label: '角色', icon: Users },
  { to: '/plot', label: '剧情', icon: TrendingUp },
  { to: '/scenes', label: '场景', icon: MapPin },
  { to: '/editor', label: '写作', icon: PenTool },
  { to: '/inspiration', label: '灵感', icon: Lightbulb },
];

/** 将 NavLink 包装为 motion 组件以支持 whileHover 微动效 */
const MotionNavLink = motion.create(NavLink);

/**
 * 左侧导航栏：品牌 + 项目入口 + 项目内子菜单 + 底部头像。
 */
export default function Sidebar() {
  const currentBookId = useBookStore((s) => s.currentBookId);
  const navigate = useNavigate();
  const hasProject = !!currentBookId;

  return (
    <aside
      className={cn(
        'hidden md:flex h-screen w-[72px] shrink-0 flex-col items-center',
        'border-r border-border bg-card pb-4 pt-5 z-30 shadow-premium',
      )}
    >
      {/* 品牌：现代书写 Logo */}
      <div className="mb-8 flex flex-col items-center justify-center">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary-deep text-primary-foreground shadow-sm ring-1 ring-primary/20"
          title="Scribe Novel System"
        >
          <PenTool className="h-5 w-5" strokeWidth={2} />
        </div>
      </div>

      {/* 顶层：项目入口（始终可用） */}
      <nav className="flex w-full flex-col items-center">
        <MotionNavLink
          to="/projects"
          title="项目"
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
          className={({ isActive }) =>
            cn(
              'group relative flex h-12 w-12 cursor-pointer flex-col items-center justify-center gap-[3px] rounded-lg',
              'transition-all duration-200 ease-out z-10',
              isActive ? 'text-primary font-semibold bg-primary/5' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
            )
          }
        >
          {({ isActive }) => (
            <>
              {isActive && (
                <motion.span
                  layoutId="activeNavBg"
                  className="absolute inset-0 z-[-1] rounded-lg bg-primary/10"
                  transition={{ type: 'spring', stiffness: 350, damping: 25 }}
                />
              )}
              <BookOpen className="h-5 w-5" strokeWidth={1.5} aria-hidden="true" />
              <span className="text-[12px] tracking-wider mt-0.5">项目</span>
              {/* CSS Tooltip */}
              <span className="absolute left-[64px] scale-90 opacity-0 group-hover:opacity-100 group-hover:scale-100 transition-all duration-200 pointer-events-none bg-foreground text-background text-xs px-2.5 py-1 rounded shadow-lifted whitespace-nowrap z-50 border border-border-soft">
                项目列表
              </span>
            </>
          )}
        </MotionNavLink>
      </nav>

      {/* 分隔线 */}
      <div className="my-3.5 h-px w-8 bg-border opacity-60" aria-hidden="true" />

      {/* 项目内功能子菜单 */}
      <nav className="flex flex-1 flex-col items-center gap-2">
        {PROJECT_NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const disabled = !hasProject;
          const navProps = disabled
            ? {
                onClick: (e: React.MouseEvent) => {
                  e.preventDefault();
                  navigate('/projects');
                },
                title: '请先选择作品',
              }
            : { title: item.label };

          return (
            <MotionNavLink
              key={item.to}
              to={item.to}
              {...navProps}
              whileHover={disabled ? {} : { scale: 1.04 }}
              whileTap={disabled ? {} : { scale: 0.96 }}
              className={({ isActive }) =>
                cn(
                  'group relative flex h-12 w-12 cursor-pointer flex-col items-center justify-center gap-[3px] rounded-lg',
                  'text-card-foreground transition-all duration-200 ease-out z-10',
                  disabled
                    ? 'cursor-not-allowed opacity-30 text-muted-foreground'
                    : isActive
                      ? 'text-primary font-semibold bg-primary/5'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
                )
              }
            >
              {({ isActive }) => (
                <>
                  {!disabled && isActive && (
                    <motion.span
                      layoutId="activeNavBg"
                      className="absolute inset-0 z-[-1] rounded-lg bg-primary/10"
                      transition={{ type: 'spring', stiffness: 350, damping: 25 }}
                    />
                  )}
                  <Icon className="h-5 w-5" strokeWidth={1.5} aria-hidden="true" />
                  <span className="text-[12px] tracking-wider mt-0.5">{item.label}</span>
                  {/* CSS Tooltip */}
                  <span className="absolute left-[64px] scale-90 opacity-0 group-hover:opacity-100 group-hover:scale-100 transition-all duration-200 pointer-events-none bg-foreground text-background text-xs px-2.5 py-1 rounded shadow-lifted whitespace-nowrap z-50 border border-border-soft">
                    {disabled ? '请先选择作品' : item.label}
                  </span>
                </>
              )}
            </MotionNavLink>
          );
        })}
      </nav>

      {/* 底部头像：标准用户首字母 */}
      <div className="mt-auto flex flex-col items-center">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-border/30 text-card-foreground text-[11px] font-bold tracking-wider"
          aria-label="User Avatar"
        >
          USER
        </div>
      </div>
    </aside>
  );
}
