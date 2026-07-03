/**
 * 认证页面：登录 / 注册
 *
 * 同一页面通过 Tab 切换登录与注册模式：
 * - 登录：username + password
 * - 注册：username + password + displayName（可选）
 *
 * 提交流程：
 * 1. 调用 authClient.register / login
 * 2. 成功后写入 userStore.setAuth 并跳转 /editor
 * 3. 失败用 inline error + toast 提示
 *
 * 设计：居中卡片（约 400px）+ 朱砂红品牌色 + framer-motion 入场动画。
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AlertCircle } from 'lucide-react';
import { Button, Input } from '../components/ui';
import { useToastStore, useUserStore } from '../stores';
import { login as apiLogin, register as apiRegister } from '../lib/authClient';
import { cn } from '../utils/cn';

/** Tab 模式：登录 / 注册 */
type AuthMode = 'login' | 'register';

export default function AuthPage() {
  const navigate = useNavigate();
  const setAuth = useUserStore((s) => s.setAuth);
  const pushToast = useToastStore((s) => s.pushToast);

  const [mode, setMode] = useState<AuthMode>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isRegister = mode === 'register';

  /** 切换 Tab：清空错误与表单敏感字段 */
  const switchMode = (next: AuthMode) => {
    if (next === mode) return;
    setMode(next);
    setError(null);
    setPassword('');
  };

  /** 提交表单 */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // 基础前端校验
    if (!username.trim()) {
      setError('请输入用户名');
      return;
    }
    if (!password) {
      setError('请输入密码');
      return;
    }
    if (password.length < 6) {
      setError('密码至少 6 位');
      return;
    }

    setSubmitting(true);
    try {
      const res = isRegister
        ? await apiRegister(username.trim(), password, displayName.trim() || undefined)
        : await apiLogin(username.trim(), password);
      setAuth(res.token, res.user);
      pushToast('success', isRegister ? '注册成功，欢迎加入 Scribe' : '登录成功');
      navigate('/editor', { replace: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : '操作失败，请重试';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className={cn(
        'relative flex min-h-screen items-center justify-center overflow-hidden',
        'bg-background px-4',
      )}
    >
      {/* 背景装饰：柔光晕染 */}
      <div
        className="pointer-events-none absolute inset-0 opacity-60"
        aria-hidden="true"
        style={{
          background:
            'radial-gradient(ellipse at 20% 20%, hsl(var(--primary) / 0.08), transparent 50%),' +
            'radial-gradient(ellipse at 80% 80%, hsl(var(--primary) / 0.06), transparent 50%)',
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className={cn(
          'relative z-10 w-full max-w-[400px]',
          'rounded-2xl border border-border bg-card/95 backdrop-blur-xl',
          'px-7 py-8 shadow-lifted',
        )}
      >
        {/* 品牌区 */}
        <div className="mb-7 flex flex-col items-center text-center">
          <div
            className={cn(
              'mb-3 flex h-12 w-12 items-center justify-center rounded-xl',
              'border border-secondary/40 bg-secondary/10 font-brush text-2xl text-primary',
              'shadow-soft',
            )}
            aria-hidden="true"
          >
            墨
          </div>
          <h1 className="font-serif text-2xl font-bold tracking-widest text-foreground">
            Scribe
          </h1>
          <p className="mt-1.5 font-sans text-[13px] text-muted-foreground">
            {isRegister ? '注册账号，开启你的创作之旅' : '登录账号，继续书写你的故事'}
          </p>
        </div>

        {/* Tab 切换 */}
        <div
          className="mb-5 flex rounded-lg border border-border bg-muted/40 p-1"
          role="tablist"
          aria-label="认证模式"
        >
          {(['login', 'register'] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => switchMode(m)}
              className={cn(
                'flex-1 rounded-md py-1.5 font-sans text-[13px] font-medium',
                'transition-all duration-200',
                mode === m
                  ? 'bg-background text-primary shadow-soft'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {m === 'login' ? '登录' : '注册'}
            </button>
          ))}
        </div>

        {/* 表单 */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          {isRegister && (
            <Input
              label="显示名（可选）"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="如：墨白"
              autoComplete="nickname"
              maxLength={32}
              disabled={submitting}
            />
          )}

          <Input
            label="用户名"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="字母 / 数字 / 下划线"
            autoComplete="username"
            maxLength={32}
            disabled={submitting}
          />

          <Input
            label="密码"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="至少 6 位"
            autoComplete={isRegister ? 'new-password' : 'current-password'}
            disabled={submitting}
          />

          {/* 错误提示 */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                'flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/8',
                'px-3 py-2 font-sans text-[12.5px] text-destructive',
              )}
              role="alert"
            >
              <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>{error}</span>
            </motion.div>
          )}

          <Button
            type="submit"
            variant="primary"
            size="lg"
            loading={submitting}
            className="mt-1 w-full"
          >
            {isRegister ? '创建账号' : '登录'}
          </Button>
        </form>

        {/* 切换链接 */}
        <p className="mt-5 text-center font-sans text-[12.5px] text-muted-foreground">
          {isRegister ? '已有账号？' : '还没有账号？'}
          <button
            type="button"
            onClick={() => switchMode(isRegister ? 'login' : 'register')}
            className="ml-1 font-medium text-primary transition-colors hover:text-primary-deep"
          >
            {isRegister ? '立即登录' : '立即注册'}
          </button>
        </p>
      </motion.div>
    </div>
  );
}
