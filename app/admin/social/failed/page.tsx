import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/page-header";
import { getSocialPosts } from "@/lib/queries/social";
import { PostTable } from "@/components/admin/social/post-table";

export const metadata: Metadata = { title: "Failed", robots: { index: false } };

export default async function SocialFailedPage() {
  const posts = await getSocialPosts(["FAILED"]);
  return (
    <div>
      <PageHeader title="Failed" description="Posts that couldn't publish. Fix and retry." />
      <PostTable
        posts={posts}
        context="failed"
        emptyHint="Nothing has failed — nice."
      />
    </div>
  );
}
