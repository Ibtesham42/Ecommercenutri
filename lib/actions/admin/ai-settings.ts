"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
import { aiSettingSchema } from "@/lib/validations/admin";
import type { AdminResult } from "@/lib/actions/admin/types";

const SINGLETON_ID = "singleton";

export async function updateAISettings(input: unknown): Promise<AdminResult> {
  await requirePermission("ai");

  const parsed = aiSettingSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid settings." };
  }
  const d = parsed.data;

  const data = {
    model: d.model,
    isEnabled: d.isEnabled,
    assistantEnabled: d.assistantEnabled,
    searchEnabled: d.searchEnabled,
    productAssistantEnabled: d.productAssistantEnabled,
    systemPrompt: d.systemPrompt || null,
    temperature: d.temperature,
    maxTokens: d.maxTokens,
  };

  await prisma.aISetting.upsert({
    where: { id: SINGLETON_ID },
    update: data,
    create: { id: SINGLETON_ID, ...data },
  });

  revalidatePath("/admin/ai-settings");
  return { ok: true };
}
