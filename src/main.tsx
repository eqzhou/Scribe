import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { useBookStore } from './stores/bookStore';
import { initThemes } from './stores/uiStore';
import { useAIModelStore } from './stores/aiModelStore';

initThemes();

// 从服务端拉取 AI 模型配置（错误状态由 store 暴露给 UI）
useAIModelStore.getState().fetchModels();

// 拉取作品列表并修正 currentBookId 合法性
useBookStore.getState().refreshBooks();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
