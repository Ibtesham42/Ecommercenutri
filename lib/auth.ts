import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import type { Provider } from "next-auth/providers";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { env, isConfigured } from "@/lib/env";
import { loginSchema } from "@/lib/validations/auth";
import { authConfig } from "@/lib/auth.config";
import { checkRateLimit, limiters } from "@/lib/rate-limit";
import type { Permission } from "@/lib/permissions";

const providers: Provider[] = [];

if (isConfigured.google()) {
  providers.push(
    Google({
      clientId: env.googleId,
      clientSecret: env.googleSecret,
      allowDangerousEmailAccountLinking: true,
    }),
  );
}

providers.push(
  Credentials({
    name: "credentials",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    authorize: async (raw, request) => {
      // Rate-limit at the provider level too, so direct POSTs to the NextAuth
      // credentials endpoint (bypassing the login server action) are throttled.
      const ip =
        request?.headers?.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        request?.headers?.get("x-real-ip") ||
        "anon";
      const { success } = await checkRateLimit(limiters.auth, `authorize:${ip}`);
      if (!success) return null;

      const parsed = loginSchema.safeParse(raw);
      if (!parsed.success) return null;
      const { email, password } = parsed.data;

      const user = await prisma.user.findUnique({ where: { email } });
      if (!user || !user.passwordHash || !user.isActive) return null;

      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) return null;

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
        role: user.role,
      };
    },
  }),
);

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  ...authConfig,
  providers,
});

/** Returns the current session user, or null. */
export async function getCurrentUser() {
  const session = await auth();
  return session?.user ?? null;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error("UNAUTHENTICATED");
  return user;
}

/** Any admin = sub-admin (ADMIN) or main admin (SUPER_ADMIN). */
export async function isAdmin() {
  const user = await getCurrentUser();
  return user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";
}

/** Returns the current user if they are an admin (ADMIN or SUPER_ADMIN), else
 *  throws. Use in admin server actions (routes are also guarded by middleware
 *  + layout). Fine-grained access is enforced with `requirePermission`. */
export async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")) {
    throw new Error("FORBIDDEN");
  }
  return user;
}

export type AdminContext = {
  id: string;
  name: string | null;
  email: string;
  role: Role;
  permissions: string[];
};

/**
 * Load the current admin's role + permissions *fresh from the database* (so a
 * stale JWT can't grant or retain access). Returns null when not signed in, not
 * an admin, or deactivated. Use this for any authorization decision in admin
 * server code rather than trusting the session role.
 */
export async function getAdminUser(): Promise<AdminContext | null> {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;

  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, role: true, permissions: true, isActive: true },
  });
  if (!user || !user.isActive) return null;
  if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") return null;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    permissions: user.permissions,
  };
}

export async function isSuperAdmin() {
  const admin = await getAdminUser();
  return admin?.role === "SUPER_ADMIN";
}

/** Throws unless the current user is a SUPER_ADMIN. For admin/store management. */
export async function requireSuperAdmin(): Promise<AdminContext> {
  const admin = await getAdminUser();
  if (!admin || admin.role !== "SUPER_ADMIN") throw new Error("FORBIDDEN");
  return admin;
}

/**
 * Throws unless the current admin may access `permission`. Super admins always
 * pass; sub-admins must have the permission in their list.
 */
export async function requirePermission(
  permission: Permission,
): Promise<AdminContext> {
  const admin = await getAdminUser();
  if (!admin) throw new Error("FORBIDDEN");
  if (admin.role === "SUPER_ADMIN") return admin;
  if (!admin.permissions.includes(permission)) throw new Error("FORBIDDEN");
  return admin;
}
