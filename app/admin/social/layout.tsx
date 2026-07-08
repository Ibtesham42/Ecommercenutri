import { guardSection } from "@/lib/admin-guard";
import { SocialTabs } from "@/components/admin/social/social-tabs";

export default async function SocialLayout({ children }: { children: React.ReactNode }) {
  await guardSection("social");
  return (
    <div>
      <SocialTabs />
      {children}
    </div>
  );
}
