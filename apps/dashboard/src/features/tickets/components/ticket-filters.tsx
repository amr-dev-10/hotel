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
    <div className="grid gap-3 rounded-md border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap gap-2">
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
        <div className="inline-flex rounded-md border border-slate-200 bg-slate-50 p-1">
          <Button
            className={cn("h-8", activeView === "list" && "bg-white shadow-sm hover:bg-white")}
            size="sm"
            type="button"
            variant="ghost"
            onClick={() => updateParam("view", "list")}
          >
            <List />
            List
          </Button>
          <Button
            className={cn("hidden h-8 md:inline-flex", activeView === "kanban" && "bg-white shadow-sm hover:bg-white")}
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

      <div className="grid gap-3 xl:grid-cols-[1fr_180px_180px_190px_170px_auto]">
        <form className="relative" onSubmit={applySearch}>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            className="pl-9 pr-10"
            value={queryDraft}
            placeholder="Search ticket code, item, room or assignee"
            onChange={(event) => setQueryDraft(event.target.value)}
          />
          <Button className="absolute right-1 top-1 size-8" size="icon" type="submit" variant="ghost">
            <Search className="size-4" />
          </Button>
        </form>
        <Select value={searchParams.get("stage") ?? ""} onChange={(event) => updateParam("stage", event.target.value)}>
          <option value="">All stages</option>
          <option value="created">Created</option>
          <option value="pending_accept">Pending accept</option>
          <option value="accepted">Accepted</option>
          <option value="in_progress">In progress</option>
          <option value="pending_approval">Pending approval</option>
          <option value="approved">Approved</option>
        </Select>
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
        <Select
          value={searchParams.get("sla_status") ?? ""}
          onChange={(event) => updateParam("sla_status", event.target.value)}
        >
          <option value="">All SLA</option>
          <option value="breached">Breached</option>
        </Select>
        <Button type="button" variant="secondary" onClick={() => router.replace(pathname, { scroll: false })}>
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
      className={cn("h-8", active && "border-[#0F3D91]/30 bg-[#0F3D91]/5 text-[#0F3D91]")}
      disabled={disabled}
      size="sm"
      type="button"
      variant="secondary"
      onClick={onClick}
    >
      <Star />
      {label}
    </Button>
  );
}
