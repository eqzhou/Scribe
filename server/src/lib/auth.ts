// 用户认证工具
// - bcryptjs 进行密码哈希与校验
// - jsonwebtoken 签发与校验 JWT
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// JWT 密钥：必须通过环境变量配置
// 注意：在函数内读取，确保 index.ts 中的 dotenv.config 已执行
function getJwtSecret(): string {
  return process.env.JWT_SECRET ?? 'scribe_dev_jwt_secret_change_in_production';
}
const JWT_EXPIRES_IN = '30d';

// 密码哈希（saltRounds=10）
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

// 校验密码与哈希
export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

// 签发 JWT，有效期 30 天
export function signToken(userId: string): string {
  return jwt.sign({ userId }, getJwtSecret(), { expiresIn: JWT_EXPIRES_IN });
}

// 校验 JWT，成功返回 { userId }，失败返回 null
export function verifyToken(token: string): { userId: string } | null {
  try {
    const payload = jwt.verify(token, getJwtSecret()) as { userId?: string };
    if (payload && typeof payload.userId === 'string') {
      return { userId: payload.userId };
    }
    return null;
  } catch {
    return null;
  }
}
