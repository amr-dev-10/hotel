"use client";

import { FormEvent, useEffect, useState } from "react";
import { formatDistanceToNowStrict } from "date-fns";
import { ConciergeBell, Send } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataState } from "@/components/ui/data-state";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  useCreateGuestRequest,
  useGuestProfile,
  useGuestRequestCategories,
  useGuestRequests,
} from "@/features/guest-portal/hooks/useGuestPortal";
import { titleCase } from "@/lib/utils";
import { useGuestSessionStore } from "@/stores/guest-session.store";

export function GuestRequestsPage() {
  const token = useGuestSessionStore((state) => state.token);
  useGuestProfile();
  const requests = useGuestRequests();
  const categories = useGuestRequestCategories();
  const createRequest = useCreateGuestRequest();
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");

  useEffect(() => {
    if (!categoryId && categories.data?.length) {
      setCategoryId(categories.data[0].id);
    }
  }, [categories.data, categoryId]);

  if (!token) {
    return <DataState empty emptyTitle="Please verify your stay to request service." />;
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const category = categories.data?.find((item) => item.id === categoryId);
    await createRequest.mutateAsync(
      {
        item_description: description,
        task_category_id: category?.id,
        task_category: category?.key,
        priority: category?.default_priority ?? 2,
      },
      {
        onSuccess: () => {
          toast.success("Request sent");
          setDescription("");
        },
        onError: () => toast.error("Could not send request"),
      },
    );
  }

  return (
    <div className="grid gap-4">
      <section>
        <p className="text-xs font-semibold uppercase tracking-normal text-emerald-700">Service</p>
        <h2 className="mt-1 text-xl font-semibold">Request hotel assistance</h2>
      </section>

      <form className="grid gap-3 rounded-md border border-slate-200 bg-white p-4" onSubmit={onSubmit}>
        <label className="grid gap-1.5">
          <Label>Category</Label>
          <Select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
            {(categories.data ?? []).map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </Select>
        </label>
        <label className="grid gap-1.5">
          <Label>Request</Label>
          <Textarea
            placeholder="Tell us what you need"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </label>
        <Button disabled={createRequest.isPending || description.trim().length < 3 || !categoryId} type="submit">
          <Send />
          Send request
        </Button>
      </form>

      <section className="grid gap-3">
        <div className="flex items-center gap-2">
          <ConciergeBell className="size-4 text-slate-500" />
          <h3 className="text-sm font-semibold">My requests</h3>
        </div>
        {requests.isLoading ? <DataState isLoading /> : null}
        {requests.error ? <DataState error={requests.error} /> : null}
        {!requests.isLoading && !requests.data?.length ? <DataState empty emptyTitle="No service requests yet." /> : null}
        {(requests.data ?? []).map((ticket) => (
          <article className="rounded-md border border-slate-200 bg-white p-4" key={ticket.id}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h4 className="text-sm font-semibold">{ticket.item_description}</h4>
                <p className="mt-1 text-xs text-slate-500">
                  {formatDistanceToNowStrict(new Date(ticket.created_at), { addSuffix: true })}
                </p>
              </div>
              <Badge>{titleCase(ticket.stage)}</Badge>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
