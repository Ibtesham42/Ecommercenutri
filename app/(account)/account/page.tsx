import type { Metadata } from "next";
import { BadgeCheck, AlertCircle } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ProfileForm } from "@/components/account/profile-form";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage() {
  const sessionUser = await getCurrentUser();
  const user = await prisma.user.findUnique({
    where: { id: sessionUser!.id },
    select: {
      name: true,
      email: true,
      phone: true,
      emailVerified: true,
      createdAt: true,
    },
  });

  if (!user) return null;

  return (
    <div className="max-w-xl space-y-6">
      <div className="rounded-xl border p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Email</p>
            <p className="font-medium">{user.email}</p>
          </div>
          {user.emailVerified ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
              <BadgeCheck className="size-3.5" /> Verified
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700">
              <AlertCircle className="size-3.5" /> Unverified
            </span>
          )}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Member since {formatDate(user.createdAt)}
        </p>
      </div>

      <div className="rounded-xl border p-5">
        <h2 className="mb-4 font-semibold">Personal details</h2>
        <ProfileForm
          defaultName={user.name ?? ""}
          defaultPhone={user.phone ?? ""}
        />
      </div>
    </div>
  );
}
