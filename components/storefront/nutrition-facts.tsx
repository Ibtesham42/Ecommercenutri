export function NutritionFacts({
  facts,
}: {
  facts: { label: string; value: string }[];
}) {
  if (!facts?.length) return null;
  return (
    <div className="overflow-hidden rounded-xl border">
      <div className="border-b bg-muted/40 px-4 py-2.5 text-sm font-semibold">
        Nutrition (per 100g)
      </div>
      <dl className="divide-y">
        {facts.map((f) => (
          <div
            key={f.label}
            className="flex items-center justify-between px-4 py-2.5 text-sm"
          >
            <dt className="text-muted-foreground">{f.label}</dt>
            <dd className="font-medium">{f.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
