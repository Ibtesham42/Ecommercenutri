import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/page-header";
import { guardSection } from "@/lib/admin-guard";
import {
  AISettingsForm,
  type AISettingsValues,
} from "@/components/admin/ai-settings-form";
import { prisma } from "@/lib/prisma";
import { isConfigured, env } from "@/lib/env";

export const metadata: Metadata = { title: "AI Settings", robots: { index: false } };

const numberFmt = new Intl.NumberFormat("en-IN");

export default async function AISettingsPage() {
  await guardSection("ai");
  const setting = await prisma.aISetting.findUnique({ where: { id: "singleton" } });

  const initial: AISettingsValues = {
    model: setting?.model ?? env.groqModel,
    isEnabled: setting?.isEnabled ?? true,
    assistantEnabled: setting?.assistantEnabled ?? true,
    searchEnabled: setting?.searchEnabled ?? true,
    productAssistantEnabled: setting?.productAssistantEnabled ?? true,
    systemPrompt: setting?.systemPrompt ?? "",
    temperature: setting?.temperature ?? 0.7,
    maxTokens: setting?.maxTokens ?? 1024,
  };

  const stats = [
    { label: "Total AI requests", value: numberFmt.format(setting?.totalRequests ?? 0) },
    { label: "Total tokens used", value: numberFmt.format(setting?.totalTokens ?? 0) },
    {
      label: "Provider",
      value: isConfigured.groq() ? "Groq (live)" : "Not configured",
    },
  ];

  return (
    <div>
      <PageHeader
        title="AI Settings"
        description="Control the Groq-powered AI features. The API key lives only in the environment."
      />

      <div className="mb-6 grid max-w-2xl gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border bg-background p-4">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className="mt-1 text-xl font-bold tracking-tight">{s.value}</p>
          </div>
        ))}
      </div>

      <AISettingsForm initial={initial} groqReady={isConfigured.groq()} />
    </div>
  );
}
