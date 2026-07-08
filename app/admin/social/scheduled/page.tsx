import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/page-header";
import { getSocialPosts } from "@/lib/queries/social";
import { PostTable } from "@/components/admin/social/post-table";

export const metadata: Metadata = { title: "Scheduled", robots: { index: false } };

export default async function SocialScheduledPage() {
  const posts = await getSocialPosts(["SCHEDULED", "PUBLISHING"]);
  return (
    <div>
      <PageHeader title="Scheduled" description="Posts queued to publish at their scheduled time." />
      <PostTable
        posts={posts}
        context="scheduled"
        emptyHint="Approve drafts or set a campaign to auto-publish to fill this list."
      />
    </div>
  );
}
