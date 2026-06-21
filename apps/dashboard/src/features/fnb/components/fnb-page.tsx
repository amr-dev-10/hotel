"use client";

import { FormEvent, useMemo, useState } from "react";
import { ClipboardList, Plus, ReceiptText, Soup, Tags, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataState } from "@/components/ui/data-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  useCreateMenuCategory,
  useCreateMenuItem,
  useCreateTaxConfig,
  useDeleteMenuCategory,
  useDeleteMenuItem,
  useMenuCategories,
  useMenuItems,
  useRestaurantOrders,
  useTaxConfigs,
  useUpdateMenuCategory,
  useUpdateMenuItem,
  useUpdateOrderStatus,
  useUpdateTaxConfig,
} from "@/features/fnb/hooks/useFnb";
import { cn, money, titleCase } from "@/lib/utils";
import type { MenuCategory, MenuItem, RestaurantOrder, TaxConfig } from "@/types/domain";

const tabs = [
  { key: "menu", label: "Menu", icon: Soup },
  { key: "taxes", label: "Taxes", icon: ReceiptText },
  { key: "orders", label: "Orders", icon: ClipboardList },
] as const;

type TabKey = (typeof tabs)[number]["key"];

export function FnBPage({ hotelId }: { hotelId: string }) {
  const [tab, setTab] = useState<TabKey>("menu");

  return (
    <div className="grid gap-5">
      <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
        <div>
          <h2 className="text-xl font-semibold">Food & Beverage</h2>
          <p className="text-sm text-slate-500">Manage guest-facing menu, taxes, and restaurant orders.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {tabs.map((item) => {
            const Icon = item.icon;
            return (
              <Button
                className={cn(tab === item.key && "border-[#0F3D91]/30 bg-[#0F3D91]/5 text-[#0F3D91]")}
                key={item.key}
                type="button"
                variant="secondary"
                onClick={() => setTab(item.key)}
              >
                <Icon />
                {item.label}
              </Button>
            );
          })}
        </div>
      </div>

      {tab === "menu" ? <MenuManager hotelId={hotelId} /> : null}
      {tab === "taxes" ? <TaxManager hotelId={hotelId} /> : null}
      {tab === "orders" ? <OrdersManager hotelId={hotelId} /> : null}
    </div>
  );
}

