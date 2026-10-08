import { CatalogSkeleton } from "@/components/storefront/skeletons";

export default function Loading() {
  // Most categories carry an image (split header); image-less ones get a panel of similar height.
  return <CatalogSkeleton header="split" />;
}
