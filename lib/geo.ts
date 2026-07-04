/**
 * Coarse request geolocation from the hosting platform's headers (Vercel sets
 * x-vercel-ip-city / x-vercel-ip-country-region at the edge). City-level only —
 * the IP itself is never read or stored, keeping event rows PII-free. Blank on
 * localhost / other hosts, and every consumer degrades gracefully without it.
 */

const IN_REGIONS: Record<string, string> = {
  AN: "Andaman and Nicobar", AP: "Andhra Pradesh", AR: "Arunachal Pradesh",
  AS: "Assam", BR: "Bihar", CH: "Chandigarh", CT: "Chhattisgarh", CG: "Chhattisgarh",
  DH: "Dadra and Nagar Haveli and Daman and Diu", DN: "Dadra and Nagar Haveli and Daman and Diu",
  DL: "Delhi", GA: "Goa", GJ: "Gujarat", HR: "Haryana", HP: "Himachal Pradesh",
  JH: "Jharkhand", JK: "Jammu and Kashmir", KA: "Karnataka", KL: "Kerala",
  LA: "Ladakh", LD: "Lakshadweep", MP: "Madhya Pradesh", MH: "Maharashtra",
  MN: "Manipur", ML: "Meghalaya", MZ: "Mizoram", NL: "Nagaland", OR: "Odisha",
  OD: "Odisha", PB: "Punjab", PY: "Puducherry", RJ: "Rajasthan", SK: "Sikkim",
  TN: "Tamil Nadu", TG: "Telangana", TS: "Telangana", TR: "Tripura",
  UP: "Uttar Pradesh", UT: "Uttarakhand", UK: "Uttarakhand", WB: "West Bengal",
};

function titleCase(s: string): string {
  return s.trim().toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

/** { city, region } from platform geo headers — both null when unavailable. */
export function requestGeo(headers: Headers): { city: string | null; region: string | null } {
  let city: string | null = null;
  let region: string | null = null;
  const rawCity = headers.get("x-vercel-ip-city");
  if (rawCity) {
    try {
      city = titleCase(decodeURIComponent(rawCity)).slice(0, 60) || null;
    } catch {
      city = titleCase(rawCity).slice(0, 60) || null;
    }
  }
  const rawRegion = headers.get("x-vercel-ip-country-region");
  if (rawRegion) {
    const code = rawRegion.toUpperCase().replace(/^IN-/, "");
    region = (IN_REGIONS[code] ?? titleCase(rawRegion)).slice(0, 60) || null;
  }
  return { city, region };
}
