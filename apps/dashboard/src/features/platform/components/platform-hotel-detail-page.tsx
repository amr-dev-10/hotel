"use client";

import { useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { ArrowLeft, Building2, Edit3, ExternalLink, Hotel, Loader2, Search, Sparkles, Ticket, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { showApiErrorToast } from "@/lib/api/error-toast";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataState } from "@/components/ui/data-state";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { PlatformShell } from "@/features/platform/components/platform-shell";
import {
  usePlatformHotels,
  usePlatformSubscriptions,
  usePlatformUsers,
  useGeneratePlatformEmployeeCode,
  useUpdatePlatformHotel,
  useUpdatePlatformUser,
  type PlatformHotelUpdatePayload,
  type PlatformUserUpdatePayload,
} from "@/features/platform/hooks/usePlatform";
import { compactId, titleCase } from "@/lib/utils";
import type { PlatformUserSummary } from "@/types/domain";

interface HotelFormState {
  name: string;
  slug: string;
  subscription_tier: string;
  status: string;
}

interface UserFormState {
  name: string;
  email: string;
  employee_code: string;
  job_role: string;
  user_type: string;
  staff_level: string;
  is_active: boolean;
  is_on_duty: boolean;
}

export function PlatformHotelDetailPage({ hotelId }: { hotelId: string }) {
  return (
    <PlatformShell>
      <PlatformHotelDetailContent hotelId={hotelId} />
    </PlatformShell>
  );
}

function PlatformHotelDetailContent({ hotelId }: { hotelId: string }) {
  const hotels = usePlatformHotels();
  const users = usePlatformUsers();
  const subscriptions = usePlatformSubscriptions();
  const updateHotel = useUpdatePlatformHotel();
  const updateUser = useUpdatePlatformUser();
  const generateEmployeeCode = useGeneratePlatformEmployeeCode(hotelId);
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState<HotelFormState>(() => emptyForm());
  const [staffSearch, setStaffSearch] = useState("");
  const [editingUser, setEditingUser] = useState<PlatformUserSummary | null>(null);
  const [userForm, setUserForm] = useState<UserFormState>(() => emptyUserForm());

  if (hotels.isLoading || users.isLoading || subscriptions.isLoading) {
    return <DataState isLoading />;
  }

  if (hotels.error || users.error || subscriptions.error) {
    return <DataState error={hotels.error ?? users.error ?? subscriptions.error} />;
  }

  const hotel = hotels.data?.find((item) => item.id === hotelId);
  const hotelUsers = (users.data ?? []).filter((user) => user.hotel_id === hotelId);
  const normalizedStaffSearch = staffSearch.trim().toLowerCase();
  const visibleHotelUsers = hotelUsers.filter((user) => {
    if (!normalizedStaffSearch) {
      return true;
    }
    return [user.name, user.email, user.employee_code, user.user_type, user.staff_level, user.job_role]
      .filter(Boolean)
      .some((value) => value?.toLowerCase().includes(normalizedStaffSearch));
  });
  const subscription = subscriptions.data?.find((item) => item.hotel_id === hotelId);

  if (!hotel) {
    return <DataState empty emptyTitle="Hotel not found." />;
  }

  function openHotelEditor() {
    if (!hotel) {
      return;
    }
    setForm({
      name: hotel.name,
      slug: hotel.slug,
      subscription_tier: hotel.subscription_tier,
      status: hotel.status,
    });
    setEditOpen(true);
  }

  function openUserEditor(user: PlatformUserSummary) {
    setEditingUser(user);
    setUserForm({
      name: user.name,
      email: user.email,
      employee_code: user.employee_code ?? "",
      job_role: user.job_role ?? "",
      user_type: user.user_type,
      staff_level: user.staff_level ?? "",
      is_active: user.is_active,
      is_on_duty: user.is_on_duty,
    });
  }

  async function handleHotelSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!hotel) {
      return;
    }
    const payload: PlatformHotelUpdatePayload = {
      name: form.name.trim(),
      slug: form.slug.trim(),
      subscription_tier: form.subscription_tier,
      status: form.status,
    };

    try {
      await updateHotel.mutateAsync({ hotelId: hotel.id, payload });
      toast.success("Hotel updated");
      setEditOpen(false);
    } catch (error) {
      showApiErrorToast(error);
    }
  }

  async function handleUserSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingUser) {
      return;
    }

    const payload: PlatformUserUpdatePayload = {
      name: userForm.name,
      email: userForm.email,
      employee_code: userForm.employee_code.trim().toUpperCase() || null,
      job_role: userForm.job_role || null,
      user_type: userForm.user_type,
      staff_level: userForm.staff_level || null,
      is_active: userForm.is_active,
      is_on_duty: userForm.is_on_duty,
    };

    try {
      await updateUser.mutateAsync({ userId: editingUser.id, payload });
      toast.success("User profile updated");
      setEditingUser(null);
    } catch (error) {
      showApiErrorToast(error);
    }
  }

  async function handleGenerateEmployeeCode() {
    if (!editingUser) {
      return;
    }

    try {
      const generated = await generateEmployeeCode.mutateAsync({
        staff_level: userForm.staff_level || null,
      });
      setUserForm((current) => ({ ...current, employee_code: generated.employee_code }));
      toast.success("Employee code generated");
    } catch (error) {
      showApiErrorToast(error);
    }
  }

  return (
    <div className="grid gap-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <Button asChild type="button" variant="ghost">
            <Link href="/platform/hotels">
              <ArrowLeft />
              Hotels
            </Link>
          </Button>
          <h2 className="mt-2 text-xl font-semibold">{hotel.name}</h2>
          <p className="text-sm text-slate-500">{hotel.slug}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant={hotel.status === "active" ? "green" : "amber"}>{titleCase(hotel.status)}</Badge>
          <Button type="button" variant="secondary" onClick={openHotelEditor}>
            <Edit3 />
            Edit hotel
          </Button>
          <Button asChild type="button">
            <Link href={`/${hotel.id}/overview`}>
              <ExternalLink />
              Open hotel
            </Link>
          </Button>
        </div>
      </div>

      <section className="grid gap-4 rounded-md border border-slate-200 bg-white p-4 lg:grid-cols-4">
        <Detail icon={Hotel} label="Tenant ID" value={compactId(hotel.id)} />
        <Detail icon={Building2} label="Plan" value={titleCase(hotel.subscription_tier)} />
        <Detail icon={UsersRound} label="Active users" value={hotel.active_users.toString()} />
        <Detail icon={Ticket} label="Open tickets" value={hotel.open_tickets.toString()} />
      </section>

      <div className="grid gap-5 xl:grid-cols-[0.8fr_1fr]">
        <section className="grid gap-3 rounded-md border border-slate-200 bg-white p-4">
          <h3 className="text-base font-semibold">Subscription</h3>
          {subscription ? (
            <div className="grid gap-3">
              <Metric label="Plan" value={titleCase(subscription.plan)} />
              <Metric label="Status" value={titleCase(subscription.status)} />
              <Metric label="Billing cycle" value={titleCase(subscription.billing_cycle)} />
              <Metric
                label="Renewal"
                value={subscription.renewal_date ? format(new Date(subscription.renewal_date), "dd MMM yyyy") : "Not set"}
              />
            </div>
          ) : (
            <DataState empty emptyTitle="No subscription row found." />
          )}
        </section>

        <section className="grid gap-3 rounded-md border border-slate-200 bg-white p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-base font-semibold">Users</h3>
              <p className="text-sm text-slate-500">Platform-wide user list filtered to this hotel.</p>
            </div>
            <Badge variant="blue">
              {visibleHotelUsers.length}
              {visibleHotelUsers.length === hotelUsers.length ? "" : ` / ${hotelUsers.length}`}
            </Badge>
          </div>
          <label className="relative block">
            <span className="sr-only">Search hotel users</span>
            <Search className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              className="pr-9"
              placeholder="Search name, email, employee code, or role"
              value={staffSearch}
              onChange={(event) => setStaffSearch(event.target.value)}
            />
          </label>
          {!visibleHotelUsers.length ? (
            <DataState empty emptyTitle={hotelUsers.length ? "No users match this hotel search." : "No users found for this hotel."} />
          ) : (
            <div className="overflow-hidden rounded-md border border-slate-200">
              {visibleHotelUsers.map((user) => (
                <div
                  className="grid gap-2 border-b border-slate-100 p-3 text-sm last:border-b-0 sm:grid-cols-[minmax(0,1fr)_130px_120px_90px_82px]"
                  key={user.id}
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-950">{user.name}</p>
                    <p className="truncate text-xs text-slate-500">{user.email}</p>
                  </div>
                  <code className="w-fit rounded bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                    {employeeCode(user)}
                  </code>
                  <span className="text-slate-600">{titleCase(user.staff_level ?? user.user_type)}</span>
                  <Badge variant={user.is_active ? "green" : "rose"}>{user.is_active ? "Active" : "Inactive"}</Badge>
                  <Button size="sm" type="button" variant="secondary" onClick={() => openUserEditor(user)}>
                    <Edit3 />
                    Edit
                  </Button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Hotel</DialogTitle>
            <DialogDescription>Update tenant identity, workspace status, and plan.</DialogDescription>
          </DialogHeader>
          <form className="grid gap-4" onSubmit={handleHotelSave}>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Hotel name" id="platform-hotel-name">
                <Input
                  id="platform-hotel-name"
                  minLength={2}
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                />
              </Field>
              <Field label="Slug" id="platform-hotel-slug">
                <Input
                  id="platform-hotel-slug"
                  minLength={2}
                  value={form.slug}
                  onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value }))}
                />
              </Field>
              <Field label="Plan" id="platform-hotel-plan">
                <Select
                  id="platform-hotel-plan"
                  value={form.subscription_tier}
                  onChange={(event) => setForm((current) => ({ ...current, subscription_tier: event.target.value }))}
                >
                  <option value="starter">Starter</option>
                  <option value="professional">Professional</option>
                  <option value="enterprise">Enterprise</option>
                </Select>
              </Field>
              <Field label="Status" id="platform-hotel-status">
                <Select
                  id="platform-hotel-status"
                  value={form.status}
                  onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}
                >
                  <option value="active">Active</option>
                  <option value="trial">Trial</option>
                  <option value="suspended">Suspended</option>
                  <option value="inactive">Inactive</option>
                </Select>
              </Field>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setEditOpen(false)}>
                Close
              </Button>
              <Button disabled={updateHotel.isPending} type="submit">
                <Hotel />
                Save hotel
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editingUser)} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Staff Profile</DialogTitle>
            <DialogDescription>Update this hotel user without leaving the hotel page.</DialogDescription>
          </DialogHeader>
          <form className="grid gap-4" onSubmit={handleUserSave}>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Name" id="hotel-user-name">
                <Input
                  id="hotel-user-name"
                  minLength={2}
                  value={userForm.name}
                  onChange={(event) => setUserForm((current) => ({ ...current, name: event.target.value }))}
                />
              </Field>
              <Field label="Email" id="hotel-user-email">
                <Input
                  id="hotel-user-email"
                  type="email"
                  value={userForm.email}
                  onChange={(event) => setUserForm((current) => ({ ...current, email: event.target.value }))}
                />
              </Field>
              <Field label="Employee code" id="hotel-user-employee-code">
                <div className="flex gap-2">
                  <Input
                    className="font-mono uppercase"
                    id="hotel-user-employee-code"
                    maxLength={40}
                    pattern="[A-Za-z0-9]*"
                    placeholder="TAJMANG234AX"
                    value={userForm.employee_code}
                    onChange={(event) =>
                      setUserForm((current) => ({
                        ...current,
                        employee_code: event.target.value.replace(/[^a-z0-9]/gi, "").toUpperCase(),
                      }))
                    }
                  />
                  <Button
                    className="shrink-0"
                    disabled={generateEmployeeCode.isPending || !editingUser}
                    type="button"
                    variant="secondary"
                    onClick={handleGenerateEmployeeCode}
                  >
                    {generateEmployeeCode.isPending ? <Loader2 className="animate-spin" /> : <Sparkles />}
                    Auto-generate
                  </Button>
                </div>
              </Field>
              <Field label="Job role" id="hotel-user-job-role">
                <Input
                  id="hotel-user-job-role"
                  value={userForm.job_role}
                  onChange={(event) => setUserForm((current) => ({ ...current, job_role: event.target.value }))}
                />
              </Field>
              <Field label="User type" id="hotel-user-type">
                <Select
                  id="hotel-user-type"
                  value={userForm.user_type}
                  onChange={(event) => setUserForm((current) => ({ ...current, user_type: event.target.value }))}
                >
                  <option value="HOTEL_ADMIN">Hotel admin</option>
                  <option value="HOTEL_EMPLOYEE">Hotel employee</option>
                </Select>
              </Field>
              <Field label="Staff level" id="hotel-user-staff-level">
                <Select
                  id="hotel-user-staff-level"
                  value={userForm.staff_level}
                  onChange={(event) => setUserForm((current) => ({ ...current, staff_level: event.target.value }))}
                >
                  <option value="">No level</option>
                  <option value="admin">Admin</option>
                  <option value="manager">Manager</option>
                  <option value="supervisor">Supervisor</option>
                  <option value="attendant">Attendant</option>
                </Select>
              </Field>
              <div className="grid gap-2 rounded-md border border-slate-200 p-3">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input
                    checked={userForm.is_active}
                    className="size-4 accent-[var(--primary)]"
                    type="checkbox"
                    onChange={(event) => setUserForm((current) => ({ ...current, is_active: event.target.checked }))}
                  />
                  Active account
                </label>
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input
                    checked={userForm.is_on_duty}
                    className="size-4 accent-[var(--primary)]"
                    type="checkbox"
                    onChange={(event) => setUserForm((current) => ({ ...current, is_on_duty: event.target.checked }))}
                  />
                  On duty
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setEditingUser(null)}>
                Close
              </Button>
              <Button disabled={updateUser.isPending} type="submit">
                <UsersRound />
                Save profile
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function employeeCode(user: PlatformUserSummary) {
  return user.employee_code || "Not assigned";
}

function emptyForm(): HotelFormState {
  return {
    name: "",
    slug: "",
    subscription_tier: "starter",
    status: "active",
  };
}

function emptyUserForm(): UserFormState {
  return {
    name: "",
    email: "",
    employee_code: "",
    job_role: "",
    user_type: "HOTEL_EMPLOYEE",
    staff_level: "",
    is_active: true,
    is_on_duty: false,
  };
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

function Detail({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-md bg-slate-50 p-3">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-normal text-slate-500">
        <Icon className="size-3.5" />
        {label}
      </div>
      <p className="mt-2 break-all text-sm font-semibold">{value}</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-slate-50 p-3">
      <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold">{value}</p>
    </div>
  );
}
