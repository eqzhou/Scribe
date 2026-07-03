// Prisma 客户端单例
// 全局共享一个 PrismaClient 实例，避免开发模式下热重载产生多个连接
// Prisma 7 移除了 datasourceUrl 选项，需通过 driver adapter 连接数据库
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const datasourceUrl = process.env.DATABASE_URL;
if (!datasourceUrl) {
  throw new Error('DATABASE_URL 未配置：请在 .env 中设置数据库连接字符串');
}

const adapter = new PrismaPg(datasourceUrl);
export const prisma = new PrismaClient({ adapter });
