import { guardSection } from "@/lib/admin-guard";
import { JnvTabs } from "@/components/admin/jnv/jnv-tabs";

export default async function JnvAdminLayout({ children }: { children: React.ReactNode }) {
  await guardSection("jnv");
  return (
    <div>
      <div className="mb-1">
        <h1 className="text-2xl font-semibold tracking-tight">JNV Smart Class</h1>
        <p className="text-sm text-muted-foreground">
          Manage class folders, teaching resources and announcements for the JNV Smart
          Class student portal — a separate, unlisted module at{" "}
          <code className="rounded bg-accent px-1 py-0.5 text-xs">/jnv</code>.
        </p>
      </div>
      <JnvTabs />
      {children}
    </div>
  );
}
