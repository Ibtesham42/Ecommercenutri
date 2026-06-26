import { Card, CardContent } from "@/components/ui/card";
import { valuePropIcon } from "@/components/storefront/home/value-prop-icons";
import type { WhyChooseUsContent } from "@/lib/validations/admin";

export function HomeWhyChooseUs({ content }: { content: WhyChooseUsContent }) {
  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-14">
      <div className="mb-10 text-center">
        <h2 className="text-2xl font-bold sm:text-3xl">{content.title}</h2>
        {content.subtitle && (
          <p className="mx-auto mt-2 max-w-xl text-muted-foreground">{content.subtitle}</p>
        )}
      </div>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {content.items.map((vp, i) => {
          const Icon = valuePropIcon(vp.icon);
          return (
            <Card key={i} className="h-full">
              <CardContent className="space-y-3 p-6">
                <span className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="size-6" />
                </span>
                <h3 className="font-semibold">{vp.title}</h3>
                <p className="text-sm text-muted-foreground">{vp.desc}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
