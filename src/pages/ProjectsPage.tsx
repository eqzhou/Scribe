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
 * 数据：使用 useLiveQuery 监听 db.books 与 db.chapters，实时反映变更。
 */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus } from 'lucide-react';
import { db } from '../lib/db';
import { useBookStore } from '../stores';
import type { Book } from '../types';
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
  const { currentBookId, setCurrentBook, refreshBooks } = useBookStore();

  // 实时监听作品列表（按 updatedAt 倒序）
  const books = useLiveQuery(
    () => db.books.orderBy('updatedAt').reverse().toArray(),
    [],
  );

  // 实时监听全部章节（用于按作品聚合章节数与字数）
  const chapters = useLiveQuery(() => db.chapters.toArray(), []);

  // 按作品 ID 聚合：章节数 + 累计字数
  const statsByBook = useMemo(() => {
    const map = new Map<string, { chapterCount: number; wordCount: number }>();
    if (chapters) {
      for (const c of chapters) {
        const prev = map.get(c.bookId) ?? { chapterCount: 0, wordCount: 0 };
        prev.chapterCount += 1;
        prev.wordCount += c.wordCount;
        map.set(c.bookId, prev);
      }
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
    void refreshBooks();
  };

  /** 触发删除：先查询影响范围再弹出确认框 */
  const handleDelete = async (book: Book): Promise<void> => {
    const [chapterCount, characterCount, worldviewCount] = await Promise.all([
      db.chapters.where('bookId').equals(book.id).count(),
      db.characters.where('bookId').equals(book.id).count(),
      db.worldview.where('bookId').equals(book.id).count(),
    ]);
    setDeleteTarget({ book, chapterCount, characterCount, worldviewCount });
  };

  /** 确认删除：级联删除作品及所有关联实体 */
  const handleDeleteConfirm = async (): Promise<void> => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const bookId = deleteTarget.book.id;
      // 级联删除：作品 + 所有关联实体（事务保证原子性）
      await db.transaction(
        'rw',
        [
          db.books,
          db.chapters,
          db.characters,
          db.worldview,
          db.scenes,
          db.plotLines,
          db.plotPoints,
          db.foreshadowing,
          db.volumes,
          db.inspiration,
          db.writingLogs,
          db.relations,
        ],
        async () => {
          await db.books.delete(bookId);
          await db.chapters.where('bookId').equals(bookId).delete();
          await db.characters.where('bookId').equals(bookId).delete();
          await db.worldview.where('bookId').equals(bookId).delete();
          await db.scenes.where('bookId').equals(bookId).delete();
          await db.plotLines.where('bookId').equals(bookId).delete();
          await db.plotPoints.where('bookId').equals(bookId).delete();
          await db.foreshadowing.where('bookId').equals(bookId).delete();
          await db.volumes.where('bookId').equals(bookId).delete();
          await db.inspiration.where('bookId').equals(bookId).delete();
          await db.writingLogs.where('bookId').equals(bookId).delete();
          await db.relations.where('bookId').equals(bookId).delete();
        },
      );
      setDeleteTarget(null);
      // 刷新 store：refreshBooks 内部会修正 currentBookId 的合法性
      await refreshBooks();
    } finally {
      setDeleting(false);
    }
  };

  // 加载中状态
  const loading = books === undefined;

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
      ) : (books?.length ?? 0) === 0 ? (
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
          {books!.map((book) => {
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
