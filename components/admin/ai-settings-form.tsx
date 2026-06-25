"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { Loader2, Sparkles, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { updateAISettings } from "@/lib/actions/admin/ai-settings";

export type AISettingsValues = {
  model: string;
  isEnabled: boolean;
  assistantEnabled: boolean;
  searchEnabled: boolean;
  productAssistantEnabled: boolean;
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
};

export function AISettingsForm({
  initial,
  groqReady,
}: {
  initial: AISettingsValues;
  groqReady: boolean;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const { register, handleSubmit, control } = useForm<AISettingsValues>({
    defaultValues: initial,
  });

  async function onSubmit(values: AISettingsValues) {
    setSaving(true);
    const res = await updateAISettings({
      ...values,
      temperature: Number(values.temperature),
      maxTokens: Number(values.maxTokens),
      systemPrompt: values.systemPrompt || null,
    });
    setSaving(false);
    if (res.ok) {
      toast.success("AI settings saved");
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  const toggles = [
    ["isEnabled", "AI enabled", "Master switch for all AI features."],
    ["assistantEnabled", "Nutrition assistant", "The /assistant chat experience."],
    ["searchEnabled", "AI search", "Natural-language product search."],
    ["productAssistantEnabled", "Product assistant", "Per-product Q&A on detail pages."],
  ] as const;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-2xl space-y-6">
      {!groqReady && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <p>
            <strong>GROQ_API_KEY is not set.</strong> These settings are saved, but live
            AI responses stay disabled until a key is added to the environment.
          </p>
        </div>
      )}

      <div className="space-y-4 rounded-xl border bg-background p-5">
        <h2 className="flex items-center gap-2 font-semibold">
          <Sparkles className="size-4 text-primary" /> Features
        </h2>
        {toggles.map(([name, label, hint]) => (
          <Controller
            key={name}
            control={control}
            name={name}
            render={({ field }) => (
              <label className="flex items-center justify-between gap-4">
                <span>
                  <span className="block text-sm font-medium">{label}</span>
                  <span className="block text-xs text-muted-foreground">{hint}</span>
                </span>
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              </label>
            )}
          />
        ))}
      </div>

      <div className="space-y-4 rounded-xl border bg-background p-5">
        <h2 className="font-semibold">Model</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5 sm:col-span-3">
            <Label htmlFor="model">Model</Label>
            <Input id="model" {...register("model", { required: true })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="temperature">Temperature</Label>
            <Input
              id="temperature"
              type="number"
              step="0.1"
              min={0}
              max={2}
              {...register("temperature", { valueAsNumber: true })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="maxTokens">Max tokens</Label>
            <Input
              id="maxTokens"
              type="number"
              min={64}
              max={8192}
              {...register("maxTokens", { valueAsNumber: true })}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="systemPrompt">System prompt</Label>
          <Textarea
            id="systemPrompt"
            rows={5}
            placeholder="You are Nutriyet's friendly AI nutrition expert…"
            {...register("systemPrompt")}
          />
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={saving} className="gap-2">
          {saving && <Loader2 className="size-4 animate-spin" />}
          Save settings
        </Button>
      </div>
    </form>
  );
}
