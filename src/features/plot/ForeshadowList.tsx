/**
 * ForeshadowList 伏笔追踪
 *
 * 卡片网格（auto-fill minmax(280px)）。
 * 右上角状态角标：pending铜金/planted墨黑/paidoff墨绿/abandoned灰色。
 * 标题 + 描述（3 行截断）+ 底部埋设/回收章节（链接样式，点击跳转编辑器）。
 * 已废弃卡片半透明；悬停上浮；点击进入编辑；右上角「新建伏笔」按钮。
 */
import { useMemo, useState, type MouseEvent } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Plus, Check } from 'lucide-react';
import type { Chapter, Foreshadowing, ForeshadowStatus } from '../../types';
import { useEditorStore } from '../../stores/editorStore';
import { cn } from '../../utils/cn';
import { Button, EmptyState } from '../../components/ui';
import { ForeshadowForm } from './ForeshadowForm';

export interface ForeshadowListProps {
  /** 当前作品的伏笔列表 */
  foreshadowing: Foreshadowing[];
  /** 当前作品的章节列表（用于名称查询与跳转） */
  chapters: Chapter[];
  /** 当前作品 ID */
  bookId: string;
}

/** 废弃理由前缀（与 ForeshadowForm 保持一致，用于卡片展示时剥离） */
const ABANDON_REASON_PREFIX = '【废弃理由】';
const ABANDON_REASON_SEP = '\n\n';

/** 状态 → 角标样式（planted 用朱砂红突出"未回收"警示,paidoff 用墨绿对勾） */
const BADGE_STYLE: Record<ForeshadowStatus, string> = {
  pending: 'bg-gold/15 text-gold',
  planted: 'bg-primary/15 text-primary',
  paidoff: 'bg-moss/15 text-moss',
  abandoned: 'bg-muted text-muted-foreground',
};

/** 状态 → 中文标签 */
const STATUS_LABEL: Record<ForeshadowStatus, string> = {
  pending: '待埋设',
  planted: '已埋设',
  paidoff: '已回收',
  abandoned: '已废弃',
};

/**
 * 剥离废弃理由前缀，返回卡片展示用的纯正文描述。
 */
function stripAbandonPrefix(raw: string): string {
  if (!raw.startsWith(ABANDON_REASON_PREFIX)) return raw;
  const rest = raw.slice(ABANDON_REASON_PREFIX.length);
  const sepIdx = rest.indexOf(ABANDON_REASON_SEP);
  return sepIdx === -1 ? '' : rest.slice(sepIdx + ABANDON_REASON_SEP.length);
}

/**
 * 伏笔追踪卡片网格。
 */
export function ForeshadowList({
  foreshadowing,
  chapters,
  bookId,
}: ForeshadowListProps) {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Foreshadowing | null>(null);

  /** 打开新建表单 */
  const handleNew = (): void => {
    setEditing(null);
    setFormOpen(true);
  };

  /** 打开编辑表单 */
  const handleEdit = (item: Foreshadowing): void => {
    setEditing(item);
    setFormOpen(true);
  };

  /** 关闭表单 */
  const handleClose = (): void => {
    setFormOpen(false);
    setEditing(null);
  };

  // 章节 id → Chapter 映射，用于卡片底部章节名查询
  const chapterMap = useMemo(() => {
    const m = new Map<string, Chapter>();
    for (const c of chapters) m.set(c.id, c);
    return m;
  }, [chapters]);

  // 空状态
  if (foreshadowing.length === 0) {
    return (
      <>
        <EmptyState
          glyph="笔"
          title="暂无伏笔"
          description="伏笔如暗礁，隐于水面之下。开始埋设你的第一条线索，让故事暗流涌动。"
          action={{ label: '新建伏笔', onClick: handleNew }}
        />
        <ForeshadowForm
          open={formOpen}
          onClose={handleClose}
          foreshadowing={editing}
          bookId={bookId}
        />
      </>
    );
  }

  return (
    <>
      {/* 工具栏：标题 + 新建按钮 */}
      <div className="mb-4 flex items-center justify-between">
        <span className="font-serif text-sm text-muted-foreground">
          共 {foreshadowing.length} 条伏笔
        </span>
        <Button
          variant="primary"
          size="md"
          icon={<Plus className="h-4 w-4" aria-hidden="true" />}
          onClick={handleNew}
        >
          新建伏笔
        </Button>
      </div>

      {/* 伏笔卡片网格 */}
      <div
        className="grid gap-4"
        style={{
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        }}
      >
        {foreshadowing.map((item) => (
          <ForeshadowCard
            key={item.id}
            foreshadowing={item}
            chapterMap={chapterMap}
            onClick={() => handleEdit(item)}
          />
        ))}
      </div>

      {/* 编辑表单 */}
      <ForeshadowForm
        open={formOpen}
        onClose={handleClose}
        foreshadowing={editing}
        bookId={bookId}
      />
    </>
  );
}

