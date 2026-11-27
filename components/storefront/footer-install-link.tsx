"use client";

import { useInstallApp, type InstallCopy } from "@/components/storefront/install-app";

/** Footer "Install the app" link — same user-initiated flow as the menu drawer.
 *  Hidden inside the installed app. */
export function FooterInstallLink({ copy, className }: { copy: InstallCopy; className?: string }) {
  const install = useInstallApp(copy);
  if (install.state.standalone) return null;
  return (
    <>
      <button type="button" onClick={() => void install.start()} className={className}>
        Install the app
      </button>
      {install.dialog}
    </>
  );
}
