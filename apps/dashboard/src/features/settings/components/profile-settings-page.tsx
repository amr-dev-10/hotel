"use client";

import { ChangeEvent, useEffect, useRef, useState } from "react";
import { Bell, Camera, KeyRound, Languages, Loader2, Mail, Moon, Save, UserCircle } from "lucide-react";
import { toast } from "sonner";
import { showApiErrorToast } from "@/lib/api/error-toast";

import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { Select } from "@/components/ui/select";
import { useRouteHotelId } from "@/hooks/useRouteHotelId";
import { absolutizeBackendUrl, apiGet, apiPatch, apiPost } from "@/lib/api/client";
import { titleCase } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth.store";
import type { CurrentUser } from "@/types/domain";

const events = ["Ticket Assigned", "Ticket Escalated", "Guest Message", "SLA Breach"];

export function ProfileSettingsPage() {
  const hotelId = useRouteHotelId();
  const currentUser = useAuthStore((state) => state.currentUser);
  const setCurrentUser = useAuthStore((state) => state.setCurrentUser);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [theme, setTheme] = useState("system");
  const [language, setLanguage] = useState("en");
  const [email, setEmail] = useState(currentUser?.email ?? "");
  const [isSavingEmail, setIsSavingEmail] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });
  const [prefs, setPrefs] = useState<Record<string, Record<string, boolean>>>(() =>
    Object.fromEntries(events.map((event) => [event, { push: true, email: event.includes("SLA"), inApp: true }])),
  );
  const profileImageUrl = absolutizeBackendUrl(currentUser?.profile_image_url);

  useEffect(() => {
    let active = true;

    async function refreshCurrentUser() {
      try {
        const updated = await apiGet<CurrentUser>("/auth/me");
        if (active) {
          setCurrentUser(updated);
        }
      } catch {
        // DashboardShell owns session-expiry handling; this page only refreshes fresh profile fields.
      }
    }

    void refreshCurrentUser();
    return () => {
      active = false;
    };
  }, [setCurrentUser]);

  useEffect(() => {
    setEmail(currentUser?.email ?? "");
  }, [currentUser?.email]);

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
      showApiErrorToast(error);
    } finally {
      setIsChangingPassword(false);
    }
  }

  async function handleEmailChange(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextEmail = email.trim();
    if (!nextEmail || nextEmail === currentUser?.email) {
      return;
    }

    setIsSavingEmail(true);
    try {
      const updated = await apiPatch<CurrentUser>("/auth/me", { email: nextEmail });
      setCurrentUser(updated);
      toast.success("Email updated");
    } catch (error) {
      showApiErrorToast(error);
    } finally {
      setIsSavingEmail(false);
    }
  }

  async function handleProfileImageUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    if (file.type && !file.type.startsWith("image/")) {
      toast.error("Choose an image file");
      event.target.value = "";
      return;
    }

    setIsUploadingPhoto(true);
    try {
      const updated = await apiPost<CurrentUser>("/auth/me/profile-image", {
        file_type: file.type || mediaTypeFromName(file.name),
        file_name: file.name,
        file_size_bytes: file.size,
        storage_provider: "database",
        file_data_base64: await fileToBase64(file),
      });
      setCurrentUser(updated);
      toast.success("Profile photo updated");
    } catch (error) {
      showApiErrorToast(error);
    } finally {
      setIsUploadingPhoto(false);
      event.target.value = "";
    }
  }

  return (
    <div className="grid gap-5">
      <PageBreadcrumbs
        current="Profile Settings"
        description="Account identity and dashboard preferences."
        hotelId={hotelId}
        items={[{ label: "Settings" }]}
      />

      <section className="grid gap-4 rounded-md border border-slate-200 bg-white p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-md bg-[var(--primary-soft)] text-[var(--primary)]">
              {profileImageUrl ? (
                <img alt="" className="h-full w-full object-cover" src={profileImageUrl} />
              ) : (
                <UserCircle className="size-7" />
              )}
            </span>
            <div>
              <h3 className="text-base font-semibold">{currentUser?.name ?? "Signed out"}</h3>
              <p className="text-sm text-slate-500">{currentUser?.email ?? "No email available"}</p>
            </div>
            {currentUser?.is_hotel_owner ? <Badge variant="blue">Owner</Badge> : null}
          </div>
          <div>
            <Button
              disabled={isUploadingPhoto}
              type="button"
              variant="secondary"
              onClick={() => photoInputRef.current?.click()}
            >
              {isUploadingPhoto ? <Loader2 className="animate-spin" /> : <Camera />}
              Upload photo
            </Button>
            <input ref={photoInputRef} accept="image/*" className="hidden" type="file" onChange={handleProfileImageUpload} />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Name" id="profile-name">
            <Input id="profile-name" readOnly value={currentUser?.name ?? ""} />
          </Field>
          <Field label="Employee code" id="profile-employee-code">
            <Input
              className="font-mono"
              id="profile-employee-code"
              readOnly
              value={currentUser?.employee_code ?? "Not assigned"}
            />
          </Field>
          <Field label="Job role" id="profile-role">
            <Input id="profile-role" readOnly value={titleCase(currentUser?.job_role)} />
          </Field>
        </div>
      </section>

      <section className="grid gap-4 rounded-md border border-slate-200 bg-white p-4">
        <div>
          <h3 className="flex items-center gap-2 text-base font-semibold">
            <Mail className="size-4" />
            Email
          </h3>
          <p className="mt-1 text-sm text-slate-500">Update the email address used for sign-in.</p>
        </div>
        <form className="grid gap-4 md:grid-cols-[1fr_auto]" onSubmit={handleEmailChange}>
          <Field label="Email address" id="profile-email">
            <Input
              autoComplete="email"
              id="profile-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </Field>
          <div className="flex items-end">
            <Button disabled={isSavingEmail || !email.trim() || email.trim() === currentUser?.email} type="submit">
              {isSavingEmail ? <Loader2 className="animate-spin" /> : <Save />}
              Save email
            </Button>
          </div>
        </form>
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
                    className="size-4 accent-[var(--primary)]"
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

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("Could not read image"));
    reader.onload = () => {
      const result = String(reader.result ?? "");
      resolve(result.includes(",") ? result.split(",", 2)[1] : result);
    };
    reader.readAsDataURL(file);
  });
}

function mediaTypeFromName(name: string) {
  const extension = name.split(".").pop()?.toLowerCase();
  if (extension === "png") return "image/png";
  if (extension === "webp") return "image/webp";
  if (extension === "gif") return "image/gif";
  return "image/jpeg";
}
