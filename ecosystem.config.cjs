/**
 * PM2 进程配置
 *
 * 托管 Scribe 应用：单进程 Express 服务，同时提供
 *   - /api/ai/* AI 代理接口
 *   - 静态前端构建产物（dist/）
 *
 * 常用命令（在项目根目录执行）：
 *   pm2 start ecosystem.config.cjs        # 启动
 *   pm2 restart scribe                    # 重启
 *   pm2 reload scribe                     # 零停机重启
 *   pm2 stop scribe                       # 停止
 *   pm2 delete scribe                     # 删除进程
 *   pm2 logs scribe                       # 查看日志
 *   pm2 monit                             # 监控面板
 *   pm2 save                              # 保存进程列表（开机自启需配合 pm2 startup）
 */
module.exports = {
  apps: [
    {
      name: 'scribe',
      script: 'server/dist/index.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: 8787,
        // 生产模式前后端同源，CORS 允许自身即可
        ALLOWED_ORIGIN: 'http://localhost:8787',
      },
      // 日志输出
      out_file: './logs/out.log',
      error_file: './logs/error.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      // 启动延迟与重试策略
      restart_delay: 3000,
      max_restarts: 10,
      min_uptime: '10s',
    },
  ],
};
