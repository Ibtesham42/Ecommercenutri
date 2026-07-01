import Script from "next/script";
import { getSeoSettings } from "@/lib/seo-settings";

/** IDs are admin-authored, but still defensively strip anything unsafe before we
 *  interpolate them into an inline script. */
const safeId = (v: string) => v.replace(/[^A-Za-z0-9\-_]/g, "").slice(0, 40);

/**
 * Admin-managed analytics tags — Google Analytics 4, Google Tag Manager and the
 * Meta (Facebook) Pixel. Each renders only when its ID is set in the SEO manager,
 * so the app runs with none configured. This is additive to the existing
 * privacy-analytics `<Analytics />` (Plausible/Umami via env).
 */
export async function SeoScripts() {
  const seo = await getSeoSettings();
  const gtm = safeId(seo.gtmId);
  const ga = safeId(seo.gaId);
  const pixel = safeId(seo.metaPixelId);

  return (
    <>
      {gtm && (
        <Script id="gtm-init" strategy="afterInteractive">
          {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${gtm}');`}
        </Script>
      )}
      {ga && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${ga}`} strategy="afterInteractive" />
          <Script id="ga4-init" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${ga}');`}
          </Script>
        </>
      )}
      {pixel && (
        <Script id="meta-pixel" strategy="afterInteractive">
          {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${pixel}');fbq('track','PageView');`}
        </Script>
      )}
    </>
  );
}

/** GTM <noscript> iframe — must sit immediately after <body> opens. */
export async function SeoNoscript() {
  const seo = await getSeoSettings();
  const gtm = safeId(seo.gtmId);
  if (!gtm) return null;
  return (
    <noscript>
      <iframe
        src={`https://www.googletagmanager.com/ns.html?id=${gtm}`}
        height="0"
        width="0"
        style={{ display: "none", visibility: "hidden" }}
        title="gtm"
      />
    </noscript>
  );
}
