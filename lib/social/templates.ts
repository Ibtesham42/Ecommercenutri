import "server-only";
import type { SocialContentPillar } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Built-in per-pillar prompt guidance, seeded idempotently (upsert by name) —
 * same pattern as lib/marketing/templates.ts#ensureBuiltInTemplates. Admins can
 * edit these or add their own; the generator can fold a template's guidance into
 * the prompt for extra steering.
 */

const BUILT_INS: { name: string; pillar: SocialContentPillar; promptGuidance: string }[] = [
  {
    name: "Ingredient spotlight",
    pillar: "PRODUCT_KNOWLEDGE",
    promptGuidance:
      "Lead with one hero ingredient. Explain what it is and why people like it, using only the given facts. Keep it curious and factual.",
  },
  {
    name: "Smart snacking tip",
    pillar: "HEALTHY_SNACKING",
    promptGuidance:
      "Share one practical, well-known healthy-eating idea (portioning, timing, swaps). No medical claims. Tie loosely to the brand.",
  },
  {
    name: "Made for you",
    pillar: "TARGET_AUDIENCE",
    promptGuidance:
      "Speak directly to one audience (gym-goers, students, parents, travellers…). Paint a relatable moment where this snack fits.",
  },
  {
    name: "Why Nutriyet",
    pillar: "WHY_NUTRIYET",
    promptGuidance:
      "Highlight one trust signal — quality, transparency, roasting/manufacturing care. Warm and honest, no over-promising.",
  },
  {
    name: "Lifestyle moment",
    pillar: "LIFESTYLE",
    promptGuidance:
      "Set a scene (morning, office, travel, movie night, family time) where the snack shines. Sensory and light.",
  },
  {
    name: "Serving idea",
    pillar: "RECIPES",
    promptGuidance:
      "Give one simple serving or pairing idea in a couple of steps. Practical and quick.",
  },
  {
    name: "Community prompt",
    pillar: "COMMUNITY",
    promptGuidance:
      "Ask an engaging question, poll, or myth-vs-fact. Invite replies. Keep it fun and inclusive.",
  },
  {
    name: "Customer love",
    pillar: "CUSTOMER_STORIES",
    promptGuidance:
      "Frame a customer moment, review vibe, or behind-the-scenes note. Authentic and appreciative.",
  },
];

export async function ensureBuiltInSocialTemplates(): Promise<void> {
  for (const t of BUILT_INS) {
    await prisma.socialTemplate.upsert({
      where: { name: t.name },
      update: { pillar: t.pillar, promptGuidance: t.promptGuidance, isBuiltIn: true },
      create: { ...t, isBuiltIn: true },
    });
  }
}
