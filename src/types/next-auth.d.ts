import { DefaultSession } from "next-auth"

declare module "next-auth" {
  /**
   * Extends the built-in session type to include user id
   */
  interface Session {
    user: {
      id: string
    } & DefaultSession["user"]
  }

  /**
   * Extends the built-in user type to include id as string
   */
  interface User {
    id: string
  }
}

declare module "next-auth/jwt" {
  /**
   * Extends the built-in JWT type to include user id
   */
  interface JWT {
    id: string
  }
}
