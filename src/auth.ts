import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { authConfig } from './auth.config';
import { z } from 'zod';
import type { User } from '@/app/lib/definitions';
import bcrypt from 'bcrypt';
import postgres from 'postgres';

const sql = postgres(process.env.POSTGRES_URL!, { ssl: 'require' });

async function getUser(email: string): Promise<User | undefined> {
  try {
    const user = await sql<User[]>`SELECT * FROM users WHERE email=${email}`;
    return user[0];
  } catch (error) {
    console.error('Failed to fetch user:', error);
    throw new Error('Failed to fetch user.');
  }
}

export const { auth, signIn, signOut, handlers } = NextAuth({
  ...authConfig,
  // JWT 策略
  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60, // 24 小時後過期
    updateAge: 60 * 60, // 每 1 小時更新一次 session
  },
  cookies: {
    sessionToken: {
      name:
        process.env.NODE_ENV === 'production'
          ? '__Secure-authjs.session-token'
          : 'authjs.session-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        // 設定 maxAge 確保 cookie 在指定時間後過期
        maxAge: 24 * 60 * 60, // 24 小時
      }
    },
    // 確保所有 callback cookies 也使用相同的安全設定
    callbackUrl: {
      name:
        process.env.NODE_ENV === 'production'
          ? '__Secure-authjs.callback-url'
          : 'authjs.callback-url',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      }
    },
    csrfToken: {
      name:
        process.env.NODE_ENV === 'production'
          ? '__Host-authjs.csrf-token'
          : 'authjs.csrf-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      }
    }
  },
  providers: [
    Credentials({
      // 也可以加上 credentials 欄位描述（非必填）
      // credentials: { email: {}, password: {} },
      async authorize(credentials) {
        // 1) 先用 zod 驗證
        const parsed = z
          .object({
            email: z.string().email(),
            password: z.string().min(6),
          })
          .safeParse(credentials);

        if (!parsed.success) return null;

        const { email, password } = parsed.data;

        // 2) 查詢使用者
        const user = await getUser(email);
        if (!user) return null;

        // 3) 比對密碼
        const ok = await bcrypt.compare(password, user.password);
        if (!ok) return null;

        // 4) 回傳「淨化後」的使用者，避免把 password 帶進 session/JWT
        return {
          id: String(user.id),          // 確保是字串
          name: user.name ?? null,
          email: user.email ?? null,
          image: null,                  // 若沒有頭像欄位就回 null
        };
      },
    }),
  ],
});
