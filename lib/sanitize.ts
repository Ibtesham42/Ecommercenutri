import sanitizeHtml from "sanitize-html";

/**
 * Sanitize admin/CMS-authored HTML before rendering it on the storefront
 * (blog articles, custom legal pages). Uses sanitize-html (htmlparser2-based,
 * no DOM/jsdom) so it runs safely during SSR and the production build.
 *
 * Allows common rich-text tags plus images; strips scripts, event handlers and
 * unsafe URL schemes.
 */
export function sanitizeRichText(dirty: string): string {
  return sanitizeHtml(dirty, {
    allowedTags: [
      "h2", "h3", "h4", "p", "blockquote", "ul", "ol", "li",
      "a", "strong", "em", "b", "i", "u", "s", "br", "hr",
      "img", "figure", "figcaption", "span", "code", "pre",
    ],
    allowedAttributes: {
      a: ["href", "title", "target", "rel"],
      img: ["src", "alt", "title", "width", "height", "loading"],
      span: ["class"],
    },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    transformTags: {
      // Force external-safe rel on links that open a new tab.
      a: (tagName, attribs) => ({
        tagName,
        attribs: {
          ...attribs,
          ...(attribs.target === "_blank"
            ? { rel: "noopener noreferrer" }
            : {}),
        },
      }),
    },
  });
}
