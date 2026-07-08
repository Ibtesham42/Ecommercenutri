import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/page-header";
import { getSocialPosts } from "@/lib/queries/social";
import { PostTable } from "@/components/admin/social/post-table";

export const metadata: Metadata = { title: "Draft Queue", robots: { index: false } };

export default async function SocialQueuePage() {
  const posts = await getSocialPosts(["DRAFT", "PENDING_APPROVAL"]);
  return (
    <div>
      <PageHeader
        title="Draft Queue"
        description="Review, edit or approve generated drafts before they go out."
      />
      <PostTable
        posts={posts}
        context="queue"
        emptyHint="Generate a post or let a campaign fill this queue automatically."
      />
    </div>
  );
}
