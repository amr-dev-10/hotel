"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataState } from "@/components/ui/data-state";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PlatformShell } from "@/features/platform/components/platform-shell";
import {
  usePlatformSettings,
  useSavePlatformSettings,
} from "@/features/platform/hooks/usePlatform";
import { apiErrorMessage } from "@/lib/api/client";
import { titleCase } from "@/lib/utils";

export function PlatformSettingsPage() {
  return (
    <PlatformShell>
      <PlatformSettingsContent />
    </PlatformShell>
  );
}

function PlatformSettingsContent() {
  const settings = usePlatformSettings();
  const saveSettings = useSavePlatformSettings();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [parseError, setParseError] = useState<string | null>(null);

  useEffect(() => {
    if (settings.data) {
      setDrafts(
        Object.fromEntries(
          settings.data.map((setting) => [
            setting.key,
            JSON.stringify(setting.value, null, 2),
          ]),
        ),
      );
    }
  }, [settings.data]);

  const dirtyCount = useMemo(() => {
    if (!settings.data) {
      return 0;
    }

    return settings.data.filter((setting) => drafts[setting.key] !== JSON.stringify(setting.value, null, 2)).length;
  }, [drafts, settings.data]);

  async function handleSave() {
    setParseError(null);

    try {
      const payload = Object.fromEntries(
        Object.entries(drafts).map(([key, value]) => [key, JSON.parse(value)]),
      );
      await saveSettings.mutateAsync(payload);
      toast.success("Platform settings saved");
    } catch (error) {
      if (error instanceof SyntaxError) {
        setParseError(error.message);
        return;
      }
      toast.error(apiErrorMessage(error));
    }
  }

  if (settings.isLoading) {
    return <DataState isLoading />;
  }

  if (settings.error) {
    return <DataState error={settings.error} />;
  }

  return (
    <div className="grid gap-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-xl font-semibold">Platform Settings</h2>
          <p className="text-sm text-slate-500">Global defaults for onboarding, integrations, branding, and features.</p>
        </div>
        <Button disabled={saveSettings.isPending || !dirtyCount} type="button" onClick={handleSave}>
          {saveSettings.isPending ? <Loader2 className="animate-spin" /> : <Save />}
          Save changes
        </Button>
      </div>

      {parseError ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {parseError}
        </div>
      ) : null}

      {!settings.data?.length ? (
        <DataState empty emptyTitle="No platform settings found." />
      ) : (
        <section className="grid gap-4">
          {settings.data.map((setting) => (
            <div className="grid gap-3 rounded-md border border-slate-200 bg-white p-4" key={setting.key}>
              <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                <div>
                  <h3 className="text-base font-semibold">{titleCase(setting.key)}</h3>
                  <p className="text-xs text-slate-500">
                    Updated {new Date(setting.updated_at).toLocaleString()}
                  </p>
                </div>
                <Badge variant={drafts[setting.key] === JSON.stringify(setting.value, null, 2) ? "default" : "amber"}>
                  {drafts[setting.key] === JSON.stringify(setting.value, null, 2) ? "Saved" : "Edited"}
                </Badge>
              </div>
              <div className="grid gap-2">
                <Label htmlFor={`platform-setting-${setting.key}`}>JSON value</Label>
                <Textarea
                  className="min-h-36 font-mono text-xs"
                  id={`platform-setting-${setting.key}`}
                  value={drafts[setting.key] ?? ""}
                  onChange={(event) =>
                    setDrafts((current) => ({
                      ...current,
                      [setting.key]: event.target.value,
                    }))
                  }
                />
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
