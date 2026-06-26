"use client";

import { useEffect, useMemo, useState } from "react";
import { KeyRound, Loader2, Save } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataState } from "@/components/ui/data-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PlatformShell } from "@/features/platform/components/platform-shell";
import {
  useChangePlatformPassword,
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
  const changePassword = useChangePlatformPassword();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [parseError, setParseError] = useState<string | null>(null);
  const [passwordForm, setPasswordForm] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });

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

  async function handlePasswordChange(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      toast.error("New password and confirmation do not match");
      return;
    }

    try {
      await changePassword.mutateAsync(passwordForm);
      setPasswordForm({
        current_password: "",
        new_password: "",
        confirm_password: "",
      });
      toast.success("Platform password changed");
    } catch (error) {
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

      <section className="grid gap-4 rounded-md border border-slate-200 bg-white p-4">
        <div>
          <h3 className="flex items-center gap-2 text-base font-semibold">
            <KeyRound className="size-4" />
            Platform Password
          </h3>
          <p className="mt-1 text-sm text-slate-500">Update the password for the signed-in super admin account.</p>
        </div>
        <form className="grid gap-4 md:grid-cols-3" onSubmit={handlePasswordChange}>
          <div className="grid gap-2">
            <Label htmlFor="platform-current-password">Current password</Label>
            <Input
              autoComplete="current-password"
              id="platform-current-password"
              type="password"
              value={passwordForm.current_password}
              onChange={(event) =>
                setPasswordForm((current) => ({ ...current, current_password: event.target.value }))
              }
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="platform-new-password">New password</Label>
            <Input
              autoComplete="new-password"
              id="platform-new-password"
              minLength={8}
              type="password"
              value={passwordForm.new_password}
              onChange={(event) =>
                setPasswordForm((current) => ({ ...current, new_password: event.target.value }))
              }
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="platform-confirm-password">Confirm password</Label>
            <Input
              autoComplete="new-password"
              id="platform-confirm-password"
              minLength={8}
              type="password"
              value={passwordForm.confirm_password}
              onChange={(event) =>
                setPasswordForm((current) => ({ ...current, confirm_password: event.target.value }))
              }
            />
          </div>
          <div className="md:col-span-3">
            <Button disabled={changePassword.isPending} type="submit">
              {changePassword.isPending ? <Loader2 className="animate-spin" /> : <Save />}
              Change password
            </Button>
          </div>
        </form>
      </section>

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
