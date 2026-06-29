import "server-only";
import type { CampaignChannel } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type BuiltIn = {
  name: string;
  category: string;
  channels: CampaignChannel[];
  title: string;
  body: string;
  ctaText: string;
};

/** Ready-to-use starting points for common campaign types. */
export const BUILT_IN_TEMPLATES: BuiltIn[] = [
  {
    name: "Flash sale",
    category: "PROMO",
    channels: ["IN_APP", "EMAIL"],
    title: "⚡ Flash sale — today only!",
    body: "For the next 24 hours, stock up on your favourite healthy snacks at special prices.\n\nDon't miss out — once they're gone, they're gone.",
    ctaText: "Shop the sale",
  },
  {
    name: "New product launch",
    category: "PRODUCT_LAUNCH",
    channels: ["IN_APP", "EMAIL"],
    title: "Just dropped: something new 🌿",
    body: "We've added a new product we think you'll love. Clean ingredients, big on nutrition.\n\nBe one of the first to try it.",
    ctaText: "Check it out",
  },
  {
    name: "Welcome new customer",
    category: "WELCOME",
    channels: ["IN_APP", "EMAIL"],
    title: "Welcome to Nutriyet 👋",
    body: "Thanks for joining us! We're on a mission to make healthy eating easy and delicious.\n\nExplore our best sellers to get started.",
    ctaText: "Start shopping",
  },
  {
    name: "We miss you",
    category: "WINBACK",
    channels: ["IN_APP", "EMAIL"],
    title: "We miss you! Here's a little something 💚",
    body: "It's been a while. Come back and refresh your pantry with clean, healthy nutrition.\n\nYour favourites are waiting.",
    ctaText: "Come back",
  },
  {
    name: "Coupon offer",
    category: "COUPON",
    channels: ["IN_APP", "EMAIL"],
    title: "A special discount, just for you 🎟️",
    body: "Use your exclusive coupon at checkout and save on your next order of healthy goodness.",
    ctaText: "Claim offer",
  },
  {
    name: "Monthly newsletter",
    category: "NEWSLETTER",
    channels: ["IN_APP", "EMAIL"],
    title: "Your Nutriyet update 🌱",
    body: "Here's what's new this month — fresh arrivals, nutrition tips and customer favourites.\n\nThanks for being part of the Nutriyet family.",
    ctaText: "Read more",
  },
];

/** Idempotently upsert the built-in templates (by unique name). Safe to call on read. */
export async function ensureBuiltInTemplates(): Promise<void> {
  try {
    for (const t of BUILT_IN_TEMPLATES) {
      await prisma.campaignTemplate.upsert({
        where: { name: t.name },
        update: {}, // don't clobber admin edits
        create: { ...t, isBuiltIn: true },
      });
    }
  } catch (err) {
    console.error("[marketing] template seed failed:", err);
  }
}
