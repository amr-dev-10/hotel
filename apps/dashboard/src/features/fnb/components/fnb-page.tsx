"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  ClipboardList,
  Coffee,
  Copy,
  Download,
  FileUp,
  ImageIcon,
  MoreVertical,
  Pencil,
  Plus,
  ReceiptText,
  Search,
  ShoppingCart,
  SlidersHorizontal,
  Soup,
  Tags,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  type CategoryPayload,
  type MenuItemPayload,
  type RestaurantOrderPayload,
  type TaxPayload,
  useCreateMenuCategory,
  useCreateMenuItem,
  useCreateRestaurantOrder,
  useCreateTaxConfig,
  useDeleteMenuCategory,
  useDeleteMenuItem,
  useMenuCategories,
  useMenuItems,
  useRestaurantOrder,
  useRestaurantOrders,
  useTaxConfigs,
  useUpdateMenuCategory,
  useUpdateMenuItem,
  useUpdateRestaurantOrder,
  useUpdateOrderStatus,
  useUpdateTaxConfig,
} from "@/features/fnb/hooks/useFnb";
import { useGuests } from "@/features/guests/hooks/useGuests";
import { useRooms } from "@/features/rooms/hooks/useRooms";
import { cn, compactId, money, titleCase } from "@/lib/utils";
import type { MenuCategory, MenuItem, RestaurantOrder, TaxConfig } from "@/types/domain";

const sections = [
  { key: "menu", label: "Menu", icon: Soup },
  { key: "categories", label: "Categories", icon: Tags },
  { key: "taxes", label: "Taxes", icon: ReceiptText },
  { key: "orders", label: "Orders", icon: ClipboardList },
] as const;

const sortOptions = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "price_low", label: "Price Low to High" },
  { value: "price_high", label: "Price High to Low" },
  { value: "name_az", label: "Name A to Z" },
  { value: "name_za", label: "Name Z to A" },
  { value: "most_ordered", label: "Most Ordered" },
];

const orderColumns = [
  { key: "received", label: "Pending" },
  { key: "preparing", label: "Preparing" },
  { key: "ready", label: "Ready" },
  { key: "delivered", label: "Delivered" },
  { key: "cancelled", label: "Cancelled" },
];

type SectionKey = (typeof sections)[number]["key"];
type ItemDrawerState = { mode: "new"; kind: "food" | "beverage" } | { mode: "edit"; item: MenuItem };
type CategoryDialogState = { mode: "new" } | { mode: "edit"; category: MenuCategory };
type TaxDialogState = { mode: "new" } | { mode: "edit"; tax: TaxConfig };
type OrderDrawerState = { mode: "new" } | { mode: "edit"; order: RestaurantOrder };

