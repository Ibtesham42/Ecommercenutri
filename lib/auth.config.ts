import type { NextAuthConfig } from "next-auth";
import type { Role } from "@prisma/client";

/**
 * Edge-safe Auth.js config — NO Prisma/bcrypt imports here so it can run in
 * middleware. The Prisma adapter and Credentials provider live in `lib/auth.ts`.
 */
export const authConfig = {
  trustHost: true,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.role = ((user as { role?: Role }).role ?? "USER") as Role;
      }
      return token;
    },
    async session({ session, token }) {
      const t = token as { id?: string; role?: Role };
      if (session.user) {
        if (t.id) session.user.id = t.id;
        if (t.role) session.user.role = t.role;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;

export default authConfig;
