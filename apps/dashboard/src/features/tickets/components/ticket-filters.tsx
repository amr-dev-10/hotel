"use client";

import { Columns3, Filter, List, Search, Star } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth.store";

export function TicketFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentUser = useAuthStore((state) => state.currentUser);
  const activeView = searchParams.get("view") ?? "list";
  const [queryDraft, setQueryDraft] = useState(searchParams.get("q") ?? "");

  useEffect(() => {
    setQueryDraft(searchParams.get("q") ?? "");
  }, [searchParams]);

  function updateParam(key: string, value: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (value) {
      next.set(key, value);
    } else {
      next.delete(key);
    }
    next.delete("ticketId");
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }

  function applySavedView(params: Record<string, string>) {
    const next = new URLSearchParams();
    next.set("view", "list");
    Object.entries(params).forEach(([key, value]) => {
      if (value) {
        next.set(key, value);
      }
    });
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }

  function applySearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    updateParam("q", queryDraft.trim());
  }

  return (
    <div className="grid w-full min-w-0 max-w-full gap-4 overflow-hidden rounded-md border border-[var(--border)] bg-[var(--panel)] p-3 shadow-[var(--shadow-panel)] sm:p-4">
      <div className="flex min-w-0 flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-center lg:justify-center xl:justify-start">
          <SavedViewButton
            active={searchParams.get("assigned_to") === currentUser?.id}
            disabled={!currentUser?.id}
            label="My Open Tickets"
            onClick={() => currentUser?.id && applySavedView({ assigned_to: currentUser.id })}
          />
          <SavedViewButton
            active={searchParams.get("department_key") === "housekeeping"}
            label="Housekeeping Open"
            onClick={() => applySavedView({ department_key: "housekeeping" })}
          />
          <SavedViewButton
            active={searchParams.get("department_key") === "engineering" && searchParams.get("priority") === "4"}
            label="Engineering Escalated"
            onClick={() => applySavedView({ department_key: "engineering", priority: "4" })}
          />
          <SavedViewButton
            active={searchParams.get("sla_status") === "breached"}
            label="Today's Breaches"
            onClick={() => applySavedView({ sla_status: "breached" })}
          />
          <SavedViewButton
            active={searchParams.get("assigned_to") === "unassigned"}
            label="Unassigned"
            onClick={() => applySavedView({ assigned_to: "unassigned" })}
          />
        </div>
        <div className="inline-flex w-full self-stretch rounded-md border border-[var(--border)] bg-[var(--panel-muted)] p-1 shadow-[var(--shadow-control)] sm:w-auto sm:self-center xl:self-auto">
          <Button
            className={cn(
              "h-8 flex-1 text-[var(--muted-strong)] hover:bg-[var(--panel)] hover:text-[var(--foreground)] sm:flex-none",
              activeView === "list" && "bg-[var(--panel)] text-[var(--foreground)] shadow-[var(--shadow-control)] hover:bg-[var(--panel)]",
            )}
            size="sm"
            type="button"
            variant="ghost"
            onClick={() => updateParam("view", "list")}
          >
            <List />
            List
          </Button>
          <Button
            className={cn(
              "hidden h-8 text-[var(--muted-strong)] hover:bg-[var(--panel)] hover:text-[var(--foreground)] md:inline-flex",
              activeView === "kanban" && "bg-[var(--panel)] text-[var(--foreground)] shadow-[var(--shadow-control)] hover:bg-[var(--panel)]",
            )}
            size="sm"
            type="button"
            variant="ghost"
            onClick={() => updateParam("view", "kanban")}
          >
            <Columns3 />
            Kanban
          </Button>
        </div>
      </div>

      <div className="grid w-full min-w-0 max-w-full items-center gap-3 md:grid-cols-2 2xl:flex 2xl:items-center">
        <form className="relative w-full min-w-0 max-w-full md:col-span-2 2xl:col-span-1 2xl:flex-1" onSubmit={applySearch}>
          <Search aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-[var(--muted)]" />
          <Input
            aria-label="Search tickets"
            className="min-w-0 pr-9"
            value={queryDraft}
            placeholder="Search ticket code, item, room or assignee"
            onChange={(event) => setQueryDraft(event.target.value)}
          />
        </form>
        <div className="w-full min-w-0 max-w-full 2xl:w-52 2xl:flex-none">
          <Select value={searchParams.get("stage") ?? ""} onChange={(event) => updateParam("stage", event.target.value)}>
            <option value="">All stages</option>
            <option value="created">Created</option>
            <option value="pending_accept">Pending accept</option>
            <option value="accepted">Accepted</option>
            <option value="in_progress">In progress</option>
            <option value="pending_approval">Pending approval</option>
            <option value="approved">Approved</option>
          </Select>
        </div>
        <div className="w-full min-w-0 max-w-full 2xl:w-52 2xl:flex-none">
          <Select
            value={searchParams.get("priority") ?? ""}
            onChange={(event) => updateParam("priority", event.target.value)}
          >
            <option value="">All priorities</option>
            <option value="5">Priority 5</option>
            <option value="4">Priority 4</option>
            <option value="3">Priority 3</option>
            <option value="2">Priority 2</option>
            <option value="1">Priority 1</option>
          </Select>
        </div>
        <div className="w-full min-w-0 max-w-full 2xl:w-56 2xl:flex-none">
          <Select
            value={searchParams.get("department_key") ?? ""}
            onChange={(event) => updateParam("department_key", event.target.value)}
          >
            <option value="">All departments</option>
            <option value="front_office">Front office</option>
            <option value="housekeeping">Housekeeping</option>
            <option value="engineering">Engineering</option>
            <option value="food_beverage">Food beverage</option>
          </Select>
        </div>
        <div className="w-full min-w-0 max-w-full 2xl:w-48 2xl:flex-none">
          <Select
            value={searchParams.get("sla_status") ?? ""}
            onChange={(event) => updateParam("sla_status", event.target.value)}
          >
            <option value="">All SLA</option>
            <option value="breached">Breached</option>
          </Select>
        </div>
        <Button className="w-full md:w-auto 2xl:flex-none" type="button" variant="secondary" onClick={() => router.replace(pathname, { scroll: false })}>
          <Filter />
          Reset
        </Button>
      </div>
    </div>
  );
}

function SavedViewButton({
  active,
  disabled,
  label,
  onClick,
}: {
  active: boolean;
  disabled?: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <Button
      className={cn(
        "h-8 w-full min-w-0 justify-start border-[var(--border)] bg-[var(--panel)] text-[var(--foreground)] shadow-[var(--shadow-control)] hover:border-[var(--primary)] hover:bg-[var(--primary-soft)] hover:text-[var(--primary)] sm:justify-center lg:w-auto",
        active && "border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)]",
      )}
      disabled={disabled}
      size="sm"
      type="button"
      variant="secondary"
      onClick={onClick}
    >
      <Star />
      <span className="truncate">{label}</span>
    </Button>
  );
}