/** 单条伏笔卡片 */
interface ForeshadowCardProps {
  foreshadowing: Foreshadowing;
  chapterMap: Map<string, Chapter>;
  onClick: () => void;
}

function ForeshadowCard({
  foreshadowing,
  chapterMap,
  onClick,
}: ForeshadowCardProps) {
  const navigate = useNavigate();
  const setCurrentChapter = useEditorStore((s) => s.setCurrentChapter);

  const isAbandoned = foreshadowing.status === 'abandoned';
  const isPaidOff = foreshadowing.status === 'paidoff';
  const description = stripAbandonPrefix(foreshadowing.description);

  const setupChapter = foreshadowing.setupChapterId
    ? chapterMap.get(foreshadowing.setupChapterId)
    : undefined;
  const payoffChapter = foreshadowing.payoffChapterId
    ? chapterMap.get(foreshadowing.payoffChapterId)
    : undefined;

  /** 跳转至编辑器并定位章节（阻止冒泡，避免触发卡片点击） */
  const handleChapterJump = (
    e: MouseEvent,
    chapterId: string,
  ): void => {
    e.stopPropagation();
    setCurrentChapter(chapterId);
    navigate('/editor');
  };

  return (
    <motion.article
      whileHover={{ y: -3 }}
      transition={{ type: 'spring', stiffness: 320, damping: 24 }}
      onClick={onClick}
      className={cn(
        'group relative cursor-pointer overflow-hidden rounded-lg',
        'border border-border bg-muted p-5',
        'transition-shadow duration-300 hover:shadow-lifted',
        isAbandoned && 'opacity-55',
      )}
    >
      {/* 左侧状态色条（planted 朱砂红突出未回收,paidoff 墨绿） */}
      <div
        className={cn(
          'absolute left-0 top-0 bottom-0 w-1',
          foreshadowing.status === 'pending' && 'bg-gold',
          foreshadowing.status === 'planted' && 'bg-primary',
          foreshadowing.status === 'paidoff' && 'bg-moss',
          foreshadowing.status === 'abandoned' && 'bg-muted-foreground/40',
        )}
        aria-hidden="true"
      />

      {/* 状态角标（右上角） */}
      <span
        className={cn(
          'absolute right-3 top-3 inline-flex items-center gap-1 rounded px-2 py-0.5',
          'text-[12px] font-medium tracking-[1px]',
          BADGE_STYLE[foreshadowing.status],
        )}
      >
        {isPaidOff && <Check className="h-3 w-3" aria-hidden="true" />}
        {STATUS_LABEL[foreshadowing.status]}
      </span>

      {/* 标题（右留白避开角标） */}
      <h3 className="pr-16 pl-2 font-serif text-base font-semibold leading-snug text-foreground">
        {foreshadowing.title || '未命名伏笔'}
      </h3>

      {/* 描述：3 行截断 */}
      {description ? (
        <p
          className="mt-2 pl-2 text-xs leading-relaxed text-muted-foreground"
          style={{
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {description}
        </p>
      ) : (
        <p className="mt-2 pl-2 text-xs italic leading-relaxed text-muted-foreground">
          尚无描述，点击补充。
        </p>
      )}

      {/* 底部信息：埋设章节 / 回收章节 */}
      <div className="mt-3 ml-2 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border-soft pt-2.5 text-[11px] text-muted-foreground">
        {/* 埋设章节 */}
        {setupChapter ? (
          <span className="inline-flex items-center gap-1">
            <span>埋设</span>
            <button
              type="button"
              onClick={(e) => handleChapterJump(e, setupChapter.id)}
              className={cn(
                'font-medium text-primary underline-offset-2',
                'transition-colors hover:underline',
              )}
            >
              {setupChapter.title}
            </button>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1">
            <span>埋设</span>
            <span className="text-muted-foreground">未埋设</span>
          </span>
        )}

        <span className="text-border" aria-hidden="true">
          |
        </span>

        {/* 回收章节 */}
        {payoffChapter ? (
          <span className="inline-flex items-center gap-1">
            <span>回收</span>
            <button
              type="button"
              onClick={(e) => handleChapterJump(e, payoffChapter.id)}
              className={cn(
                'font-medium text-moss underline-offset-2',
                'transition-colors hover:underline',
              )}
            >
              {payoffChapter.title}
            </button>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1">
            <span>回收</span>
            <span className="text-muted-foreground">
              {isAbandoned ? '已废弃' : '待回收'}
            </span>
          </span>
        )}
      </div>
    </motion.article>
  );
}

export default ForeshadowList;
