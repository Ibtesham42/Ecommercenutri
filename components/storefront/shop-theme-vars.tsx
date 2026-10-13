/** Admin-chosen theme colours (Appearance settings) override the brand palette
 *  on every shop-scoped surface — storefront, account and auth. */
export function ShopThemeVars({
  settings,
}: {
  settings: { primaryColor?: string | null; secondaryColor?: string | null };
}) {
  const themeVars = [
    settings.primaryColor && `--primary:${settings.primaryColor};--ring:${settings.primaryColor};`,
    settings.secondaryColor && `--secondary:${settings.secondaryColor};`,
  ]
    .filter(Boolean)
    .join("");
  if (!themeVars) return null;
  return (
    // Also target the scope, or its own --primary would beat the admin's choice.
    <style
      dangerouslySetInnerHTML={{
        __html: `:root,.dark,[data-surface="shop"],.dark[data-surface="shop"],.dark [data-surface="shop"]{${themeVars}}`,
      }}
    />
  );
}
