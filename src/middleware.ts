import NextAuth from 'next-auth';
import { authConfig } from './auth.config';
 
export default NextAuth(authConfig).auth;
 
export const config = {
  // https://nextjs.org/docs/app/building-your-application/routing/middleware#matcher
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - audio (our audio files)
     * - anything with a file extension (e.g., .png, .ico)
     */
    '/((?!api|_next/static|_next/image|audio|.*\\..*).*)'
  ],
  runtime: 'nodejs',
};