function MenuManager({ hotelId }: { hotelId: string }) {
  const categories = useMenuCategories(hotelId);
  const items = useMenuItems(hotelId);
  const taxes = useTaxConfigs(hotelId);
  const createCategory = useCreateMenuCategory(hotelId);
  const updateCategory = useUpdateMenuCategory(hotelId);
  const deleteCategory = useDeleteMenuCategory(hotelId);
  const createItem = useCreateMenuItem(hotelId);
  const updateItem = useUpdateMenuItem(hotelId);
  const deleteItem = useDeleteMenuItem(hotelId);
  const [categoryName, setCategoryName] = useState("");
  const [itemName, setItemName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [price, setPrice] = useState("0");
  const [shortDescription, setShortDescription] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [tags, setTags] = useState("");
  const [selectedTaxes, setSelectedTaxes] = useState<string[]>([]);

  const categoryById = useMemo(() => {
    const map = new Map<string, MenuCategory>();
    for (const category of categories.data ?? []) {
      map.set(category.id, category);
    }
    return map;
  }, [categories.data]);

  async function submitCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await createCategory.mutateAsync(
      { name: categoryName, type: "food", is_active: true },
      {
        onSuccess: () => {
          toast.success("Category added");
          setCategoryName("");
        },
        onError: () => toast.error("Could not add category"),
      },
    );
  }

  async function submitItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await createItem.mutateAsync(
      {
        category_id: categoryId,
        name: itemName,
        price: Number(price || 0),
        description_short: shortDescription || null,
        description: description || null,
        image_url: imageUrl || null,
        dietary_tags: tags.split(",").map((tag) => tag.trim()).filter(Boolean),
        tax_config_ids: selectedTaxes,
        is_available: true,
      },
      {
        onSuccess: () => {
          toast.success("Menu item added");
          setItemName("");
          setPrice("0");
          setShortDescription("");
          setDescription("");
          setImageUrl("");
          setTags("");
          setSelectedTaxes([]);
        },
        onError: () => toast.error("Could not add menu item"),
      },
    );
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[360px_1fr]">
      <section className="grid gap-4">
        <form className="grid gap-3 rounded-md border border-slate-200 bg-white p-4" onSubmit={submitCategory}>
          <h3 className="text-sm font-semibold">Categories</h3>
          <label className="grid gap-1.5">
            <Label>Name</Label>
            <Input value={categoryName} onChange={(event) => setCategoryName(event.target.value)} />
          </label>
          <Button disabled={createCategory.isPending || categoryName.trim().length < 2} type="submit">
            <Plus />
            Add category
          </Button>
        </form>

        <section className="grid gap-2">
          {categories.isLoading ? <DataState isLoading /> : null}
          {(categories.data ?? []).map((category) => (
            <div className="flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-white p-3" key={category.id}>
              <div>
                <p className="text-sm font-semibold">{category.name}</p>
                <p className="text-xs text-slate-500">{category.is_active ? "Active" : "Hidden"}</p>
              </div>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  type="button"
                  variant="secondary"
                  onClick={() =>
                    updateCategory.mutate({
                      categoryId: category.id,
                      payload: { is_active: !category.is_active },
                    })
                  }
                >
                  {category.is_active ? "Hide" : "Show"}
                </Button>
                <Button
                  aria-label="Delete category"
                  size="icon"
                  type="button"
                  variant="ghost"
                  onClick={() => deleteCategory.mutate(category.id)}
                >
                  <Trash2 />
                </Button>
              </div>
            </div>
          ))}
        </section>
      </section>

      <section className="grid gap-4">
        <form className="grid gap-3 rounded-md border border-slate-200 bg-white p-4 lg:grid-cols-2" onSubmit={submitItem}>
          <h3 className="lg:col-span-2 text-sm font-semibold">Menu item</h3>
          <label className="grid gap-1.5">
            <Label>Category</Label>
            <Select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
              <option value="">Select category</option>
              {(categories.data ?? []).map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
          </label>
          <label className="grid gap-1.5">
            <Label>Name</Label>
            <Input value={itemName} onChange={(event) => setItemName(event.target.value)} />
          </label>
          <label className="grid gap-1.5">
            <Label>Price</Label>
            <Input min="0" step="0.01" type="number" value={price} onChange={(event) => setPrice(event.target.value)} />
          </label>
          <label className="grid gap-1.5">
            <Label>Dietary tags</Label>
            <Input placeholder="veg, spicy, gluten-free" value={tags} onChange={(event) => setTags(event.target.value)} />
          </label>
          <label className="grid gap-1.5 lg:col-span-2">
            <Label>Short description</Label>
            <Input value={shortDescription} onChange={(event) => setShortDescription(event.target.value)} />
          </label>
          <label className="grid gap-1.5 lg:col-span-2">
            <Label>Description</Label>
            <Textarea value={description} onChange={(event) => setDescription(event.target.value)} />
          </label>
          <label className="grid gap-1.5 lg:col-span-2">
            <Label>Image URL</Label>
            <Input value={imageUrl} onChange={(event) => setImageUrl(event.target.value)} />
          </label>
          <div className="grid gap-2 lg:col-span-2">
            <Label>Taxes</Label>
            <div className="flex flex-wrap gap-2">
              {(taxes.data ?? []).map((tax) => (
                <button
                  className={cn(
                    "rounded-md border border-slate-200 px-3 py-2 text-xs font-semibold",
                    selectedTaxes.includes(tax.id) && "border-emerald-600 bg-emerald-50 text-emerald-700",
                  )}
                  key={tax.id}
                  type="button"
                  onClick={() =>
                    setSelectedTaxes((current) =>
                      current.includes(tax.id) ? current.filter((id) => id !== tax.id) : [...current, tax.id],
                    )
                  }
                >
                  {tax.name} · {Number(tax.rate_percent)}%
                </button>
              ))}
            </div>
          </div>
          <Button className="lg:col-span-2" disabled={createItem.isPending || !categoryId || itemName.length < 2} type="submit">
            <Plus />
            Add item
          </Button>
        </form>

        {items.error ? <DataState error={items.error} /> : null}
        <section className="grid gap-3">
          {(items.data ?? []).map((item) => (
            <MenuItemRow
              categoryName={categoryById.get(item.category_id)?.name ?? "Category"}
              item={item}
              key={item.id}
              onDelete={() => deleteItem.mutate(item.id)}
              onToggle={() =>
                updateItem.mutate({
                  itemId: item.id,
                  payload: { is_available: !item.is_available },
                })
              }
            />
          ))}
        </section>
      </section>
    </div>
  );
}

