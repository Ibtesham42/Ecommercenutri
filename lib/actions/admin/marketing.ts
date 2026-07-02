"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
import { dispatchCampaign } from "@/lib/marketing/deliver";
import { countAudience, type SegmentConfig } from "@/lib/marketing/audience";
import { generateCampaignContent } from "@/lib/marketing/ai";
import {
  runAutomations,
  testAutomationRule,
  type AutomationRunReport,
  type ChannelOutcome,
} from "@/lib/marketing/automation";
import {
  campaignSchema,
  segmentSchema,
  templateSchema,
  aiGenerateSchema,
  audiencePreviewSchema,
  automationRuleSchema,
} from "@/lib/validations/marketing";
import type { AdminResult, BulkOutcome } from "@/lib/actions/admin/types";
import type { GeneratedContent } from "@/lib/marketing/ai";

function revalidate(id?: string) {
  revalidatePath("/admin/marketing");
  revalidatePath("/admin/marketing/campaigns");
  if (id) revalidatePath(`/admin/marketing/compose/${id}`);
}

function cleanConfig(config?: SegmentConfig): Prisma.InputJsonValue {
  return {
    productId: config?.productId || null,
    categoryId: config?.categoryId || null,
    userIds: config?.userIds ?? [],
    inactiveDays: config?.inactiveDays ?? null,
  };
}

/** Create or update a campaign draft. Returns the id so the editor can continue. */
export async function saveCampaign(input: unknown): Promise<AdminResult<{ id: string }>> {
  await requirePermission("marketing");
  const parsed = campaignSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid campaign." };
  const d = parsed.data;

  const data = {
    name: d.name,
    type: d.type,
    channels: d.channels,
    title: d.title,
    body: d.body,
    imageUrl: d.imageUrl || null,
    ctaText: d.ctaText || null,
    ctaUrl: d.ctaUrl || null,
    segmentType: d.segmentType,
    segmentConfig: cleanConfig(d.segmentConfig),
    productId: d.productId || null,
    couponId: d.couponId || null,
    recurrence: d.recurrence === "NONE" ? null : d.recurrence,
  };

  let id = d.id;
  if (id) {
    const existing = await prisma.campaign.findUnique({ where: { id }, select: { status: true } });
    if (!existing) return { ok: false, error: "Campaign not found." };
    if (existing.status === "SENT" || existing.status === "SENDING") {
      return { ok: false, error: "A sent campaign can't be edited — duplicate it instead." };
    }
    await prisma.campaign.update({ where: { id }, data });
  } else {
    const created = await prisma.campaign.create({ data });
    id = created.id;
  }
  revalidate(id);
  return { ok: true, data: { id } };
}

/** Send a campaign immediately. */
export async function sendCampaign(id: string): Promise<AdminResult<{ sent: number }>> {
  await requirePermission("marketing");
  const res = await dispatchCampaign(id);
  revalidate(id);
  if (!res.ok) return { ok: false, error: res.error ?? "Send failed." };
  return { ok: true, data: { sent: res.sent } };
}

/** Schedule a campaign for a future time (processed by the cron dispatch route). */
export async function scheduleCampaign(id: string, scheduledFor: string): Promise<AdminResult> {
  await requirePermission("marketing");
  const when = new Date(scheduledFor);
  if (Number.isNaN(when.getTime())) return { ok: false, error: "Invalid date." };
  if (when.getTime() < Date.now()) return { ok: false, error: "Pick a future time." };
  const c = await prisma.campaign.findUnique({ where: { id }, select: { status: true } });
  if (!c) return { ok: false, error: "Campaign not found." };
  if (c.status === "SENT" || c.status === "SENDING") return { ok: false, error: "Already sent." };
  await prisma.campaign.update({
    where: { id },
    data: { status: "SCHEDULED", scheduledFor: when },
  });
  revalidate(id);
  return { ok: true };
}

