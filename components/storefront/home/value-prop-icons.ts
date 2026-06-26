import {
  Leaf,
  ShieldCheck,
  Truck,
  HeartPulse,
  Sparkles,
  Star,
  Award,
  Heart,
  PackageCheck,
  Recycle,
  type LucideIcon,
} from "lucide-react";

/** Selectable icons for "Why choose us" value props (see VALUE_PROP_ICON_NAMES). */
export const VALUE_PROP_ICONS: Record<string, LucideIcon> = {
  Leaf,
  ShieldCheck,
  Truck,
  HeartPulse,
  Sparkles,
  Star,
  Award,
  Heart,
  PackageCheck,
  Recycle,
};

export function valuePropIcon(name: string): LucideIcon {
  return VALUE_PROP_ICONS[name] ?? Leaf;
}