export function FnBPage({ hotelId }: { hotelId: string }) {
  const categories = useMenuCategories(hotelId);
  const items = useMenuItems(hotelId);
  const taxes = useTaxConfigs(hotelId);
  const createCategory = useCreateMenuCategory(hotelId);
  const updateCategory = useUpdateMenuCategory(hotelId);
  const deleteCategory = useDeleteMenuCategory(hotelId);
  const createItem = useCreateMenuItem(hotelId);
  const updateItem = useUpdateMenuItem(hotelId);
  const deleteItem = useDeleteMenuItem(hotelId);
  const createTax = useCreateTaxConfig(hotelId);
  const updateTax = useUpdateTaxConfig(hotelId);
  const [section, setSection] = useState<SectionKey>("menu");
  const [itemDrawer, setItemDrawer] = useState<ItemDrawerState | null>(null);
  const [categoryDialog, setCategoryDialog] = useState<CategoryDialogState | null>(null);
  const [taxDialog, setTaxDialog] = useState<TaxDialogState | null>(null);
  const [orderDrawer, setOrderDrawer] = useState<OrderDrawerState | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const categoryById = useMemo(() => {
    const map = new Map<string, MenuCategory>();
    for (const category of categories.data ?? []) {
      map.set(category.id, category);
    }
    return map;
  }, [categories.data]);

  function exportMenu() {
    const rows = [
      ["name", "category", "price", "available", "tax_ids", "tags", "prep_minutes"],
      ...(items.data ?? []).map((item) => [
        item.name,
        categoryById.get(item.category_id)?.name ?? item.category_id,
        String(item.price),
        item.is_available ? "yes" : "no",
        item.tax_config_ids.join("|"),
        item.dietary_tags.join("|"),
        String(item.preparation_time_minutes),
      ]),
    ];
    const csv = rows.map((row) => row.map(csvCell).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "fnb-menu.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function importMenu(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    const text = await file.text();
    const rows = parseCsv(text);
    const [header, ...dataRows] = rows;
    const headerIndex = new Map(header.map((name, index) => [name.trim().toLowerCase(), index]));
    let created = 0;
    for (const row of dataRows) {
      const name = row[headerIndex.get("name") ?? -1]?.trim();
      const categoryValue = row[headerIndex.get("category") ?? -1]?.trim();
      if (!name) {
        continue;
      }
      const category =
        (categories.data ?? []).find((item) => item.id === categoryValue || item.name.toLowerCase() === categoryValue?.toLowerCase()) ??
        categories.data?.[0];
      if (!category) {
        continue;
      }
      await createItem.mutateAsync({
        category_id: category.id,
        name,
        price: Number(row[headerIndex.get("price") ?? -1] ?? 0),
        is_available: (row[headerIndex.get("available") ?? -1] ?? "yes").toLowerCase() !== "no",
        dietary_tags: splitPiped(row[headerIndex.get("tags") ?? -1]),
        preparation_time_minutes: Number(row[headerIndex.get("prep_minutes") ?? -1] ?? 15),
        tax_config_ids: splitPiped(row[headerIndex.get("tax_ids") ?? -1]),
      });
      created += 1;
    }
    event.target.value = "";
    toast.success(`Imported ${created} item${created === 1 ? "" : "s"}`);
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-col justify-between gap-3 xl:flex-row xl:items-center">
        <div>
          <h2 className="text-xl font-semibold">Food & Beverage</h2>
          <p className="text-sm text-slate-500">Manage menu, categories, taxes, and kitchen-ready orders.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {sections.map((item) => {
            const Icon = item.icon;
            return (
              <Button
                className={cn(section === item.key && "border-[#0F3D91]/30 bg-[#0F3D91]/5 text-[#0F3D91]")}
                key={item.key}
                type="button"
                variant="secondary"
                onClick={() => setSection(item.key)}
              >
                <Icon />
                {item.label}
              </Button>
            );
          })}
        </div>
      </div>

      <section className="flex flex-wrap gap-2 rounded-md border border-slate-200 bg-white p-3">
        <Button type="button" onClick={() => setItemDrawer({ mode: "new", kind: "food" })}>
          <Plus />
          Food Item
        </Button>
        <Button type="button" variant="secondary" onClick={() => setItemDrawer({ mode: "new", kind: "beverage" })}>
          <Coffee />
          Beverage
        </Button>
        <Button type="button" variant="secondary" onClick={() => setCategoryDialog({ mode: "new" })}>
          <Plus />
          Category
        </Button>
        <Button type="button" variant="secondary" onClick={() => setTaxDialog({ mode: "new" })}>
          <ReceiptText />
          Tax
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            setSection("orders");
            setOrderDrawer({ mode: "new" });
          }}
        >
          <ShoppingCart />
          Staff Order
        </Button>
        <Button type="button" variant="secondary" onClick={() => fileInputRef.current?.click()}>
          <FileUp />
          Import Menu
        </Button>
        <Button type="button" variant="secondary" onClick={exportMenu}>
          <Download />
          Export Menu
        </Button>
        <input ref={fileInputRef} accept=".csv" className="hidden" type="file" onChange={importMenu} />
      </section>

      {section === "menu" ? (
        <MenuWorkspace
          categories={categories.data ?? []}
          categoryById={categoryById}
          deleteCategory={(categoryId) => deleteCategory.mutate(categoryId)}
          deleteItem={(itemId) => deleteItem.mutate(itemId)}
          isLoading={items.isLoading || categories.isLoading}
          items={items.data ?? []}
          openCategoryDialog={setCategoryDialog}
          openItemDrawer={setItemDrawer}
          taxes={taxes.data ?? []}
          toggleItem={(item) =>
            updateItem.mutate({
              itemId: item.id,
              payload: { is_available: !item.is_available },
            })
          }
          duplicateItem={(item) =>
            createItem.mutate({
              category_id: item.category_id,
              name: `${item.name} Copy`,
              price: Number(item.price),
              description: item.description,
              description_short: item.description_short,
              dietary_tags: item.dietary_tags,
              preparation_time_minutes: item.preparation_time_minutes,
              image_url: item.image_url,
              is_available: false,
              display_order: item.display_order,
              tax_config_ids: item.tax_config_ids,
            })
          }
        />
      ) : null}

      {section === "categories" ? (
        <CategoryManagement
          categories={categories.data ?? []}
          deleteCategory={(categoryId) => deleteCategory.mutate(categoryId)}
          itemCounts={categoryCounts(items.data ?? [])}
          openCategoryDialog={setCategoryDialog}
          toggleCategory={(category) =>
            updateCategory.mutate({
              categoryId: category.id,
              payload: { is_active: !category.is_active },
            })
          }
        />
      ) : null}

      {section === "taxes" ? (
        <TaxManagement
          openTaxDialog={setTaxDialog}
          taxes={taxes.data ?? []}
          toggleTax={(tax) =>
            updateTax.mutate({
              taxId: tax.id,
              payload: { is_active: !tax.is_active },
            })
          }
        />
      ) : null}

      {section === "orders" ? (
        <OrdersPage
          closeOrderForm={() => setOrderDrawer(null)}
          hotelId={hotelId}
          items={items.data ?? []}
          openOrderDrawer={setOrderDrawer}
          orderForm={orderDrawer}
        />
      ) : null}

      <ItemDrawer
        categories={categories.data ?? []}
        createItem={createItem.mutateAsync}
        drawer={itemDrawer}
        onClose={() => setItemDrawer(null)}
        taxes={taxes.data ?? []}
        updateItem={(itemId, payload) => updateItem.mutateAsync({ itemId, payload })}
      />
      <CategoryDialog
        createCategory={createCategory.mutateAsync}
        dialog={categoryDialog}
        onClose={() => setCategoryDialog(null)}
        updateCategory={(categoryId, payload) => updateCategory.mutateAsync({ categoryId, payload })}
      />
      <TaxDialog
        createTax={createTax.mutateAsync}
        dialog={taxDialog}
        onClose={() => setTaxDialog(null)}
        updateTax={(taxId, payload) => updateTax.mutateAsync({ taxId, payload })}
      />
    </div>
  );
}