/** Cancel a scheduled or draft campaign. */
export async function cancelCampaign(id: string): Promise<AdminResult> {
  await requirePermission("marketing");
  const c = await prisma.campaign.findUnique({ where: { id }, select: { status: true } });
  if (!c) return { ok: false, error: "Campaign not found." };
  if (c.status === "SENT" || c.status === "SENDING") return { ok: false, error: "Already sent." };
  await prisma.campaign.update({ where: { id }, data: { status: "CANCELLED", scheduledFor: null } });
  revalidate(id);
  return { ok: true };
}

/** Duplicate a campaign as a fresh draft. */
export async function duplicateCampaign(id: string): Promise<AdminResult<{ id: string }>> {
  await requirePermission("marketing");
  const c = await prisma.campaign.findUnique({ where: { id } });
  if (!c) return { ok: false, error: "Campaign not found." };
  const created = await prisma.campaign.create({
    data: {
      name: `${c.name} (copy)`,
      type: c.type,
      status: "DRAFT",
      channels: c.channels,
      title: c.title,
      body: c.body,
      imageUrl: c.imageUrl,
      ctaText: c.ctaText,
      ctaUrl: c.ctaUrl,
      segmentType: c.segmentType,
      segmentConfig: (c.segmentConfig as Prisma.InputJsonValue) ?? Prisma.JsonNull,
      productId: c.productId,
      couponId: c.couponId,
      recurrence: c.recurrence,
    },
  });
  revalidate();
  return { ok: true, data: { id: created.id } };
}

export async function deleteCampaign(id: string): Promise<AdminResult> {
  await requirePermission("marketing");
  await prisma.campaign.delete({ where: { id } });
  revalidate();
  return { ok: true };
}

/** Resend a sent campaign: duplicate it to a fresh draft and dispatch the copy now. */
export async function resendCampaign(id: string): Promise<AdminResult<{ sent: number }>> {
  await requirePermission("marketing");
  const copy = await duplicateCampaign(id);
  if (!copy.ok) return copy;
  const res = await dispatchCampaign(copy.data!.id);
  revalidate();
  if (!res.ok) return { ok: false, error: res.error ?? "Resend failed." };
  return { ok: true, data: { sent: res.sent } };
}

const CAMPAIGN_BULK_ACTIONS = ["delete", "cancel"] as const;
type CampaignBulkAction = (typeof CAMPAIGN_BULK_ACTIONS)[number];

export async function bulkCampaignAction(
  ids: string[],
  action: CampaignBulkAction,
): Promise<AdminResult<BulkOutcome>> {
  await requirePermission("marketing");
  if (!Array.isArray(ids) || ids.length === 0) return { ok: false, error: "Nothing selected." };
  if (!CAMPAIGN_BULK_ACTIONS.includes(action)) return { ok: false, error: "Unknown action." };
  try {
    let done = 0;
    if (action === "delete") {
      done = (await prisma.campaign.deleteMany({ where: { id: { in: ids } } })).count;
    } else {
      done = (
        await prisma.campaign.updateMany({
          where: { id: { in: ids }, status: { in: ["DRAFT", "SCHEDULED"] } },
          data: { status: "CANCELLED", scheduledFor: null },
        })
      ).count;
    }
    revalidate();
    return { ok: true, data: { done, skipped: ids.length - done } };
  } catch (err) {
    console.error("[admin] bulkCampaignAction failed:", err);
    return { ok: false, error: "Bulk action failed." };
  }
}

/** AI-assisted content generation for the compose editor. */
export async function generateContent(
  input: unknown,
): Promise<AdminResult<GeneratedContent>> {
  await requirePermission("marketing");
  const parsed = aiGenerateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request." };
  const res = await generateCampaignContent(parsed.data);
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true, data: res.data };
}

/** Live audience size for the compose preview. */
export async function previewAudience(input: unknown): Promise<AdminResult<{ count: number }>> {
  await requirePermission("marketing");
  const parsed = audiencePreviewSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid segment." };
  const count = await countAudience(parsed.data.type, parsed.data.config ?? {});
  return { ok: true, data: { count } };
}

// --- Saved audience segments --------------------------------------------------

