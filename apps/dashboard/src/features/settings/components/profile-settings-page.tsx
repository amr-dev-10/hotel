"use client";

import { useState } from "react";
import { Bell, KeyRound, Languages, Loader2, Moon, Save, UserCircle } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { Select } from "@/components/ui/select";
import { apiErrorMessage, apiPost } from "@/lib/api/client";
import { titleCase } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth.store";

const events = ["Ticket Assigned", "Ticket Escalated", "Guest Message", "SLA Breach"];

export function ProfileSettingsPage() {
  const currentUser = useAuthStore((state) => state.currentUser);
  const [theme, setTheme] = useState("system");
  const [language, setLanguage] = useState("en");
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });
  const [prefs, setPrefs] = useState<Record<string, Record<string, boolean>>>(() =>
    Object.fromEntries(events.map((event) => [event, { push: true, email: event.includes("SLA"), inApp: true }])),
  );

  function toggle(event: string, channel: string) {
    setPrefs((current) => ({
      ...current,
      [event]: {
        ...current[event],
        [channel]: !current[event]?.[channel],
      },
    }));
  }

  async function handlePasswordChange(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      toast.error("New password and confirmation do not match");
      return;
    }

    setIsChangingPassword(true);
    try {
      await apiPost<{ password_changed: boolean }>("/auth/change-password", passwordForm);
      setPasswordForm({
        current_password: "",
        new_password: "",
        confirm_password: "",
      });
      toast.success("Password changed");
    } catch (error) {
      toast.error(apiErrorMessage(error));
    } finally {
      setIsChangingPassword(false);
    }
  }

  return (
    <div className="grid gap-5">
      <div>
        <h2 className="text-xl font-semibold">Profile Settings</h2>
        <p className="text-sm text-slate-500">Account identity and dashboard preferences.</p>
      </div>

      <section className="grid gap-4 rounded-md border border-slate-200 bg-white p-4">
        <div className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-md bg-[#0F3D91]/10 text-[#0F3D91]">
            <UserCircle className="size-6" />
          </span>
          <div>
            <h3 className="text-base font-semibold">{currentUser?.name ?? "Signed out"}</h3>
            <p className="text-sm text-slate-500">{currentUser?.email ?? "No email available"}</p>
          </div>
          {currentUser?.is_hotel_owner ? <Badge variant="blue">Owner</Badge> : null}
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Name" id="profile-name">
            <Input id="profile-name" readOnly value={currentUser?.name ?? ""} />
          </Field>
          <Field label="Email" id="profile-email">
            <Input id="profile-email" readOnly value={currentUser?.email ?? ""} />
          </Field>
          <Field label="Job role" id="profile-role">
            <Input id="profile-role" readOnly value={titleCase(currentUser?.job_role)} />
          </Field>
        </div>
      </section>

      <section className="grid gap-4 rounded-md border border-slate-200 bg-white p-4">
        <div>
          <h3 className="flex items-center gap-2 text-base font-semibold">
            <KeyRound className="size-4" />
            Password
          </h3>
          <p className="mt-1 text-sm text-slate-500">Update your sign-in password for this hotel account.</p>
        </div>
        <form className="grid gap-4 md:grid-cols-3" onSubmit={handlePasswordChange}>
          <Field label="Current password" id="profile-current-password">
            <PasswordInput
              autoComplete="current-password"
              id="profile-current-password"
              value={passwordForm.current_password}
              onChange={(event) =>
                setPasswordForm((current) => ({ ...current, current_password: event.target.value }))
              }
            />
          </Field>
          <Field label="New password" id="profile-new-password">
            <PasswordInput
              autoComplete="new-password"
              id="profile-new-password"
              minLength={8}
              value={passwordForm.new_password}
              onChange={(event) =>
                setPasswordForm((current) => ({ ...current, new_password: event.target.value }))
              }
            />
          </Field>
          <Field label="Confirm password" id="profile-confirm-password">
            <PasswordInput
              autoComplete="new-password"
              id="profile-confirm-password"
              minLength={8}
              value={passwordForm.confirm_password}
              onChange={(event) =>
                setPasswordForm((current) => ({ ...current, confirm_password: event.target.value }))
              }
            />
          </Field>
          <div className="md:col-span-3">
            <Button disabled={isChangingPassword} type="submit">
              {isChangingPassword ? <Loader2 className="animate-spin" /> : <Save />}
              Change password
            </Button>
          </div>
        </form>
      </section>

      <section className="grid gap-4 rounded-md border border-slate-200 bg-white p-4">
        <h3 className="flex items-center gap-2 text-base font-semibold">
          <Bell className="size-4" />
          Notification Preferences
        </h3>
        <div className="overflow-hidden rounded-md border border-slate-200">
          <div className="grid grid-cols-[1fr_90px_90px_90px] bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-normal text-slate-500">
            <span>Event</span>
            <span>Push</span>
            <span>Email</span>
            <span>In-app</span>
          </div>
          {events.map((event) => (
            <div className="grid grid-cols-[1fr_90px_90px_90px] border-t border-slate-100 px-4 py-3 text-sm" key={event}>
              <span className="font-medium">{event}</span>
              {["push", "email", "inApp"].map((channel) => (
                <label className="flex items-center" key={channel}>
                  <input
                    checked={Boolean(prefs[event]?.[channel])}
                    className="size-4 accent-[#0F3D91]"
                    type="checkbox"
                    onChange={() => toggle(event, channel)}
                  />
                </label>
              ))}
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 rounded-md border border-slate-200 bg-white p-4 md:grid-cols-2">
        <Field label="Language" id="profile-language">
          <Select id="profile-language" value={language} onChange={(event) => setLanguage(event.target.value)}>
            <option value="en">English</option>
            <option value="hi">Hindi</option>
            <option value="ar">Arabic</option>
          </Select>
        </Field>
        <Field label="Theme" id="profile-theme">
          <Select id="profile-theme" value={theme} onChange={(event) => setTheme(event.target.value)}>
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </Select>
        </Field>
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Languages className="size-4" />
          {language.toUpperCase()}
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Moon className="size-4" />
          {titleCase(theme)}
        </div>
      </section>

      <div className="flex justify-end">
        <Button type="button" variant="secondary">
          Preferences saved locally
        </Button>
      </div>
    </div>
  );
}

function Field({
  label,
  id,
  children,
}: {
  label: string;
  id: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}
