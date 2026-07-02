import type { AutomationLogStatus, AutomationTrigger, CampaignChannel } from "@prisma/client";

/**
 * Client-safe automation result types (type-only Prisma imports — same pattern as
 * `channels.ts`). The engine (`automation.ts`, server-only) and the admin UI both
 * import from here.
 */

/** Outcome of one channel attempt for one recipient. */
export type ChannelOutcome = {
  channel: CampaignChannel;
  status: "SENT" | "FAILED" | "SKIPPED" | "STUBBED";
  reason?: string;
};

/** Per-rule result of a run — everything the admin needs to see why. */
export type RuleRunReport = {
  ruleId: string;
  name: string;
  trigger: AutomationTrigger;
  candidates: number; // currently eligible recipients
  alreadySent: number; // deduped (messaged on a previous run)
  attempted: number; // fresh recipients processed this run
  sent: number; // recipients that got ≥1 channel delivered
  failed: number; // recipients where no channel delivered
  notes: string[]; // human-readable reasons/warnings
  error?: string; // rule-level exception
};

export type AutomationRunReport = { delivered: number; rules: RuleRunReport[] };

/** One Automation History row (from `getAutomationLogs`). */
export type AutomationLogRow = {
  id: string;
  ruleName: string;
  trigger: AutomationTrigger;
  recipientName: string | null;
  recipientEmail: string | null;
  status: AutomationLogStatus;
  channels: CampaignChannel[];
  error: string | null;
  createdAt: string;
};
