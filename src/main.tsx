import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { seedData } from './lib/seed';
import { useBookStore } from './stores/bookStore';
import { initThemes } from './stores/uiStore';
import { useAIModelStore } from './stores/aiModelStore';

initThemes();

// 从服务端拉取 AI 模型配置（错误状态由 store 暴露给 UI）
useAIModelStore.getState().fetchModels();

// 首次启动注入种子数据（《云隐录》示例武侠小说）
// seedData 内部幂等：若数据库已有作品则跳过
seedData()
  .then(() => {
    // 注入完成后刷新作品列表，并修正 currentBookId 合法性
    useBookStore.getState().refreshBooks();
  })
  .catch((err) => {
    console.error('种子数据注入失败：', err);
  });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
