import { Star } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { TestimonialsContent } from "@/lib/validations/admin";

export function HomeTestimonials({ content }: { content: TestimonialsContent }) {
  return (
    <section className="border-t bg-muted/30">
      <div className="mx-auto w-full max-w-7xl px-4 py-14">
        <div className="mb-10 text-center">
          <h2 className="text-2xl font-bold sm:text-3xl">{content.title}</h2>
          {content.subtitle && <p className="mt-2 text-muted-foreground">{content.subtitle}</p>}
        </div>
        <div className="grid gap-5 sm:grid-cols-3">
          {content.items.map((t, i) => (
            <Card key={i} className="hover-lift relative h-full overflow-hidden border-transparent shadow-elev-1 hover:shadow-elev-2">
              <span className="pointer-events-none absolute -right-2 -top-4 font-heading text-7xl text-primary/10">
                &rdquo;
              </span>
              <CardContent className="space-y-3 p-6">
                <div className="flex gap-0.5">
                  {Array.from({ length: Math.max(0, Math.min(5, t.rating)) }).map((_, j) => (
                    <Star key={j} className="size-4 fill-gold text-gold" />
                  ))}
                </div>
                <p className="text-sm leading-relaxed text-muted-foreground">“{t.text}”</p>
                <p className="text-sm font-semibold">{t.name}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
