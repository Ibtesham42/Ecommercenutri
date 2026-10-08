import { sanitizeRichText } from "@/lib/sanitize";
import { formatDate, slugify } from "@/lib/format";
import { buildToc, type TocHeading } from "@/lib/toc";
import { CONTENT_PAGE_CLASS, PageHeader, ReadingLayout } from "@/components/storefront/page-header";
import { TableOfContents } from "@/components/storefront/table-of-contents";
import type { LegalPage } from "@/lib/queries/content";

/**
 * Renders a legal/policy page from either the built-in default sections or an
 * admin-edited HTML body (sanitized). Shared by /privacy, /terms, /shipping,
 * /returns-refunds, /cookie-policy and /disclaimer. Sections get anchors so the
 * page carries an "On this page" list (side rail from lg, inline card below).
 */
export function LegalPageView({
  page,
  notice,
}: {
  page: LegalPage;
  /** Optional callout above the body (e.g. the live return window). */
  notice?: React.ReactNode;
}) {
  let headings: TocHeading[];
  let body: React.ReactNode;

  if (page.mode === "custom") {
    const toc = buildToc(sanitizeRichText(page.html));
    headings = toc.headings;
    body = <article className="rich-content" dangerouslySetInnerHTML={{ __html: toc.html }} />;
  } else {
    const used = new Set<string>();
    const sections = page.content.sections.map((section) => {
      const base = slugify(section.heading) || "section";
      let id = base;
      for (let n = 2; used.has(id); n++) id = `${base}-${n}`;
      used.add(id);
      return { ...section, id };
    });
    headings = sections.map((s) => ({ id: s.id, text: s.heading, level: 2 as const }));
    body = (
      <div className="space-y-10">
        {sections.map((section) => (
          <section key={section.id} aria-labelledby={section.id}>
            <h2 id={section.id} className="scroll-mt-28 font-heading text-subheading font-medium">
              {section.heading}
            </h2>
            <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-foreground/80">
              {section.body.map((para, i) => (
                <p key={i}>{para}</p>
              ))}
            </div>
          </section>
        ))}
      </div>
    );
  }

  const showToc = headings.length >= 3;

  return (
    <div className={CONTENT_PAGE_CLASS}>
      <PageHeader
        crumbs={[{ name: "Home", href: "/" }, { name: page.title }]}
        eyebrow="Policies"
        title={page.title}
        lede={page.mode === "default" ? page.content.intro : undefined}
      >
        {page.updatedAt && (
          <p className="mt-4 text-xs text-muted-foreground">Last updated {formatDate(page.updatedAt)}</p>
        )}
      </PageHeader>

      <ReadingLayout rail={showToc ? <TableOfContents headings={headings} variant="rail" /> : undefined}>
        {notice && <div className="mb-8">{notice}</div>}
        {showToc && <TableOfContents headings={headings} className="mb-10 lg:hidden" />}
        {body}
      </ReadingLayout>
    </div>
  );
}
