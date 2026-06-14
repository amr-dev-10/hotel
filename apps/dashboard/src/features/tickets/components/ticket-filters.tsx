"use client";

import { Filter, Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

export function TicketFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function updateParam(key: string, value: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (value) {
      next.set(key, value);
    } else {
      next.delete(key);
    }
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }

  return (
    <div className="grid gap-3 rounded-md border border-slate-200 bg-white p-4 shadow-sm lg:grid-cols-[1fr_200px_200px_auto]">
      <label className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
        <Input
          className="pl-9"
          defaultValue={searchParams.get("q") ?? ""}
          placeholder="Search ticket code, item, room or assignee"
          onChange={(event) => updateParam("q", event.target.value)}
        />
      </label>
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
      <Button type="button" variant="secondary" onClick={() => router.replace(pathname, { scroll: false })}>
        <Filter />
        Reset
      </Button>
    </div>
  );
}
