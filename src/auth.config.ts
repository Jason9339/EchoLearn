import type { NextAuthConfig } from 'next-auth';
 
export const authConfig = {
  pages: {
    signIn: '/login',
    signOut: '/',
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const { pathname } = nextUrl;
      const isOnDashboard = pathname.startsWith('/dashboard');
      const isAuthPage = pathname === '/login' || pathname === '/register';
      const isApiRoute = pathname.startsWith('/api/');

      // Log for debugging
      if (isApiRoute && pathname.includes('/upload')) {
        console.log('[Auth Config] API Route Check:', {
          pathname,
          isApiRoute,
          isLoggedIn,
          hasAuth: !!auth,
          hasUser: !!auth?.user
        });
      }

      if (isApiRoute) {
        return true;
      }

      if (isOnDashboard) return isLoggedIn;
      if (isAuthPage) return true; // Allow access to login and register pages
      // Removed auto-redirect to dashboard, users can access home page
      return true;
    },
    // Add JWT callback to include user id in token
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    // Add session callback to include user id in session
    async session({ session, token }) {
      // 檢查 token 是否為空（登出後可能為空）
      if (!token || !token.id) {
        // 返回一個最小的 session 對象，但保持類型安全
        return {
          expires: new Date(0).toISOString(), // 設為已過期
        } as typeof session;
      }

      if (token && session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
  providers: [], // Add providers with an empty array for now
  events: {
    async signOut(message) {
      // 登出時的額外處理（如果需要記錄日誌等）
      console.log('User signed out:', message);
    },
  },
} satisfies NextAuthConfig;
