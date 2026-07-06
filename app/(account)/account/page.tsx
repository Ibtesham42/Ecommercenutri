import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ProfileForm } from "@/components/account/profile-form";
import { AvatarUpload } from "@/components/account/avatar-upload";
import {
  EmailSection,
  PhoneSection,
  PasswordSection,
} from "@/components/account/contact-security";
import { PushOptIn } from "@/components/account/push-optin";
import { MyHealthScoreCard } from "@/components/account/my-health-score";
import { claimQuizForCurrentUser } from "@/lib/actions/quiz";
import { getMyHealthScore } from "@/lib/queries/quiz";
import { env, isConfigured } from "@/lib/env";
import { isPlaceholderEmail } from "@/lib/phone-account";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage() {
  const sessionUser = await getCurrentUser();
  const user = await prisma.user.findUnique({
    where: { id: sessionUser!.id },
    select: {
      name: true,
      email: true,
      emailVerified: true,
      image: true,
      phone: true,
      phoneVerified: true,
      gender: true,
      dob: true,
      passwordHash: true,
      createdAt: true,
    },
  });

  if (!user) return null;

  // Attach any pending anonymous quiz result (taken before signup) + grant the
  // welcome coupon; idempotent. Then load the report for the dashboard card.
  await claimQuizForCurrentUser();
  const healthScore = await getMyHealthScore(sessionUser!.id);

  const displayName =
    user.name ?? (isPlaceholderEmail(user.email) ? "Nutriyet member" : user.email);

  return (
    <div className="max-w-xl space-y-5">
      {/* Identity header — photo, name, member-since. */}
      <div className="flex items-center gap-4 rounded-2xl border bg-card p-4 shadow-elev-1 sm:p-5">
        <AvatarUpload
          image={user.image}
          name={user.name}
          cloudinaryReady={isConfigured.cloudinary()}
        />
        <div className="min-w-0">
          <p className="truncate font-heading text-lg font-semibold">{displayName}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Member since {formatDate(user.createdAt)}
          </p>
        </div>
      </div>

      {healthScore && <MyHealthScoreCard data={healthScore} />}

      <div className="rounded-2xl border bg-card p-4 shadow-elev-1 sm:p-5">
        <h2 className="mb-4 font-heading text-lg font-semibold">Personal details</h2>
        <ProfileForm
          defaultName={user.name ?? ""}
          defaultGender={user.gender}
          defaultDob={user.dob ? user.dob.toISOString().slice(0, 10) : null}
        />
      </div>

      <div className="rounded-2xl border bg-card p-4 shadow-elev-1 sm:p-5">
        <h2 className="mb-4 font-heading text-lg font-semibold">Contact &amp; security</h2>
        <div className="space-y-5 divide-y [&>div]:pb-5 [&>div:last-child]:pb-0">
          <EmailSection email={user.email} verified={Boolean(user.emailVerified)} />
          <PhoneSection phone={user.phone} verified={Boolean(user.phoneVerified)} />
          <PasswordSection hasPassword={Boolean(user.passwordHash)} />
        </div>
      </div>

      <PushOptIn vapidPublicKey={env.vapidPublicKey} />
    </div>
  );
}