function MenuWorkspace({
  categories,
  categoryById,
  deleteCategory,
  deleteItem,
  duplicateItem,
  isLoading,
  items,
  openCategoryDialog,
  openItemDrawer,
  taxes,
  toggleItem,
}: {
  categories: MenuCategory[];
  categoryById: Map<string, MenuCategory>;
  deleteCategory: (categoryId: string) => void;
  deleteItem: (itemId: string) => void;
  duplicateItem: (item: MenuItem) => void;
  isLoading: boolean;
  items: MenuItem[];
  openCategoryDialog: (dialog: CategoryDialogState) => void;
  openItemDrawer: (drawer: ItemDrawerState) => void;
  taxes: TaxConfig[];
  toggleItem: (item: MenuItem) => void;
}) {
  const [categoryId, setCategoryId] = useState("");
  const [categorySearch, setCategorySearch] = useState("");
  const [search, setSearch] = useState("");
  const [availability, setAvailability] = useState("");
  const [sort, setSort] = useState("newest");
  const [taxId, setTaxId] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const counts = useMemo(() => categoryCounts(items), [items]);

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    const min = minPrice ? Number(minPrice) : null;
    const max = maxPrice ? Number(maxPrice) : null;
    const rows = items.filter((item) => {
      const price = Number(item.price ?? 0);
      const matchesSearch =
        !query ||
        item.name.toLowerCase().includes(query) ||
        (item.description ?? "").toLowerCase().includes(query) ||
        (item.description_short ?? "").toLowerCase().includes(query);
      return (
        matchesSearch &&
        (!categoryId || item.category_id === categoryId) &&
        (!availability || (availability === "available" ? item.is_available : !item.is_available)) &&
        (!taxId || item.tax_config_ids.includes(taxId)) &&
        (min === null || price >= min) &&
        (max === null || price <= max)
      );
    });
    return sortItems(rows, sort);
  }, [availability, categoryId, items, maxPrice, minPrice, search, sort, taxId]);

  const visibleCategories = categories.filter((category) =>
    category.name.toLowerCase().includes(categorySearch.trim().toLowerCase()),
  );

  return (
    <div className="grid gap-4">
      <section className="grid gap-3 rounded-md border border-slate-200 bg-white p-3 xl:grid-cols-[1.5fr_180px_150px_120px_140px_160px]">
        <label className="relative">
          <span className="sr-only">Search menu</span>
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input className="pl-9" placeholder="Search menu items" value={search} onChange={(event) => setSearch(event.target.value)} />
        </label>
        <Select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
          <option value="">All categories</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </Select>
        <Select value={availability} onChange={(event) => setAvailability(event.target.value)}>
          <option value="">Availability</option>
          <option value="available">Available</option>
          <option value="hidden">Hidden</option>
        </Select>
        <Input min="0" placeholder="Min price" type="number" value={minPrice} onChange={(event) => setMinPrice(event.target.value)} />
        <Input min="0" placeholder="Max price" type="number" value={maxPrice} onChange={(event) => setMaxPrice(event.target.value)} />
        <Select value={sort} onChange={(event) => setSort(event.target.value)}>
          {sortOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
        <Select className="xl:col-span-2" value={taxId} onChange={(event) => setTaxId(event.target.value)}>
          <option value="">Tax</option>
          {taxes.map((tax) => (
            <option key={tax.id} value={tax.id}>
              {tax.name}
            </option>
          ))}
        </Select>
        <Select value={availability} onChange={(event) => setAvailability(event.target.value)}>
          <option value="">Status</option>
          <option value="available">Active</option>
          <option value="hidden">Hidden</option>
        </Select>
      </section>

      <div className="grid gap-4 xl:grid-cols-[280px_1fr]">
        <aside className="grid content-start gap-3 rounded-md border border-slate-200 bg-white p-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">Categories</h3>
            <Button aria-label="Create category" size="icon" type="button" variant="ghost" onClick={() => openCategoryDialog({ mode: "new" })}>
              <Plus />
            </Button>
          </div>
          <label className="relative">
            <span className="sr-only">Search categories</span>
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input className="pl-9" placeholder="Search" value={categorySearch} onChange={(event) => setCategorySearch(event.target.value)} />
          </label>
          <CategoryTreeButton active={!categoryId} count={items.length} label="All Items" onClick={() => setCategoryId("")} />
          {visibleCategories.map((category) => (
            <div className="flex items-center gap-1" key={category.id}>
              <CategoryTreeButton
                active={category.id === categoryId}
                count={counts.get(category.id) ?? 0}
                label={category.name}
                onClick={() => setCategoryId(category.id)}
              />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button aria-label="Category actions" size="icon" type="button" variant="ghost">
                    <MoreVertical />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => openCategoryDialog({ mode: "edit", category })}>
                    <Pencil />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => toast.info("Select items and change category from the item drawer")}>
                    <SlidersHorizontal />
                    Move Items
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-rose-700" onClick={() => deleteCategory(category.id)}>
                    <Trash2 />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
        </aside>

        <section className="grid content-start gap-3">
          <div className="flex flex-col justify-between gap-2 rounded-md border border-slate-200 bg-white p-3 md:flex-row md:items-center">
            <div>
              <h3 className="text-sm font-semibold">Menu Items</h3>
              <p className="text-sm text-slate-500">Total Items: {filteredItems.length}</p>
            </div>
            <Button type="button" onClick={() => openItemDrawer({ mode: "new", kind: "food" })}>
              <Plus />
              Food Item
            </Button>
          </div>
          {isLoading ? <DataState isLoading /> : null}
          {!isLoading && !filteredItems.length ? <DataState empty emptyTitle="No menu items match these filters." /> : null}
          <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
            {filteredItems.map((item) => (
              <MenuItemCard
                categoryName={categoryById.get(item.category_id)?.name ?? "Category"}
                deleteItem={() => deleteItem(item.id)}
                duplicateItem={() => duplicateItem(item)}
                item={item}
                key={item.id}
                openItem={() => openItemDrawer({ mode: "edit", item })}
                taxes={taxes}
                toggleItem={() => toggleItem(item)}
              />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function CategoryTreeButton({
  active,
  count,
  label,
  onClick,
}: {
  active: boolean;
  count: number;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={cn(
        "flex min-h-9 flex-1 items-center justify-between gap-2 rounded-md px-3 text-left text-sm font-medium text-slate-600 hover:bg-slate-100",
        active && "bg-[#0F3D91] text-white hover:bg-[#0F3D91]",
      )}
      type="button"
      onClick={onClick}
    >
      <span className="truncate">{label}</span>
      <span className={cn("rounded bg-slate-100 px-1.5 text-xs text-slate-500", active && "bg-white/15 text-white")}>
        {count}
      </span>
    </button>
  );
}

function MenuItemCard({
  categoryName,
  deleteItem,
  duplicateItem,
  item,
  openItem,
  taxes,
  toggleItem,
}: {
  categoryName: string;
  deleteItem: () => void;
  duplicateItem: () => void;
  item: MenuItem;
  openItem: () => void;
  taxes: TaxConfig[];
  toggleItem: () => void;
}) {
  const itemTaxes = taxes.filter((tax) => item.tax_config_ids.includes(tax.id));
  return (
    <article
      className="grid cursor-pointer overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm transition-colors hover:border-[#0F3D91]/40"
      onClick={openItem}
    >
      <div className="flex aspect-[16/9] items-center justify-center bg-slate-100">
        {item.image_url ? (
          <img alt="" className="h-full w-full object-cover" src={item.image_url} />
        ) : (
          <ImageIcon className="size-10 text-slate-400" />
        )}
      </div>
      <div className="grid gap-3 p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h4 className="truncate text-sm font-semibold">{item.name}</h4>
            <p className="mt-1 text-xs text-slate-500">{categoryName}</p>
          </div>
          <Badge variant={item.is_available ? "green" : "default"}>{item.is_available ? "Available" : "Hidden"}</Badge>
        </div>
        <div>
          <p className="text-lg font-semibold text-emerald-700">{money(item.price)}</p>
          <p className="text-xs text-slate-500">
            {itemTaxes.length ? itemTaxes.map((tax) => `${tax.name} ${tax.tax_type === "fixed" ? money(tax.fixed_amount) : `${Number(tax.rate_percent)}%`}`).join(", ") : "No tax"}
          </p>
        </div>
        <p className="line-clamp-2 min-h-10 text-xs leading-5 text-slate-500">
          {item.description_short || item.description || "No description"}
        </p>
        <div className="flex flex-wrap gap-1">
          {item.dietary_tags.slice(0, 3).map((tag) => (
            <Badge key={tag} variant="teal">
              {tag}
            </Badge>
          ))}
        </div>
        <div className="grid grid-cols-4 gap-2 pt-1">
          <CardAction icon={<Pencil />} label="Edit" onClick={openItem} />
          <CardAction icon={<Copy />} label="Duplicate" onClick={duplicateItem} />
          <CardAction icon={<CheckCircle2 />} label={item.is_available ? "Hide" : "Show"} onClick={toggleItem} />
          <CardAction danger icon={<Trash2 />} label="Delete" onClick={deleteItem} />
        </div>
      </div>
    </article>
  );
}

function CardAction({
  danger,
  icon,
  label,
  onClick,
}: {
  danger?: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={cn(
        "grid min-h-12 place-items-center gap-1 rounded-md border border-slate-200 px-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50",
        danger && "text-rose-700",
      )}
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
    >
      <span className="[&_svg]:size-4">{icon}</span>
      <span className="truncate">{label}</span>
    </button>
  );
}

function ItemDrawer({
  categories,
  createItem,
  drawer,
  onClose,
  taxes,
  updateItem,
}: {
  categories: MenuCategory[];
  createItem: (payload: MenuItemPayload) => Promise<unknown>;
  drawer: ItemDrawerState | null;
  onClose: () => void;
  taxes: TaxConfig[];
  updateItem: (itemId: string, payload: Partial<MenuItemPayload>) => Promise<unknown>;
}) {
  const [form, setForm] = useState<MenuItemForm>(emptyItemForm());

  useEffect(() => {
    if (!drawer) {
      return;
    }
    if (drawer.mode === "edit") {
      setForm({
        category_id: drawer.item.category_id,
        name: drawer.item.name,
        price: String(drawer.item.price ?? 0),
        description: drawer.item.description ?? "",
        description_short: drawer.item.description_short ?? "",
        dietary_tags: drawer.item.dietary_tags.join(", "),
        preparation_time_minutes: String(drawer.item.preparation_time_minutes ?? 15),
        image_url: drawer.item.image_url ?? "",
        is_available: drawer.item.is_available,
        display_order: String(drawer.item.display_order ?? 0),
        tax_config_ids: drawer.item.tax_config_ids,
      });
      return;
    }
    const preferred = categories.find((category) => category.type === drawer.kind && category.is_active) ?? categories[0];
    setForm({ ...emptyItemForm(), category_id: preferred?.id ?? "" });
  }, [categories, drawer]);

  if (!drawer) {
    return null;
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = itemPayload(form);
    if (drawer?.mode === "edit") {
      await updateItem(drawer.item.id, payload);
      toast.success("Menu item updated");
    } else {
      await createItem(payload);
      toast.success("Menu item added");
    }
    onClose();
  }

  return (
    <>
      <button aria-label="Close item drawer" className="fixed inset-0 z-40 bg-slate-950/30" type="button" onClick={onClose} />
      <aside className="fixed inset-y-0 right-0 z-50 grid w-full max-w-xl content-start gap-4 overflow-y-auto border-l border-slate-200 bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">Item detail</p>
            <h3 className="mt-1 text-lg font-semibold">{drawer.mode === "edit" ? drawer.item.name : "New menu item"}</h3>
          </div>
          <Button aria-label="Close drawer" size="icon" type="button" variant="ghost" onClick={onClose}>
            <X />
          </Button>
        </div>

        <form className="grid gap-4" onSubmit={save}>
          <div className="flex aspect-[16/9] items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-slate-100">
            {form.image_url ? (
              <img alt="" className="h-full w-full object-cover" src={form.image_url} />
            ) : (
              <ImageIcon className="size-12 text-slate-400" />
            )}
          </div>

          <Field label="Image URL">
            <Input value={form.image_url} onChange={(event) => setFormField(setForm, "image_url", event.target.value)} />
          </Field>
          <Field label="Name">
            <Input required value={form.name} onChange={(event) => setFormField(setForm, "name", event.target.value)} />
          </Field>
          <Field label="Description">
            <Textarea value={form.description} onChange={(event) => setFormField(setForm, "description", event.target.value)} />
          </Field>
          <Field label="Short description">
            <Input value={form.description_short} onChange={(event) => setFormField(setForm, "description_short", event.target.value)} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Category">
              <Select required value={form.category_id} onChange={(event) => setFormField(setForm, "category_id", event.target.value)}>
                <option value="">Select category</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Price">
              <Input min="0" required step="0.01" type="number" value={form.price} onChange={(event) => setFormField(setForm, "price", event.target.value)} />
            </Field>
          </div>
          <Field label="Taxes">
            <div className="grid gap-2">
              {taxes.map((tax) => (
                <label className="flex min-h-10 items-center gap-3 rounded-md border border-slate-200 px-3 text-sm" key={tax.id}>
                  <input
                    checked={form.tax_config_ids.includes(tax.id)}
                    type="checkbox"
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        tax_config_ids: event.target.checked
                          ? [...current.tax_config_ids, tax.id]
                          : current.tax_config_ids.filter((id) => id !== tax.id),
                      }))
                    }
                  />
                  <span>{tax.name}</span>
                  <span className="ml-auto text-xs text-slate-500">
                    {tax.tax_type === "fixed" ? money(tax.fixed_amount) : `${Number(tax.rate_percent)}%`}
                  </span>
                </label>
              ))}
            </div>
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Availability">
              <Select value={form.is_available ? "available" : "hidden"} onChange={(event) => setFormField(setForm, "is_available", event.target.value === "available")}>
                <option value="available">Available</option>
                <option value="hidden">Hidden</option>
              </Select>
            </Field>
            <Field label="Preparation time">
              <Input min="0" type="number" value={form.preparation_time_minutes} onChange={(event) => setFormField(setForm, "preparation_time_minutes", event.target.value)} />
            </Field>
            <Field label="Display order">
              <Input type="number" value={form.display_order} onChange={(event) => setFormField(setForm, "display_order", event.target.value)} />
            </Field>
          </div>
          <Field label="Dietary tags">
            <Input placeholder="veg, spicy, gluten-free" value={form.dietary_tags} onChange={(event) => setFormField(setForm, "dietary_tags", event.target.value)} />
          </Field>
          <Button disabled={!form.name || !form.category_id} type="submit">
            Save
          </Button>
        </form>
      </aside>
    </>
  );
}

type MenuItemForm = {
  category_id: string;
  name: string;
  price: string;
  description: string;
  description_short: string;
  dietary_tags: string;
  preparation_time_minutes: string;
  image_url: string;
  is_available: boolean;
  display_order: string;
  tax_config_ids: string[];
};

function emptyItemForm(): MenuItemForm {
  return {
    category_id: "",
    name: "",
    price: "0",
    description: "",
    description_short: "",
    dietary_tags: "",
    preparation_time_minutes: "15",
    image_url: "",
    is_available: true,
    display_order: "0",
    tax_config_ids: [],
  };
}

function itemPayload(form: MenuItemForm) {
  return {
    category_id: form.category_id,
    name: form.name,
    price: Number(form.price || 0),
    description: form.description || null,
    description_short: form.description_short || null,
    dietary_tags: form.dietary_tags.split(",").map((tag) => tag.trim()).filter(Boolean),
    preparation_time_minutes: Number(form.preparation_time_minutes || 0),
    image_url: form.image_url || null,
    is_available: form.is_available,
    display_order: Number(form.display_order || 0),
    tax_config_ids: form.tax_config_ids,
  };
}

function CategoryDialog({
  createCategory,
  dialog,
  onClose,
  updateCategory,
}: {
  createCategory: (payload: CategoryPayload) => Promise<unknown>;
  dialog: CategoryDialogState | null;
  onClose: () => void;
  updateCategory: (categoryId: string, payload: Partial<CategoryPayload>) => Promise<unknown>;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState("food");
  const [displayOrder, setDisplayOrder] = useState("0");
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (!dialog) {
      return;
    }
    if (dialog.mode === "edit") {
      setName(dialog.category.name);
      setType(dialog.category.type);
      setDisplayOrder(String(dialog.category.display_order ?? 0));
      setIsActive(dialog.category.is_active);
      return;
    }
    setName("");
    setType("food");
    setDisplayOrder("0");
    setIsActive(true);
  }, [dialog]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = {
      name,
      type,
      display_order: Number(displayOrder || 0),
      is_active: isActive,
    };
    if (dialog?.mode === "edit") {
      await updateCategory(dialog.category.id, payload);
      toast.success("Category updated");
    } else {
      await createCategory(payload);
      toast.success("Category added");
    }
    onClose();
  }

  return (
    <Dialog open={Boolean(dialog)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{dialog?.mode === "edit" ? "Edit category" : "Create category"}</DialogTitle>
          <DialogDescription>Categories organize the guest-facing menu and filter panels.</DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={save}>
          <Field label="Name">
            <Input required value={name} onChange={(event) => setName(event.target.value)} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Type">
              <Select value={type} onChange={(event) => setType(event.target.value)}>
                <option value="food">Food</option>
                <option value="beverage">Beverage</option>
              </Select>
            </Field>
            <Field label="Display order">
              <Input type="number" value={displayOrder} onChange={(event) => setDisplayOrder(event.target.value)} />
            </Field>
          </div>
          <label className="flex items-center gap-3 text-sm">
            <input checked={isActive} type="checkbox" onChange={(event) => setIsActive(event.target.checked)} />
            Active
          </label>
          <Button disabled={!name.trim()} type="submit">
            Save
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function TaxDialog({
  createTax,
  dialog,
  onClose,
  updateTax,
}: {
  createTax: (payload: TaxPayload) => Promise<unknown>;
  dialog: TaxDialogState | null;
  onClose: () => void;
  updateTax: (taxId: string, payload: Partial<TaxPayload>) => Promise<unknown>;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [taxType, setTaxType] = useState("percentage");
  const [value, setValue] = useState("5");
  const [appliesTo, setAppliesTo] = useState("food");
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (!dialog) {
      return;
    }
    if (dialog.mode === "edit") {
      setName(dialog.tax.name);
      setDescription(dialog.tax.description ?? "");
      setTaxType(dialog.tax.tax_type ?? "percentage");
      setValue(String(dialog.tax.tax_type === "fixed" ? dialog.tax.fixed_amount : dialog.tax.rate_percent));
      setAppliesTo(dialog.tax.applies_to);
      setIsActive(dialog.tax.is_active);
      return;
    }
    setName("");
    setDescription("");
    setTaxType("percentage");
    setValue("5");
    setAppliesTo("food");
    setIsActive(true);
  }, [dialog]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = {
      name,
      description: description || null,
      tax_type: taxType,
      rate_percent: taxType === "percentage" ? Number(value || 0) : 0,
      fixed_amount: taxType === "fixed" ? Number(value || 0) : 0,
      applies_to: appliesTo,
      is_active: isActive,
    };
    if (dialog?.mode === "edit") {
      await updateTax(dialog.tax.id, payload);
      toast.success("Tax updated");
    } else {
      await createTax(payload);
      toast.success("Tax added");
    }
    onClose();
  }

  return (
    <Dialog open={Boolean(dialog)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{dialog?.mode === "edit" ? "Edit tax" : "Create tax"}</DialogTitle>
          <DialogDescription>Assign tax rules to menu items from the item drawer.</DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={save}>
          <Field label="Tax name">
            <Input required value={name} onChange={(event) => setName(event.target.value)} />
          </Field>
          <Field label="Description">
            <Textarea value={description} onChange={(event) => setDescription(event.target.value)} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Type">
              <Select value={taxType} onChange={(event) => setTaxType(event.target.value)}>
                <option value="percentage">Percentage</option>
                <option value="fixed">Fixed Amount</option>
              </Select>
            </Field>
            <Field label="Value">
              <Input min="0" step="0.01" type="number" value={value} onChange={(event) => setValue(event.target.value)} />
            </Field>
            <Field label="Applies to">
              <Select value={appliesTo} onChange={(event) => setAppliesTo(event.target.value)}>
                <option value="food">Food</option>
                <option value="beverage">Beverage</option>
                <option value="all">All</option>
              </Select>
            </Field>
          </div>
          <label className="flex items-center gap-3 text-sm">
            <input checked={isActive} type="checkbox" onChange={(event) => setIsActive(event.target.checked)} />
            Active
          </label>
          <Button disabled={!name.trim()} type="submit">
            Save
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CategoryManagement({
  categories,
  deleteCategory,
  itemCounts,
  openCategoryDialog,
  toggleCategory,
}: {
  categories: MenuCategory[];
  deleteCategory: (categoryId: string) => void;
  itemCounts: Map<string, number>;
  openCategoryDialog: (dialog: CategoryDialogState) => void;
  toggleCategory: (category: MenuCategory) => void;
}) {
  return (
    <section className="grid gap-3">
      <div className="flex flex-col justify-between gap-3 rounded-md border border-slate-200 bg-white p-4 md:flex-row md:items-center">
        <div>
          <h3 className="text-sm font-semibold">Categories</h3>
          <p className="text-sm text-slate-500">Create, rename, hide, or delete menu categories.</p>
        </div>
        <Button type="button" onClick={() => openCategoryDialog({ mode: "new" })}>
          <Plus />
          Category
        </Button>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {categories.map((category) => (
          <article className="rounded-md border border-slate-200 bg-white p-4" key={category.id}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h4 className="text-sm font-semibold">{category.name}</h4>
                <p className="mt-1 text-xs text-slate-500">
                  {titleCase(category.type)} - {itemCounts.get(category.id) ?? 0} items
                </p>
              </div>
              <Badge variant={category.is_active ? "green" : "default"}>{category.is_active ? "Active" : "Hidden"}</Badge>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button size="sm" type="button" variant="secondary" onClick={() => openCategoryDialog({ mode: "edit", category })}>
                <Pencil />
                Edit
              </Button>
              <Button size="sm" type="button" variant="secondary" onClick={() => toggleCategory(category)}>
                {category.is_active ? "Hide" : "Show"}
              </Button>
              <Button size="sm" type="button" variant="ghost" onClick={() => deleteCategory(category.id)}>
                <Trash2 />
                Delete
              </Button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function TaxManagement({
  openTaxDialog,
  taxes,
  toggleTax,
}: {
  openTaxDialog: (dialog: TaxDialogState) => void;
  taxes: TaxConfig[];
  toggleTax: (tax: TaxConfig) => void;
}) {
  return (
    <section className="grid gap-3">
      <div className="flex flex-col justify-between gap-3 rounded-md border border-slate-200 bg-white p-4 md:flex-row md:items-center">
        <div>
          <h3 className="text-sm font-semibold">Tax Management</h3>
          <p className="text-sm text-slate-500">Maintain GST, service charge, VAT, and fixed-amount rules.</p>
        </div>
        <Button type="button" onClick={() => openTaxDialog({ mode: "new" })}>
          <Plus />
          Tax
        </Button>
      </div>
      <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
        <table className="w-full min-w-[760px] border-collapse text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-normal text-slate-500">
            <tr>
              <th className="border-b border-slate-200 px-4 py-3">Tax Name</th>
              <th className="border-b border-slate-200 px-4 py-3">Type</th>
              <th className="border-b border-slate-200 px-4 py-3">Value</th>
              <th className="border-b border-slate-200 px-4 py-3">Applies To</th>
              <th className="border-b border-slate-200 px-4 py-3">Status</th>
              <th className="border-b border-slate-200 px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {taxes.map((tax) => (
              <tr className="border-b border-slate-100 last:border-0" key={tax.id}>
                <td className="px-4 py-3">
                  <p className="font-medium">{tax.name}</p>
                  <p className="text-xs text-slate-500">{tax.description || "No description"}</p>
                </td>
                <td className="px-4 py-3">{titleCase(tax.tax_type)}</td>
                <td className="px-4 py-3">{tax.tax_type === "fixed" ? money(tax.fixed_amount) : `${Number(tax.rate_percent)}%`}</td>
                <td className="px-4 py-3">{titleCase(tax.applies_to)}</td>
                <td className="px-4 py-3">
                  <Badge variant={tax.is_active ? "green" : "default"}>{tax.is_active ? "Active" : "Inactive"}</Badge>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <Button size="sm" type="button" variant="secondary" onClick={() => openTaxDialog({ mode: "edit", tax })}>
                      Edit
                    </Button>
                    <Button size="sm" type="button" variant="ghost" onClick={() => toggleTax(tax)}>
                      {tax.is_active ? "Disable" : "Enable"}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function OrdersPage({
  closeOrderForm,
  hotelId,
  items,
  openOrderDrawer,
  orderForm,
}: {
  closeOrderForm: () => void;
  hotelId: string;
  items: MenuItem[];
  openOrderDrawer: (drawer: OrderDrawerState) => void;
  orderForm: OrderDrawerState | null;
}) {
  const orders = useRestaurantOrders(hotelId);
  const updateStatus = useUpdateOrderStatus(hotelId);
  const rooms = useRooms(hotelId);
  const guests = useGuests(hotelId);
  const roomMap = useMemo(() => new Map((rooms.data ?? []).map((room) => [room.id, room.room_number])), [rooms.data]);
  const guestMap = useMemo(() => new Map((guests.data ?? []).map((guest) => [guest.id, guest.name])), [guests.data]);
  const grouped = useMemo(() => {
    const map = new Map<string, RestaurantOrder[]>();
    for (const status of orderColumns) {
      map.set(status.key, []);
    }
    for (const order of orders.data ?? []) {
      const key = normalizeOrderStatus(order.status);
      map.get(key)?.push(order);
    }
    return map;
  }, [orders.data]);

  return (
    <section className="grid gap-4">
      <div className="rounded-md border border-slate-200 bg-white p-4">
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
          <div>
            <h3 className="text-sm font-semibold">Orders</h3>
            <p className="text-sm text-slate-500">Food orders are separated from menu management.</p>
          </div>
          <Button type="button" onClick={() => openOrderDrawer({ mode: "new" })}>
            <Plus />
            Staff Order
          </Button>
        </div>
      </div>
      {orderForm ? (
        <OrderFormView drawer={orderForm} hotelId={hotelId} items={items} onClose={closeOrderForm} />
      ) : null}
      {orders.isLoading ? <DataState isLoading /> : null}
      {orders.error ? <DataState error={orders.error} /> : null}
      <div className="grid gap-4 xl:grid-cols-5">
        {orderColumns.map((status) => {
          const rows = grouped.get(status.key) ?? [];
          return (
            <div className="grid content-start gap-3 rounded-md border border-slate-200 bg-slate-50 p-3" key={status.key}>
              <div className="flex items-center justify-between gap-3">
                <h4 className="text-sm font-semibold">{status.label}</h4>
                <Badge>{rows.length}</Badge>
              </div>
              {rows.length ? (
                rows.map((order) => (
                  <OrderCard
                    key={order.id}
                    onEdit={() => openOrderDrawer({ mode: "edit", order })}
                    order={order}
                    roomLabel={order.room_id ? `Room ${roomMap.get(order.room_id) ?? compactId(order.room_id)}` : "Table/POS"}
                    guestLabel={order.guest_id ? guestMap.get(order.guest_id) ?? compactId(order.guest_id) : "Walk-in"}
                    onStatus={(nextStatus) => updateStatus.mutate({ orderId: order.id, status: nextStatus })}
                  />
                ))
              ) : (
                <div className="rounded-md border border-dashed border-slate-300 bg-white p-4 text-center text-sm text-slate-500">
                  No orders
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function OrderCard({
  guestLabel,
  onEdit,
  order,
  roomLabel,
  onStatus,
}: {
  guestLabel: string;
  onEdit: () => void;
  order: RestaurantOrder;
  roomLabel: string;
  onStatus: (status: string) => void;
}) {
  return (
    <article className="grid gap-3 rounded-md border border-slate-200 bg-white p-3 shadow-sm">
      <div>
        <h5 className="text-sm font-semibold">Order #{order.order_number}</h5>
        <p className="mt-1 text-xs text-slate-500">{roomLabel}</p>
      </div>
      <div className="grid gap-1 text-xs text-slate-500">
        <span>Guest: {guestLabel}</span>
        <span>{order.special_instructions || "No special instructions"}</span>
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold">{money(order.total)}</span>
        <Badge variant={orderStatusVariant(order.status)}>{titleCase(order.status)}</Badge>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button size="sm" type="button" variant="secondary" onClick={onEdit}>
          <Pencil />
          Edit
        </Button>
        {normalizeOrderStatus(order.status) === "received" ? (
          <Button size="sm" type="button" onClick={() => onStatus("preparing")}>
            Accept
          </Button>
        ) : null}
        {["preparing", "ready", "delivered"].map((nextStatus) => (
          <Button
            disabled={normalizeOrderStatus(order.status) === nextStatus}
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

type OrderLine = {
  client_id: string;
  menu_item_id: string;
  name: string;
  quantity: number;
  unit_price: number;
  notes: string;
};

type OrderForm = {
  source: string;
  status: string;
  table_id: string;
  guest_id: string;
  room_id: string;
  ticket_id: string;
  folio_id: string;
  special_instructions: string;
};

function OrderFormView({
  drawer,
  hotelId,
  items,
  onClose,
}: {
  drawer: OrderDrawerState | null;
  hotelId: string;
  items: MenuItem[];
  onClose: () => void;
}) {
  const editingOrderId = drawer?.mode === "edit" ? drawer.order.id : null;
  const orderDetail = useRestaurantOrder(hotelId, editingOrderId);
  const createOrder = useCreateRestaurantOrder(hotelId);
  const updateOrder = useUpdateRestaurantOrder(hotelId);
  const rooms = useRooms(hotelId);
  const guests = useGuests(hotelId);
  const [form, setForm] = useState<OrderForm>(emptyOrderForm());
  const [lines, setLines] = useState<OrderLine[]>([]);
  const [itemToAdd, setItemToAdd] = useState("");
  const [quantityToAdd, setQuantityToAdd] = useState("1");
  const [noteToAdd, setNoteToAdd] = useState("");

  const menuById = useMemo(() => {
    const map = new Map<string, MenuItem>();
    for (const item of items) {
      map.set(item.id, item);
    }
    return map;
  }, [items]);

  useEffect(() => {
    if (!drawer) {
      return;
    }
    setItemToAdd(items[0]?.id ?? "");
    setQuantityToAdd("1");
    setNoteToAdd("");
    if (drawer.mode === "edit") {
      setForm({
        source: drawer.order.source,
        status: drawer.order.status,
        table_id: drawer.order.table_id ?? "",
        guest_id: drawer.order.guest_id ?? "",
        room_id: drawer.order.room_id ?? "",
        ticket_id: drawer.order.ticket_id ?? "",
        folio_id: drawer.order.folio_id ?? "",
        special_instructions: drawer.order.special_instructions ?? "",
      });
      setLines([]);
      return;
    }
    setForm(emptyOrderForm());
    setLines([]);
  }, [drawer, items]);

  useEffect(() => {
    if (drawer?.mode !== "edit" || !orderDetail.data) {
      return;
    }
    setLines(
      orderDetail.data.items.map((line) => {
        const menuItem = menuById.get(line.menu_item_id);
        return {
          client_id: line.id,
          menu_item_id: line.menu_item_id,
          name: menuItem?.name ?? `Item ${compactId(line.menu_item_id)}`,
          quantity: line.quantity,
          unit_price: Number(line.unit_price),
          notes: line.notes ?? "",
        };
      }),
    );
  }, [drawer, menuById, orderDetail.data]);

  if (!drawer) {
    return null;
  }

  const subtotal = lines.reduce((sum, line) => sum + line.unit_price * line.quantity, 0);
  const isSaving = createOrder.isPending || updateOrder.isPending;

  function addLine() {
    const selectedItem = menuById.get(itemToAdd);
    if (!selectedItem) {
      return;
    }
    const quantity = Math.max(1, Number(quantityToAdd || 1));
    setLines((current) => [
      ...current,
      {
        client_id: `${selectedItem.id}-${Date.now()}`,
        menu_item_id: selectedItem.id,
        name: selectedItem.name,
        quantity,
        unit_price: Number(selectedItem.price ?? 0),
        notes: noteToAdd.trim(),
      },
    ]);
    setQuantityToAdd("1");
    setNoteToAdd("");
  }

  function updateLine(clientId: string, patch: Partial<OrderLine>) {
    setLines((current) =>
      current.map((line) =>
        line.client_id === clientId
          ? {
              ...line,
              ...patch,
              quantity: patch.quantity === undefined ? line.quantity : Math.max(1, patch.quantity),
            }
          : line,
      ),
    );
  }

  function removeLine(clientId: string) {
    setLines((current) => current.filter((line) => line.client_id !== clientId));
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!drawer) {
      return;
    }
    const payload = orderPayload(form, lines);
    if (drawer.mode === "edit") {
      await updateOrder.mutateAsync({ orderId: drawer.order.id, payload });
      toast.success("Order updated");
    } else {
      const createPayload: RestaurantOrderPayload = { ...payload };
      delete createPayload.status;
      delete createPayload.ticket_id;
      await createOrder.mutateAsync(createPayload);
      toast.success("Order created");
    }
    onClose();
  }

  return (
    <section className="grid gap-4 rounded-md border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">Order form</p>
            <h3 className="mt-1 text-lg font-semibold">
              {drawer.mode === "edit" ? `Order #${drawer.order.order_number}` : "Staff order"}
            </h3>
          </div>
          <Button aria-label="Close order form" size="icon" type="button" variant="ghost" onClick={onClose}>
            <X />
          </Button>
        </div>

        {drawer.mode === "edit" && orderDetail.isLoading ? <DataState isLoading /> : null}
        {drawer.mode === "edit" && orderDetail.error ? <DataState error={orderDetail.error} /> : null}

        <form className="grid gap-4" onSubmit={save}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Source">
              <Select value={form.source} onChange={(event) => setForm((current) => ({ ...current, source: event.target.value }))}>
                <option value="pos">POS</option>
                <option value="room_service">Room Service</option>
                <option value="guest_portal">Guest Portal</option>
                <option value="whatsapp">WhatsApp</option>
              </Select>
            </Field>
            <Field label="Status">
              <Select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}>
                <option value="received">Received</option>
                <option value="preparing">Preparing</option>
                <option value="ready">Ready</option>
                <option value="delivered">Delivered</option>
                <option value="cancelled">Cancelled</option>
              </Select>
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Room">
              <Select value={form.room_id} onChange={(event) => setForm((current) => ({ ...current, room_id: event.target.value }))}>
                <option value="">No room</option>
                {form.room_id && !rooms.data?.some((room) => room.id === form.room_id) ? (
                  <option value={form.room_id}>Room {compactId(form.room_id)}</option>
                ) : null}
                {(rooms.data ?? []).map((room) => (
                  <option key={room.id} value={room.id}>
                    {room.room_number} {room.status ? `- ${titleCase(room.status)}` : ""}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Table ID">
              <Input value={form.table_id} onChange={(event) => setForm((current) => ({ ...current, table_id: event.target.value }))} />
            </Field>
            <Field label="Guest">
              <Select value={form.guest_id} onChange={(event) => setForm((current) => ({ ...current, guest_id: event.target.value }))}>
                <option value="">Walk-in</option>
                {form.guest_id && !guests.data?.some((guest) => guest.id === form.guest_id) ? (
                  <option value={form.guest_id}>Guest {compactId(form.guest_id)}</option>
                ) : null}
                {(guests.data ?? []).map((guest) => (
                  <option key={guest.id} value={guest.id}>
                    {guest.name} {guest.phone ? `- ${guest.phone}` : ""}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Folio ID">
              <Input value={form.folio_id} onChange={(event) => setForm((current) => ({ ...current, folio_id: event.target.value }))} />
            </Field>
          </div>

          {drawer.mode === "edit" ? (
            <Field label="Ticket ID">
              <Input value={form.ticket_id} onChange={(event) => setForm((current) => ({ ...current, ticket_id: event.target.value }))} />
            </Field>
          ) : null}

          <Field label="Instructions">
            <Textarea
              value={form.special_instructions}
              onChange={(event) => setForm((current) => ({ ...current, special_instructions: event.target.value }))}
            />
          </Field>

          <section className="grid gap-3 rounded-md border border-slate-200 p-3">
            <div className="grid gap-3 md:grid-cols-[1fr_96px_auto]">
              <Select value={itemToAdd} onChange={(event) => setItemToAdd(event.target.value)}>
                <option value="">Select menu item</option>
                {items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} - {money(item.price)}
                  </option>
                ))}
              </Select>
              <Input
                min="1"
                type="number"
                value={quantityToAdd}
                onChange={(event) => setQuantityToAdd(event.target.value)}
              />
              <Button disabled={!itemToAdd} type="button" onClick={addLine}>
                <Plus />
                Add
              </Button>
            </div>
            <Input placeholder="Line note" value={noteToAdd} onChange={(event) => setNoteToAdd(event.target.value)} />

            <div className="grid gap-2">
              {lines.map((line) => (
                <div className="grid gap-2 rounded-md border border-slate-200 p-3" key={line.client_id}>
                  <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                    <div>
                      <p className="text-sm font-semibold">{line.name}</p>
                      <p className="text-xs text-slate-500">{money(line.unit_price)} each</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        className="w-20"
                        min="1"
                        type="number"
                        value={line.quantity}
                        onChange={(event) => updateLine(line.client_id, { quantity: Number(event.target.value || 1) })}
                      />
                      <span className="w-20 text-right text-sm font-semibold">{money(line.unit_price * line.quantity)}</span>
                      <Button aria-label="Remove line" size="icon" type="button" variant="ghost" onClick={() => removeLine(line.client_id)}>
                        <Trash2 />
                      </Button>
                    </div>
                  </div>
                  <Input
                    placeholder="Line note"
                    value={line.notes}
                    onChange={(event) => updateLine(line.client_id, { notes: event.target.value })}
                  />
                </div>
              ))}
              {!lines.length ? (
                <div className="rounded-md border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500">No items added</div>
              ) : null}
            </div>
          </section>

          <div className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
            <span className="text-sm font-medium text-slate-600">Estimated subtotal</span>
            <span className="text-base font-semibold">{money(subtotal)}</span>
          </div>

          <Button disabled={!lines.length || isSaving} type="submit">
            {drawer.mode === "edit" ? "Save Order" : "Create Order"}
          </Button>
        </form>
      </section>
  );
}

function emptyOrderForm(): OrderForm {
  return {
    source: "pos",
    status: "received",
    table_id: "",
    guest_id: "",
    room_id: "",
    ticket_id: "",
    folio_id: "",
    special_instructions: "",
  };
}

function orderPayload(form: OrderForm, lines: OrderLine[]): RestaurantOrderPayload {
  return {
    source: form.source,
    status: form.status,
    table_id: optionalId(form.table_id),
    guest_id: optionalId(form.guest_id),
    room_id: optionalId(form.room_id),
    ticket_id: optionalId(form.ticket_id),
    folio_id: optionalId(form.folio_id),
    special_instructions: form.special_instructions.trim() || null,
    ordered_by_guest: form.source === "guest_portal",
    items: lines.map((line) => ({
      menu_item_id: line.menu_item_id,
      quantity: line.quantity,
      unit_price: line.unit_price,
      notes: line.notes.trim() || null,
    })),
  };
}

function optionalId(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function Field({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <label className="grid gap-1.5">
      <Label>{label}</Label>
      {children}
    </label>
  );
}

function setFormField<K extends keyof MenuItemForm>(
  setForm: React.Dispatch<React.SetStateAction<MenuItemForm>>,
  key: K,
  value: MenuItemForm[K],
) {
  setForm((current) => ({ ...current, [key]: value }));
}

function categoryCounts(items: MenuItem[]) {
  const counts = new Map<string, number>();
  for (const item of items) {
    counts.set(item.category_id, (counts.get(item.category_id) ?? 0) + 1);
  }
  return counts;
}

function sortItems(items: MenuItem[], sort: string) {
  const rows = [...items];
  if (sort === "price_low") return rows.sort((a, b) => Number(a.price) - Number(b.price));
  if (sort === "price_high") return rows.sort((a, b) => Number(b.price) - Number(a.price));
  if (sort === "name_az") return rows.sort((a, b) => a.name.localeCompare(b.name));
  if (sort === "name_za") return rows.sort((a, b) => b.name.localeCompare(a.name));
  if (sort === "oldest") return rows.sort((a, b) => a.id.localeCompare(b.id));
  return rows.sort((a, b) => b.id.localeCompare(a.id));
}

function splitPiped(value: string | undefined) {
  return (value ?? "").split("|").map((item) => item.trim()).filter(Boolean);
}

function parseCsv(text: string) {
  return text
    .split(/\r?\n/)
    .map((line) => line.split(",").map((cell) => cell.replace(/^"|"$/g, "").replace(/""/g, '"')))
    .filter((row) => row.some(Boolean));
}

function csvCell(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

function normalizeOrderStatus(status: string) {
  if (["pending", "received"].includes(status)) return "received";
  if (["served", "billed"].includes(status)) return "delivered";
  return status;
}

function orderStatusVariant(status: string) {
  const normalized = normalizeOrderStatus(status);
  if (normalized === "delivered") return "green";
  if (normalized === "ready") return "blue";
  if (normalized === "preparing") return "amber";
  if (normalized === "cancelled") return "rose";
  return "default";
}
