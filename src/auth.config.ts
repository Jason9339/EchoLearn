import type { NextAuthConfig } from 'next-auth';
 
export const authConfig = {
  pages: {
    signIn: '/login',
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const { pathname } = nextUrl;
      const isOnDashboard = pathname.startsWith('/dashboard');
      const isAuthPage = pathname === '/login' || pathname === '/register';
      const isApiRoute = pathname.startsWith('/api/');

      if (isApiRoute) {
        return true;
      }

      if (isOnDashboard) return isLoggedIn;
      if (isAuthPage) return true; // Allow access to login and register pages
      if (isLoggedIn) return Response.redirect(new URL('/dashboard', nextUrl));
      return true;
    },
  },
  providers: [], // Add providers with an empty array for now
} satisfies NextAuthConfig;
