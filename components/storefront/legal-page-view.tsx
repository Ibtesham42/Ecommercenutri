import { sanitizeRichText } from "@/lib/sanitize";
import { formatDate } from "@/lib/format";
import { PageBreadcrumb } from "@/components/storefront/page-breadcrumb";
import type { LegalPage } from "@/lib/queries/content";

/**
 * Renders a legal/policy page from either the built-in default sections or an
 * admin-edited HTML body (sanitized). Shared by /privacy, /terms and /shipping.
 */
export function LegalPageView({ page }: { page: LegalPage }) {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12">
      <PageBreadcrumb items={[{ name: "Home", href: "/" }, { name: page.title }]} />

      <header className="mt-6 border-b pb-6">
        <h1 className="text-3xl font-bold sm:text-4xl">{page.title}</h1>
        {page.mode === "default" && (
          <p className="mt-3 text-lg text-muted-foreground">{page.content.intro}</p>
        )}
        {page.updatedAt && (
          <p className="mt-3 text-xs text-muted-foreground">
            Last updated {formatDate(page.updatedAt)}
          </p>
        )}
      </header>

      {page.mode === "custom" ? (
        <article
          className="rich-content mt-8"
          dangerouslySetInnerHTML={{ __html: sanitizeRichText(page.html) }}
        />
      ) : (
        <div className="mt-8 space-y-8">
          {page.content.sections.map((section) => (
            <section key={section.heading}>
              <h2 className="text-xl font-semibold">{section.heading}</h2>
              <div className="mt-2 space-y-3">
                {section.body.map((para, i) => (
                  <p key={i} className="text-muted-foreground">
                    {para}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
