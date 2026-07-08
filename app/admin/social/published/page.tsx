import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/page-header";
import { getSocialPosts } from "@/lib/queries/social";
import { PostTable } from "@/components/admin/social/post-table";

export const metadata: Metadata = { title: "Published", robots: { index: false } };

export default async function SocialPublishedPage() {
  const posts = await getSocialPosts(["PUBLISHED"]);
  return (
    <div>
      <PageHeader title="Published" description="Posts that have gone live." />
      <PostTable posts={posts} context="published" emptyHint="Published posts will appear here." />
    </div>
  );
}
