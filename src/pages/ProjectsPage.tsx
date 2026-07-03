/**
 * 项目页面
 *
 * 作品列表 + 新建/编辑/删除作品。
 *
 * 功能：
 * - 卡片网格布局（grid，auto-fill minmax 280px）
 * - 新建作品按钮（右上角，primary 变体）
 * - 删除确认（ConfirmDialog，显示影响范围）
 * - 空状态（EmptyState，glyph="墨"）
 * - 作品切换：点击卡片设为当前作品并跳转工作台
 *
 * 数据：使用 useApiQuery 轮询 books 与 chapters，实时反映变更。
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { bookRepository, chapterRepository, characterRepository, worldviewRepository } from '../lib/repositories';
import { useApiQuery } from '../hooks/useApiQuery';
import { deleteBookCascade } from '../lib/importer';
import { useBookStore, useToastStore } from '../stores';
import type { Book, Chapter } from '../types';
import { Button, ConfirmDialog, EmptyState, SkeletonGrid } from '../components/ui';
import { BookCard } from '../features/projects/BookCard';
import { BookForm } from '../features/projects/BookForm';

/** 删除目标携带的影响范围统计 */
interface DeleteTarget {
  book: Book;
  chapterCount: number;
  characterCount: number;
  worldviewCount: number;
}

/**
 * 项目页面：作品列表 + 新建/编辑/删除。
 */