export async function saveSegment(input: unknown): Promise<AdminResult> {
  await requirePermission("marketing");
  const parsed = segmentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid segment." };
  const d = parsed.data;
  const count = await countAudience(d.type, d.config ?? {});
  const data = { name: d.name, type: d.type, config: cleanConfig(d.config), cachedCount: count };
  try {
    if (d.id) await prisma.audienceSegment.update({ where: { id: d.id }, data });
    else await prisma.audienceSegment.create({ data });
  } catch {
    return { ok: false, error: "A segment with that name already exists." };
  }
  revalidatePath("/admin/marketing/segments");
  return { ok: true };
}

export async function deleteSegment(id: string): Promise<AdminResult> {
  await requirePermission("marketing");
  await prisma.audienceSegment.delete({ where: { id } });
  revalidatePath("/admin/marketing/segments");
  return { ok: true };
}

// --- Templates ----------------------------------------------------------------

export async function saveTemplate(input: unknown): Promise<AdminResult> {
  await requirePermission("marketing");
  const parsed = templateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid template." };
  const d = parsed.data;
  const data = {
    name: d.name,
    category: d.category,
    channels: d.channels,
    title: d.title,
    body: d.body,
    ctaText: d.ctaText || null,
    imageUrl: d.imageUrl || null,
  };
  try {
    if (d.id) await prisma.campaignTemplate.update({ where: { id: d.id }, data });
    else await prisma.campaignTemplate.create({ data });
  } catch {
    return { ok: false, error: "A template with that name already exists." };
  }
  revalidatePath("/admin/marketing/templates");
  return { ok: true };
}

export async function deleteTemplate(id: string): Promise<AdminResult> {
  await requirePermission("marketing");
  await prisma.campaignTemplate.delete({ where: { id } });
  revalidatePath("/admin/marketing/templates");
  return { ok: true };
}

// --- Automation rules ---------------------------------------------------------

export async function saveAutomationRule(input: unknown): Promise<AdminResult> {
  await requirePermission("marketing");
  const parsed = automationRuleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid rule." };
  const d = parsed.data;
  const data = {
    name: d.name,
    trigger: d.trigger,
    enabled: d.enabled,
    delayHours: d.delayHours,
    channels: d.channels,
    title: d.title,
    body: d.body,
    imageUrl: d.imageUrl || null,
    ctaText: d.ctaText || null,
    ctaUrl: d.ctaUrl || null,
    couponId: d.couponId || null,
  };
  if (d.id) await prisma.automationRule.update({ where: { id: d.id }, data });
  else await prisma.automationRule.create({ data });
  revalidatePath("/admin/marketing/automations");
  return { ok: true };
}

export async function toggleAutomationRule(id: string, enabled: boolean): Promise<AdminResult> {
  await requirePermission("marketing");
  await prisma.automationRule.update({ where: { id }, data: { enabled } });
  revalidatePath("/admin/marketing/automations");
  return { ok: true };
}

export async function deleteAutomationRule(id: string): Promise<AdminResult> {
  await requirePermission("marketing");
  await prisma.automationRule.delete({ where: { id } });
  revalidatePath("/admin/marketing/automations");
  return { ok: true };
}

/** Run all enabled automations now (manual trigger; cron does this on schedule).
 *  Returns the full per-rule report so the UI can show exactly what happened. */
export async function runAutomationsNow(): Promise<AdminResult<AutomationRunReport>> {
  await requirePermission("marketing");
  try {
    const report = await runAutomations();
    revalidatePath("/admin/marketing/automations");
    return { ok: true, data: report };
  } catch (err) {
    console.error("[marketing] run-now failed:", err);
    return { ok: false, error: err instanceof Error ? err.message : "Automation run failed." };
  }
}

/** Send an automation's message to the signed-in admin as a real test delivery. */
export async function sendAutomationTest(
  ruleId: string,
): Promise<AdminResult<{ outcomes: ChannelOutcome[] }>> {
  const admin = await requirePermission("marketing");
  try {
    const res = await testAutomationRule(ruleId, {
      id: admin.id,
      email: admin.email,
      name: admin.name,
    });
    if ("error" in res) return { ok: false, error: res.error };
    revalidatePath("/admin/marketing/automations");
    return { ok: true, data: res };
  } catch (err) {
    console.error("[marketing] automation test failed:", err);
    return { ok: false, error: err instanceof Error ? err.message : "Test send failed." };
  }
}
