import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

export type Crumb = { name: string; href?: string };

/** Shared storefront breadcrumb. The last item renders as the current page. */
export function PageBreadcrumb({ items }: { items: Crumb[] }) {
  return (
    <Breadcrumb>
      <BreadcrumbList>
        {items.map((item, i) => {
          const isLast = i === items.length - 1;
          return (
            <span key={item.name} className="contents">
              <BreadcrumbItem>
                {isLast || !item.href ? (
                  <BreadcrumbPage className="line-clamp-1">{item.name}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink
                    href={item.href}
                    // Pads the touch target to ~44px tall without spacing the row out.
                    className="relative after:absolute after:-inset-x-1.5 after:-inset-y-3 after:content-['']"
                  >
                    {item.name}
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
              {!isLast && <BreadcrumbSeparator />}
            </span>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
