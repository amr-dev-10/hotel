"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { Edit3, KeyRound, Loader2, Search, Sparkles, UsersRound } from "lucide-react";
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
import { PasswordInput } from "@/components/ui/password-input";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { Select } from "@/components/ui/select";
import { PlatformShell } from "@/features/platform/components/platform-shell";
import {
  usePlatformHotels,
  usePlatformUsers,
  useGeneratePlatformEmployeeCode,
  useResetPlatformUserPassword,
  useUpdatePlatformUser,
  type PlatformUserUpdatePayload,
} from "@/features/platform/hooks/usePlatform";
import { titleCase } from "@/lib/utils";
import type { PlatformUserSummary } from "@/types/domain";

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

interface PasswordFormState {
  new_password: string;
  confirm_password: string;
}

const PLATFORM_PAGE_SIZE = 50;

export function PlatformUsersPage() {
  return (
    <PlatformShell>
      <PlatformUsersContent />
    </PlatformShell>
  );
}

function PlatformUsersContent() {
  const users = usePlatformUsers();
  const hotels = usePlatformHotels();
  const updateUser = useUpdatePlatformUser();
  const resetPassword = useResetPlatformUserPassword();
  const [search, setSearch] = useState("");
  const [hotelFilter, setHotelFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [editingUser, setEditingUser] = useState<PlatformUserSummary | null>(null);
  const generateEmployeeCode = useGeneratePlatformEmployeeCode(editingUser?.hotel_id);
  const [passwordUser, setPasswordUser] = useState<PlatformUserSummary | null>(null);
  const [form, setForm] = useState<UserFormState>(() => emptyForm());
  const [passwordForm, setPasswordForm] = useState<PasswordFormState>(() => emptyPasswordForm());

  const hotelById = useMemo(() => {
    const byId = new Map<string, string>();
    for (const hotel of hotels.data ?? []) {
      byId.set(hotel.id, hotel.name);
    }
    return byId;
  }, [hotels.data]);

  const filteredUsers = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return (users.data ?? []).filter((user) => {
      const hotelName = hotelById.get(user.hotel_id) ?? "";
      const matchesHotel = hotelFilter === "all" || user.hotel_id === hotelFilter;
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && user.is_active) ||
        (statusFilter === "inactive" && !user.is_active);
      const matchesSearch =
        !normalizedSearch ||
        [user.name, user.email, user.employee_code, user.user_type, user.staff_level, user.job_role, hotelName]
          .filter(Boolean)
          .some((value) => value?.toLowerCase().includes(normalizedSearch));

      return matchesHotel && matchesStatus && matchesSearch;
    });
  }, [hotelById, hotelFilter, search, statusFilter, users.data]);

  useEffect(() => {
    setPage(1);
  }, [hotelFilter, search, statusFilter]);

  const pageCount = Math.max(1, Math.ceil(filteredUsers.length / PLATFORM_PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * PLATFORM_PAGE_SIZE;
    return filteredUsers.slice(start, start + PLATFORM_PAGE_SIZE);
  }, [currentPage, filteredUsers]);

  function openEditor(user: PlatformUserSummary) {
    setEditingUser(user);
    setForm({
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

  function openPasswordEditor(user: PlatformUserSummary) {
    setPasswordUser(user);
    setPasswordForm(emptyPasswordForm());
  }

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingUser) {
      return;
    }

    const payload: PlatformUserUpdatePayload = {
      name: form.name,
      email: form.email,
      employee_code: form.employee_code.trim().toUpperCase() || null,
      job_role: form.job_role || null,
      user_type: form.user_type,
      staff_level: form.staff_level || null,
      is_active: form.is_active,
      is_on_duty: form.is_on_duty,
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
        staff_level: form.staff_level || null,
      });
      setForm((current) => ({ ...current, employee_code: generated.employee_code }));
      toast.success("Employee code generated");
    } catch (error) {
      showApiErrorToast(error);
    }
  }

  async function handlePasswordSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!passwordUser) {
      return;
    }

    try {
      await resetPassword.mutateAsync({
        userId: passwordUser.id,
        payload: passwordForm,
      });
      toast.success("User password updated");
      setPasswordUser(null);
      setPasswordForm(emptyPasswordForm());
    } catch (error) {
      showApiErrorToast(error);
    }
  }

  if (users.isLoading || hotels.isLoading) {
    return <DataState isLoading />;
  }

  if (users.error || hotels.error) {
    return <DataState error={users.error ?? hotels.error} />;
  }

  return (
    <div className="grid gap-5">
      <div>
        <h2 className="text-xl font-semibold">Platform Users</h2>
        <p className="text-sm text-slate-500">Edit hotel user profiles across every tenant.</p>
      </div>

      <section className="grid gap-3 rounded-md border border-slate-200 bg-white p-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_14rem_12rem]">
          <label className="relative block">
            <span className="sr-only">Search users</span>
            <Search className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              className="pr-9"
              placeholder="Search users, email, code, role, or hotel"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <label>
            <span className="sr-only">Hotel</span>
            <Select value={hotelFilter} onChange={(event) => setHotelFilter(event.target.value)}>
              <option value="all">All hotels</option>
              {(hotels.data ?? []).map((hotel) => (
                <option key={hotel.id} value={hotel.id}>
                  {hotel.name}
                </option>
              ))}
            </Select>
          </label>
          <label>
            <span className="sr-only">Status</span>
            <Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </Select>
          </label>
        </div>
      </section>

      {!filteredUsers.length ? (
        <DataState empty emptyTitle={users.data?.length ? "No users match these filters." : "No users found."} />
      ) : (
        <div className="grid gap-3">
          <div className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1160px] border-collapse text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-normal text-slate-500">
                  <tr>
                    <th className="border-b border-slate-200 px-4 py-3 font-semibold">User</th>
                    <th className="border-b border-slate-200 px-4 py-3 font-semibold">Employee code</th>
                    <th className="border-b border-slate-200 px-4 py-3 font-semibold">Hotel</th>
                    <th className="border-b border-slate-200 px-4 py-3 font-semibold">Role</th>
                    <th className="border-b border-slate-200 px-4 py-3 font-semibold">Duty</th>
                    <th className="border-b border-slate-200 px-4 py-3 font-semibold">Status</th>
                    <th className="border-b border-slate-200 px-4 py-3 font-semibold">Created</th>
                    <th className="border-b border-slate-200 px-4 py-3 font-semibold" />
                  </tr>
                </thead>
                <tbody>
                  {paginatedUsers.map((user) => (
                    <tr className="border-b border-slate-100 last:border-0" key={user.id}>
                      <td className="px-4 py-3 align-middle">
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-slate-950">{user.name}</p>
                          <p className="truncate text-xs text-slate-500">{user.email}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <code className="rounded bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                          {employeeCode(user)}
                        </code>
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <Link className="font-medium hover:text-[var(--primary)]" href={`/platform/hotels/${user.hotel_id}`}>
                          {hotelById.get(user.hotel_id) ?? "Unknown hotel"}
                        </Link>
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <div>
                          <p className="font-medium">{user.job_role ?? titleCase(user.user_type)}</p>
                          <p className="text-xs text-slate-500">{titleCase(user.staff_level ?? user.user_type)}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <Badge variant={user.is_on_duty ? "green" : "default"}>
                          {user.is_on_duty ? "On duty" : "Off duty"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <Badge variant={user.is_active ? "green" : "rose"}>
                          {user.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 align-middle">{format(new Date(user.created_at), "dd MMM yyyy")}</td>
                      <td className="px-4 py-3 align-middle">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" type="button" variant="secondary" onClick={() => openPasswordEditor(user)}>
                            <KeyRound />
                            Password
                          </Button>
                          <Button size="sm" type="button" variant="secondary" onClick={() => openEditor(user)}>
                            <Edit3 />
                            Edit
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <PaginationControls
            page={currentPage}
            pageSize={PLATFORM_PAGE_SIZE}
            totalItems={filteredUsers.length}
            onPageChange={setPage}
          />
        </div>
      )}

      <Dialog open={Boolean(editingUser)} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User Profile</DialogTitle>
            <DialogDescription>Update identity, role shape, and active state for this hotel user.</DialogDescription>
          </DialogHeader>
          <form className="grid gap-4" onSubmit={handleSave}>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Name" id="platform-user-name">
                <Input
                  id="platform-user-name"
                  minLength={2}
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                />
              </Field>
              <Field label="Email" id="platform-user-email">
                <Input
                  id="platform-user-email"
                  type="email"
                  value={form.email}
                  onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                />
              </Field>
              <Field label="Employee code" id="platform-user-employee-code">
                <div className="flex gap-2">
                  <Input
                    className="font-mono uppercase"
                    id="platform-user-employee-code"
                    maxLength={40}
                    pattern="[A-Za-z0-9]*"
                    placeholder="TAJMANG234AX"
                    value={form.employee_code}
                    onChange={(event) =>
                      setForm((current) => ({
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
              <Field label="Job role" id="platform-user-job-role">
                <Input
                  id="platform-user-job-role"
                  value={form.job_role}
                  onChange={(event) => setForm((current) => ({ ...current, job_role: event.target.value }))}
                />
              </Field>
              <Field label="User type" id="platform-user-type">
                <Select
                  id="platform-user-type"
                  value={form.user_type}
                  onChange={(event) => setForm((current) => ({ ...current, user_type: event.target.value }))}
                >
                  <option value="HOTEL_ADMIN">Hotel admin</option>
                  <option value="HOTEL_EMPLOYEE">Hotel employee</option>
                </Select>
              </Field>
              <Field label="Staff level" id="platform-staff-level">
                <Select
                  id="platform-staff-level"
                  value={form.staff_level}
                  onChange={(event) => setForm((current) => ({ ...current, staff_level: event.target.value }))}
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
                    checked={form.is_active}
                    className="size-4 accent-[var(--primary)]"
                    type="checkbox"
                    onChange={(event) => setForm((current) => ({ ...current, is_active: event.target.checked }))}
                  />
                  Active account
                </label>
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input
                    checked={form.is_on_duty}
                    className="size-4 accent-[var(--primary)]"
                    type="checkbox"
                    onChange={(event) => setForm((current) => ({ ...current, is_on_duty: event.target.checked }))}
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

      <Dialog open={Boolean(passwordUser)} onOpenChange={(open) => !open && setPasswordUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Hotel User Password</DialogTitle>
            <DialogDescription>
              Set a new login password for {passwordUser?.name ?? "this hotel user"}.
            </DialogDescription>
          </DialogHeader>
          <form className="grid gap-4" onSubmit={handlePasswordSave}>
            <Field label="New password" id="platform-user-new-password">
              <PasswordInput
                id="platform-user-new-password"
                minLength={8}
                value={passwordForm.new_password}
                onChange={(event) =>
                  setPasswordForm((current) => ({ ...current, new_password: event.target.value }))
                }
              />
            </Field>
            <Field label="Confirm password" id="platform-user-confirm-password">
              <PasswordInput
                id="platform-user-confirm-password"
                minLength={8}
                value={passwordForm.confirm_password}
                onChange={(event) =>
                  setPasswordForm((current) => ({ ...current, confirm_password: event.target.value }))
                }
              />
            </Field>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setPasswordUser(null)}>
                Close
              </Button>
              <Button
                disabled={
                  resetPassword.isPending ||
                  passwordForm.new_password.length < 8 ||
                  passwordForm.new_password !== passwordForm.confirm_password
                }
                type="submit"
              >
                {resetPassword.isPending ? <Loader2 className="animate-spin" /> : <KeyRound />}
                Save password
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

function emptyForm(): UserFormState {
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

function emptyPasswordForm(): PasswordFormState {
  return {
    new_password: "",
    confirm_password: "",
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
