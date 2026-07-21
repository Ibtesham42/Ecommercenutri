import Link from "next/link";
import { FolderX } from "lucide-react";

export default function JnvNotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <span className="grid size-16 place-items-center rounded-2xl bg-slate-100 text-slate-500 dark:bg-slate-800">
        <FolderX className="size-8" />
      </span>
      <h1 className="mt-4 text-xl font-bold">Not found</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        This class, folder or resource doesn&apos;t exist or may have been removed.
      </p>
      <Link
        href="/jnv"
        className="mt-6 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        Back to classes
      </Link>
    </div>
  );
}
