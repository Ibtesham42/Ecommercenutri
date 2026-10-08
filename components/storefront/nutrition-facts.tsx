export function NutritionFacts({
  facts,
}: {
  facts: { label: string; value: string }[];
}) {
  if (!facts?.length) return null;
  return (
    <div>
      <h3 className="flex items-baseline justify-between border-b-2 border-foreground pb-2 font-heading text-lg font-medium">
        Nutrition <span className="font-sans text-xs font-normal text-muted-foreground">per 100g</span>
      </h3>
      <dl className="divide-y divide-border">
        {facts.map((f) => (
          <div key={f.label} className="flex items-center justify-between gap-4 py-2.5 text-sm">
            <dt className="text-muted-foreground">{f.label}</dt>
            <dd className="font-medium tabular-nums">{f.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