export default function ProjectsPage() {
  const navigate = useNavigate();
  const { currentBookId, setCurrentBook, refreshBooks, books: storeBooks } = useBookStore();
  const pushToast = useToastStore((s) => s.pushToast);

  // 首次进入刷新 store（保证最新列表）
  useEffect(() => {
    refreshBooks().catch((e) => {
      pushToast('error', `加载作品失败：${e instanceof Error ? e.message : String(e)}`);
    });
  }, [refreshBooks, pushToast]);

  // 实时监听作品列表（store.books 已按 updatedAt 倒序刷新）
  const books = useApiQuery<Book[]>(() => bookRepository.list(), []);
  const list = books ?? storeBooks;

  // 按 updatedAt 倒序
  const sortedBooks = useMemo(() => {
    return [...list].sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
  }, [list]);

  // 实时监听全部章节（用于按作品聚合章节数与字数）
  // 后端无跨作品列表端点，按 books 并发拉取
  const chapters = useApiQuery<Chapter[]>(
    async () => {
      const bs = books ?? storeBooks;
      if (bs.length === 0) return [];
      const nested = await Promise.all(bs.map((b) => chapterRepository.list(b.id)));
      return nested.flat();
    },
    [list.length],
  ) ?? [];

  // 按作品 ID 聚合：章节数 + 累计字数
  const statsByBook = useMemo(() => {
    const map = new Map<string, { chapterCount: number; wordCount: number }>();
    for (const c of chapters) {
      const prev = map.get(c.bookId) ?? { chapterCount: 0, wordCount: 0 };
      prev.chapterCount += 1;
      prev.wordCount += c.wordCount;
      map.set(c.bookId, prev);
    }
    return map;
  }, [chapters]);

  // 弹窗状态
  const [formOpen, setFormOpen] = useState(false);
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deleting, setDeleting] = useState(false);

  /** 新建作品 */
  const handleNew = (): void => {
    setEditingBook(null);
    setFormOpen(true);
  };

  /** 编辑作品 */
  const handleEdit = (book: Book): void => {
    setEditingBook(book);
    setFormOpen(true);
  };

  /** 点击卡片：设为当前作品并跳转工作台 */
  const handleOpen = (book: Book): void => {
    setCurrentBook(book.id);
    navigate('/dashboard');
  };

  /** 表单保存成功后同步 store */
  const handleSaved = (): void => {
    refreshBooks().catch((e) => {
      pushToast('error', `同步作品列表失败：${e instanceof Error ? e.message : String(e)}`);
    });
  };

  /** 触发删除：先查询影响范围再弹出确认框 */
  const handleDelete = (book: Book): void => {
    Promise.all([
      chapterRepository.list(book.id).then((arr) => arr.length),
      characterRepository.list(book.id).then((arr) => arr.length),
      worldviewRepository.list(book.id).then((arr) => arr.length),
    ])
      .then(([chapterCount, characterCount, worldviewCount]) => {
        setDeleteTarget({ book, chapterCount, characterCount, worldviewCount });
      })
      .catch((e) => {
        pushToast('error', `加载影响范围失败：${e instanceof Error ? e.message : String(e)}`);
      });
  };

  /** 确认删除：级联删除作品及所有关联实体 */
  const handleDeleteConfirm = async (): Promise<void> => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteBookCascade(deleteTarget.book.id);
      setDeleteTarget(null);
      // 刷新 store：refreshBooks 内部会修正 currentBookId 的合法性
      await refreshBooks();
      pushToast('success', `作品「${deleteTarget.book.title}」已删除`);
    } catch (e) {
      pushToast('error', `删除失败：${e instanceof Error ? e.message : String(e)}`);
      // 失败时保留 deleteTarget 以便用户重试
    } finally {
      setDeleting(false);
    }
  };

  // 加载中状态：list 为空且 books 尚未返回时为 true
  const isFetching = list.length === 0 && books === undefined;
  // 延迟显示 Skeleton：仅当加载持续超过 300ms 才显示骨架屏，避免快速加载时闪烁
  const [skeletonVisible, setSkeletonVisible] = useState(false);
  useEffect(() => {
    if (!isFetching) {
      setSkeletonVisible(false);
      return;
    }
    const timer = window.setTimeout(() => setSkeletonVisible(true), 300);
    return () => window.clearTimeout(timer);
  }, [isFetching]);
  const loading = skeletonVisible;

  return (
    <div className="px-8 py-6">
      {/* 顶部：标题 + 新建按钮 */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl font-bold tracking-wider text-foreground">
            <span className="mr-1.5 italic text-primary" aria-hidden="true">
              §
            </span>
            我的作品
          </h1>
          <p className="mt-1 font-serif text-sm text-muted-foreground">
            执笔 Scribe，书写江湖。每一部作品，皆是一段未完的因果。
          </p>
        </div>
        <Button
          variant="primary"
          size="md"
          icon={<Plus className="h-4 w-4" aria-hidden="true" />}
          onClick={handleNew}
        >
          新建作品
        </Button>
      </div>

      {/* 内容区 */}
      {loading ? (
        <SkeletonGrid count={6} minColumnWidth={280} />
      ) : sortedBooks.length === 0 ? (
        <EmptyState
          glyph="墨"
          title="尚无作品"
          description="创建你的第一部作品，开启江湖之旅。"
          action={{ label: '创建作品', onClick: handleNew }}
        />
      ) : (
        <div
          className="grid gap-5"
          style={{
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          }}
        >
          {sortedBooks.map((book) => {
            const stats = statsByBook.get(book.id) ?? {
              chapterCount: 0,
              wordCount: 0,
            };
            return (
              <BookCard
                key={book.id}
                book={book}
                chapterCount={stats.chapterCount}
                wordCount={stats.wordCount}
                isActive={book.id === currentBookId}
                onOpen={handleOpen}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            );
          })}
        </div>
      )}

      {/* 新建/编辑弹窗 */}
      <BookForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        book={editingBook}
        onSaved={handleSaved}
      />

      {/* 删除确认 */}
      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => (deleting ? undefined : setDeleteTarget(null))}
        onConfirm={handleDeleteConfirm}
        title="删除作品"
        message={`确认永久删除作品「${deleteTarget?.book.title ?? ''}」？此操作不可撤销。`}
        impactInfo={
          deleteTarget
            ? `将同时删除 ${deleteTarget.chapterCount} 个章节、${deleteTarget.characterCount} 个角色档案、${deleteTarget.worldviewCount} 条世界观等全部关联数据。`
            : undefined
        }
        confirmText="永久删除"
        danger
      />
    </div>
  );
}
