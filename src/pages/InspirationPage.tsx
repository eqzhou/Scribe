/**
 * 灵感库页面
 *
 * 顶部欢迎区 + QuickNote 速记框 + 工具栏（分类筛选 + 搜索 + 计数）+ 瀑布流卡片。
 * useLiveQuery 监听当前作品的灵感（按 createdAt 倒序）。
 * 点击卡片打开编辑 Modal（内联实现，含删除二次确认）。
 */
import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Search, Trash2 } from 'lucide-react';
import { db } from '../lib/db';
import { inspirationRepository } from '../lib/repositories';
import { useBook } from '../hooks';
import { useToastStore } from '../stores';
import type { Inspiration } from '../types';
import { Button, EmptyState, Modal, Input, Textarea, ConfirmDialog, Skeleton } from '../components/ui';
import { QuickNote } from '../features/inspiration/QuickNote';
import { InspirationCard } from '../features/inspiration/InspirationCard';

/**
 * 灵感库页面：速记 + 瀑布流 + 筛选搜索 + 编辑/删除。
 */
export default function InspirationPage() {
  const book = useBook();
  const bookId = book?.id ?? null;

  // 实时监听当前作品的灵感（createdAt 倒序，最新在前）
  // 注意：不传默认值，初始为 undefined 以区分"加载中"与"已加载空列表"
  const inspirations = useLiveQuery(
    async () => {
      if (!bookId) return [] as Inspiration[];
      const list = await db.inspiration.where('bookId').equals(bookId).toArray();
      return list.sort((a, b) => b.createdAt - a.createdAt);
    },
    [bookId],
  );

  const [categoryFilter, setCategoryFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // 编辑 Modal 状态
  const [editing, setEditing] = useState<Inspiration | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editTagsInput, setEditTagsInput] = useState('');
  // 保存进行中（防并发 + 按钮 loading）
  const [saving, setSaving] = useState(false);

  // 删除确认
  const [confirmDelete, setConfirmDelete] = useState(false);

  const pushToast = useToastStore((s) => s.pushToast);

  // 从灵感列表聚合唯一分类
  const categories = useMemo(() => {
    const set = new Set<string>();
    (inspirations ?? []).forEach((i) => {
      if (i.category.trim()) set.add(i.category.trim());
    });
    return Array.from(set);
  }, [inspirations]);

  // 前端过滤：分类 + 搜索
  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return (inspirations ?? []).filter((i) => {
      if (categoryFilter && i.category.trim() !== categoryFilter) return false;
      if (!q) return true;
      return (
        i.title.toLowerCase().includes(q) || i.content.toLowerCase().includes(q)
      );
    });
  }, [inspirations, categoryFilter, searchQuery]);

  /** 打开编辑 Modal */
  const handleEdit = (inspiration: Inspiration): void => {
    setEditing(inspiration);
    setEditTitle(inspiration.title);
    setEditContent(inspiration.content);
    setEditCategory(inspiration.category);
    setEditTagsInput(inspiration.tags.join(', '));
    setFormOpen(true);
  };

  /** 关闭编辑 Modal */
  const handleClose = (): void => {
    setFormOpen(false);
    setEditing(null);
  };

  /** 保存编辑 */
  const handleSave = async (): Promise<void> => {
    if (!editing) return;
    if (saving) return;
    setSaving(true);
    try {
      const tags = editTagsInput
        .split(/[,，]/)
        .map((t) => t.trim())
        .filter(Boolean);
      await inspirationRepository.update(editing.id, {
        title: editTitle.trim(),
        content: editContent.trim(),
        category: editCategory.trim(),
        tags,
      });
      pushToast('success', '已保存灵感');
      handleClose();
    } catch (e) {
      pushToast('error', `保存失败：${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSaving(false);
    }
  };

  /** 删除灵感 */
  const handleDelete = async (): Promise<void> => {
    if (!editing) return;
    try {
      await inspirationRepository.delete(editing.id);
      pushToast('success', '已删除灵感');
      handleClose();
    } catch (e) {
      pushToast('error', `删除失败：${e instanceof Error ? e.message : String(e)}`);
    }
  };

  return (
    <div className="px-8 py-6">
      {/* 欢迎区 */}
      <header className="mb-6">
        <h1 className="font-serif text-3xl font-bold tracking-wider text-foreground">
          灵感
        </h1>
        <p className="mt-1.5 font-serif text-sm text-muted-foreground">
          随手记录灵感片段与速记，随时回顾整理。
        </p>
      </header>

      {!bookId ? (
        <EmptyState
          glyph="卷"
          title="尚未选择作品"
          description="请在项目页选择或创建一部作品后，再管理灵感。"
        />
      ) : (
        <>
          {/* 速记框 */}
          <QuickNote bookId={bookId} />

          {inspirations === undefined ? (
            // 瀑布流骨架屏：不同高度模拟卡片内容长短差异
            <ul
              className="columns-1 gap-4 sm:columns-2 lg:columns-3 xl:columns-4"
              style={{ columnGap: '1rem' }}
              aria-busy="true"
            >
              {[100, 140, 110, 160, 120, 150, 100, 130].map((h, i) => (
                <li
                  key={i}
                  className="mb-4 flex break-inside-avoid flex-col gap-2 rounded-lg border border-border bg-muted p-4"
                >
                  <Skeleton width="40%" height={20} />
                  <Skeleton width="100%" height={h - 60} />
                  <div className="mt-1 flex items-center gap-2 border-t border-border/60 pt-2">
                    <Skeleton width={48} height={14} rounded="full" />
                    <Skeleton width={60} height={11} />
                  </div>
                </li>
              ))}
            </ul>
          ) : inspirations.length === 0 ? (
            <EmptyState
              glyph="灵"
              title="尚无灵感"
              description="灵感如星火，随手记下方能燎原。在上方速记框写下你的第一个念头。"
            />
          ) : (
            <>
              {/* 工具栏：分类筛选 + 搜索 + 计数 */}
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <span className="font-serif text-sm text-muted-foreground">
                  共 {filtered.length}
                  {categoryFilter || searchQuery ? ` / ${inspirations.length}` : ''} 条灵感
                </span>

                <div className="ml-auto flex items-center gap-2">
                  {/* 分类筛选 */}
                  {categories.length > 0 && (
                    <select
                      value={categoryFilter}
                      onChange={(e) => setCategoryFilter(e.target.value)}
                      className="rounded border border-border bg-muted px-2.5 py-1.5 text-xs text-foreground focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary/20"
                      aria-label="按分类筛选"
                    >
                      <option value="">全部分类</option>
                      {categories.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  )}

                  {/* 搜索框 */}
                  <div className="relative">
                    <Search
                      className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="搜索灵感…"
                      className="w-44 rounded border border-border bg-muted py-1.5 pl-8 pr-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary/20"
                      aria-label="搜索灵感"
                    />
                  </div>
                </div>
              </div>

              {/* 瀑布流 */}
              {filtered.length === 0 ? (
                <EmptyState
                  glyph="寻"
                  title="未找到匹配的灵感"
                  description="尝试更换关键词或清除筛选条件。"
                />
              ) : (
                <ul
                  className="columns-1 gap-4 sm:columns-2 lg:columns-3 xl:columns-4"
                  style={{ columnGap: '1rem' }}
                >
                  {filtered.map((inspiration, i) => (
                    <InspirationCard
                      key={inspiration.id}
                      inspiration={inspiration}
                      index={i}
                      onClick={() => handleEdit(inspiration)}
                    />
                  ))}
                </ul>
              )}
            </>
          )}
        </>
      )}

      {/* 编辑 Modal */}
      <Modal
        open={formOpen}
        onClose={handleClose}
        title="编辑灵感"
        width="520px"
      >
        <div className="flex flex-col gap-4">
          <Input
            label="标题"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            placeholder="灵感标题（可选）"
          />
          <Textarea
            label="内容"
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            placeholder="灵感的详细内容…"
            rows={6}
          />
          <div className="flex gap-3">
            <Input
              label="分类"
              value={editCategory}
              onChange={(e) => setEditCategory(e.target.value)}
              placeholder="分类"
              className="flex-1"
            />
            <Input
              label="标签"
              value={editTagsInput}
              onChange={(e) => setEditTagsInput(e.target.value)}
              placeholder="逗号分隔"
              className="flex-1"
            />
          </div>
          <div className="flex items-center justify-between border-t border-border pt-3">
            <Button
              variant="danger"
              size="sm"
              icon={<Trash2 className="h-3.5 w-3.5" aria-hidden="true" />}
              onClick={() => setConfirmDelete(true)}
            >
              删除
            </Button>
            <div className="flex gap-2">
              <Button variant="ghost" size="md" onClick={handleClose} disabled={saving}>
                取消
              </Button>
              <Button variant="primary" size="md" onClick={handleSave} loading={saving}>
                保存
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      {/* 删除确认 */}
      <ConfirmDialog
        open={confirmDelete}
        title="删除灵感"
        message={`确认删除「${editing?.title || '无标题灵感'}」？此操作不可撤销。`}
        confirmText="删除"
        cancelText="取消"
        danger
        onConfirm={handleDelete}
        onClose={() => setConfirmDelete(false)}
      />
    </div>
  );
}
