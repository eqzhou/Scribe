/**
 * 场景页面
 *
 * 顶部欢迎区：大标题「场景 · 故事舞台」+ 副文案。
 * 工具栏：场景计数 + 新建按钮。
 * 卡片网格：auto-fill minmax(280px, 1fr)，氛围色 banner + 名称 + 描述 + 标签 + 关联统计。
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus } from 'lucide-react';
import { sceneRepository } from '../lib/repositories';
import { useApiQuery } from '../hooks/useApiQuery';
import { useBook } from '../hooks';
import type { Scene } from '../types';
import { Button, EmptyState, SkeletonGrid } from '../components/ui';
import { SceneCard } from '../features/scenes/SceneCard';
import { SceneForm } from '../features/scenes/SceneForm';

/**
 * 场景页面：欢迎区 + 工具栏 + 卡片网格。
 */
export default function ScenesPage() {
  const navigate = useNavigate();
  const book = useBook();
  const bookId = book?.id ?? null;

  // 实时监听当前作品的场景
  // 注意：useApiQuery 在加载未完成时返回 undefined，已加载空列表时返回 []
  const scenes = useApiQuery<Scene[]>(
    async () => (bookId ? sceneRepository.list(bookId) : []),
    [bookId],
  );

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Scene | null>(null);

  /** 打开新建表单 */
  const handleNew = (): void => {
    setEditing(null);
    setFormOpen(true);
  };

  /** 关闭表单 */
  const handleClose = (): void => {
    setFormOpen(false);
    setEditing(null);
  };

  return (
    <div className="px-8 py-6">
      {/* 欢迎区 */}
      <header className="mb-6">
        <h1 className="font-serif text-3xl font-bold tracking-wider text-foreground">
          场景
        </h1>
        <p className="mt-1.5 font-serif text-sm text-muted-foreground">
          管理故事发生的场景与地点。
        </p>
      </header>

      {/* 内容区 */}
      {!bookId ? (
        <EmptyState
          glyph="卷"
          title="尚未选择作品"
          description="请在项目页选择或创建一部作品后，再管理其场景。"
        />
      ) : scenes === undefined ? (
        <SkeletonGrid count={6} minColumnWidth={280} />
      ) : scenes.length === 0 ? (
        <>
          <EmptyState
            glyph="景"
            title="尚无场景"
            description="搭建故事舞台，让角色有处可栖，剧情有地可演。"
            action={{ label: '新建场景', onClick: handleNew }}
          />
          <SceneForm
            open={formOpen}
            onClose={handleClose}
            scene={editing}
            bookId={bookId}
          />
        </>
      ) : (
        <>
          {/* 工具栏 */}
          <div className="mb-4 flex items-center justify-between">
            <span className="font-serif text-sm text-muted-foreground">
              共 {scenes.length} 个场景
            </span>
            <Button
              variant="primary"
              size="md"
              icon={<Plus className="h-4 w-4" aria-hidden="true" />}
              onClick={handleNew}
            >
              新建场景
            </Button>
          </div>

          {/* 场景卡片网格 */}
          <motion.ul
            layout
            className="grid gap-4"
            style={{
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            }}
          >
            <AnimatePresence mode="popLayout">
              {scenes.map((scene) => (
                <SceneCard
                  key={scene.id}
                  scene={scene}
                  onClick={() => navigate(`/scenes/${scene.id}`)}
                />
              ))}
            </AnimatePresence>
          </motion.ul>

          {/* 编辑表单 */}
          <SceneForm
            open={formOpen}
            onClose={handleClose}
            scene={editing}
            bookId={bookId}
          />
        </>
      )}
    </div>
  );
}
