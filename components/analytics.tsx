import Script from "next/script";
import { env, isConfigured } from "@/lib/env";

/**
 * Privacy-friendly, dependency-free analytics. Injects a Plausible/Umami-style
 * script only when `NEXT_PUBLIC_ANALYTICS_SRC` + `NEXT_PUBLIC_ANALYTICS_DOMAIN`
 * are configured; renders nothing otherwise. Swap the env values to point at any
 * lightweight analytics host — no code changes needed.
 */
export function Analytics() {
  if (!isConfigured.analytics()) return null;
  return (
    <Script
      src={env.analyticsSrc}
      data-domain={env.analyticsDomain}
      strategy="afterInteractive"
      defer
    />
  );
}