function MenuItemRow({
  categoryName,
  item,
  onDelete,
  onToggle,
}: {
  categoryName: string;
  item: MenuItem;
  onDelete: () => void;
  onToggle: () => void;
}) {
  return (
    <article className="grid gap-3 rounded-md border border-slate-200 bg-white p-4 md:grid-cols-[1fr_auto] md:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h4 className="truncate text-sm font-semibold">{item.name}</h4>
          <Badge variant={item.is_available ? "green" : "default"}>{item.is_available ? "Available" : "Hidden"}</Badge>
          <Badge>{categoryName}</Badge>
        </div>
        <p className="mt-1 text-sm font-semibold text-emerald-700">{money(item.price)}</p>
        <p className="mt-1 line-clamp-2 text-xs text-slate-500">{item.description_short || item.description || "No description"}</p>
        {item.dietary_tags.length ? (
          <div className="mt-2 flex flex-wrap gap-1">
            {item.dietary_tags.map((tag) => (
              <Badge key={tag} variant="teal">
                <Tags className="mr-1 size-3" />
                {tag}
              </Badge>
            ))}
          </div>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2 md:justify-end">
        <Button size="sm" type="button" variant="secondary" onClick={onToggle}>
          {item.is_available ? "Hide" : "Show"}
        </Button>
        <Button aria-label="Delete menu item" size="icon" type="button" variant="ghost" onClick={onDelete}>
          <Trash2 />
        </Button>
      </div>
    </article>
  );
}

function TaxManager({ hotelId }: { hotelId: string }) {
  const taxes = useTaxConfigs(hotelId);
  const createTax = useCreateTaxConfig(hotelId);
  const updateTax = useUpdateTaxConfig(hotelId);
  const [name, setName] = useState("");
  const [rate, setRate] = useState("5");
  const [appliesTo, setAppliesTo] = useState("food");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await createTax.mutateAsync(
      { name, rate_percent: Number(rate || 0), applies_to: appliesTo, is_active: true },
      {
        onSuccess: () => {
          toast.success("Tax added");
          setName("");
          setRate("5");
        },
        onError: () => toast.error("Could not add tax"),
      },
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
      <form className="grid gap-3 rounded-md border border-slate-200 bg-white p-4" onSubmit={submit}>
        <h3 className="text-sm font-semibold">Tax rule</h3>
        <label className="grid gap-1.5">
          <Label>Name</Label>
          <Input value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <label className="grid gap-1.5">
          <Label>Rate %</Label>
          <Input min="0" step="0.01" type="number" value={rate} onChange={(event) => setRate(event.target.value)} />
        </label>
        <label className="grid gap-1.5">
          <Label>Applies to</Label>
          <Select value={appliesTo} onChange={(event) => setAppliesTo(event.target.value)}>
            <option value="food">Food</option>
            <option value="beverage">Beverage</option>
            <option value="all">All</option>
          </Select>
        </label>
        <Button disabled={createTax.isPending || name.length < 1} type="submit">
          <Plus />
          Add tax
        </Button>
      </form>
      <section className="grid gap-3">
        {taxes.isLoading ? <DataState isLoading /> : null}
        {(taxes.data ?? []).map((tax: TaxConfig) => (
          <article className="flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-white p-4" key={tax.id}>
            <div>
              <h4 className="text-sm font-semibold">{tax.name}</h4>
              <p className="text-xs text-slate-500">
                {Number(tax.rate_percent)}% · {titleCase(tax.applies_to)}
              </p>
            </div>
            <Button
              size="sm"
              type="button"
              variant="secondary"
              onClick={() => updateTax.mutate({ taxId: tax.id, payload: { is_active: !tax.is_active } })}
            >
              {tax.is_active ? "Disable" : "Enable"}
            </Button>
          </article>
        ))}
      </section>
    </div>
  );
}

function OrdersManager({ hotelId }: { hotelId: string }) {
  const [status, setStatus] = useState("");
  const orders = useRestaurantOrders(hotelId, status ? { status } : {});
  const updateStatus = useUpdateOrderStatus(hotelId);

  return (
    <div className="grid gap-4">
      <section className="flex flex-col justify-between gap-3 rounded-md border border-slate-200 bg-white p-4 md:flex-row md:items-end">
        <div>
          <h3 className="text-sm font-semibold">Orders</h3>
          <p className="text-sm text-slate-500">Track guest portal, room service, WhatsApp, and POS orders.</p>
        </div>
        <label className="grid gap-1.5 md:w-56">
          <Label>Status</Label>
          <Select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">All</option>
            <option value="received">Received</option>
            <option value="preparing">Preparing</option>
            <option value="ready">Ready</option>
            <option value="delivered">Delivered</option>
          </Select>
        </label>
      </section>

      {orders.isLoading ? <DataState isLoading /> : null}
      {orders.error ? <DataState error={orders.error} /> : null}
      {!orders.isLoading && !orders.data?.length ? <DataState empty emptyTitle="No restaurant orders in this view." /> : null}

      <section className="grid gap-3">
        {(orders.data ?? []).map((order) => (
          <OrderRow
            key={order.id}
            order={order}
            onStatus={(nextStatus) => updateStatus.mutate({ orderId: order.id, status: nextStatus })}
          />
        ))}
      </section>
    </div>
  );
}

function OrderRow({
  order,
  onStatus,
}: {
  order: RestaurantOrder;
  onStatus: (status: string) => void;
}) {
  return (
    <article className="grid gap-3 rounded-md border border-slate-200 bg-white p-4 lg:grid-cols-[1fr_auto] lg:items-center">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h4 className="text-sm font-semibold">{order.order_number}</h4>
          <Badge variant={order.ordered_by_guest ? "green" : "default"}>{order.ordered_by_guest ? "Guest" : titleCase(order.source)}</Badge>
          <Badge variant={statusVariant(order.status)}>{titleCase(order.status)}</Badge>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          {money(order.total)} · Room {order.room_id ? order.room_id.slice(0, 8) : "table/POS"}
        </p>
        {order.special_instructions ? <p className="mt-2 text-xs text-slate-500">{order.special_instructions}</p> : null}
      </div>
      <div className="flex flex-wrap gap-2 lg:justify-end">
        {["received", "preparing", "ready", "delivered"].map((nextStatus) => (
          <Button
            disabled={order.status === nextStatus}
            key={nextStatus}
            size="sm"
            type="button"
            variant="secondary"
            onClick={() => onStatus(nextStatus)}
          >
            {titleCase(nextStatus)}
          </Button>
        ))}
      </div>
    </article>
  );
}

function statusVariant(status: string) {
  if (status === "delivered") return "green";
  if (status === "ready") return "blue";
  if (status === "preparing") return "amber";
  return "default";
}
