import {
  AlertTriangle,
  BarChart3,
  BedDouble,
  Bell,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  Download,
  Edit3,
  Eye,
  Filter,
  Grid3X3,
  Hotel,
  Inbox,
  LayoutGrid,
  List,
  Menu,
  MoreVertical,
  Plus,
  Save,
  Search,
  Settings,
  Trash2,
  Users,
  Wrench,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

const navItems = [
  { label: "Dashboard", icon: LayoutGrid, active: true },
  { label: "Reservations", icon: CalendarDays },
  { label: "Guests", icon: Users },
  { label: "Rooms", icon: BedDouble },
  { label: "Housekeeping", icon: Wrench },
  { label: "Reports", icon: BarChart3 },
];

const tableRows = [
  ["Amit Kumar", "DLX-101", "Checked In", "green"],
  ["Sneha Iyer", "SUP-204", "Confirmed", "blue"],
  ["Vikas Patel", "DLX-302", "Reserved", "amber"],
  ["Neha Reddy", "STE-401", "In Progress", "amber"],
] as const;

export default function ErpDesignPage() {
  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <div className="grid min-h-screen lg:grid-cols-[17rem_1fr]">
        <aside className="hidden border-r border-white/10 bg-[var(--background-deep)] text-white lg:flex lg:flex-col">
          <div className="flex h-16 items-center gap-3 border-b border-white/10 px-5">
            <div className="flex size-9 items-center justify-center rounded-md bg-[var(--primary)]">
              <Hotel className="size-5" />
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em]">Arcadia</p>
              <p className="text-xs text-white/55">Hotel Platform</p>
            </div>
          </div>
          <nav className="grid gap-1 p-3">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <span
                  className={
                    item.active
                      ? "flex h-10 items-center gap-3 rounded-md bg-[var(--primary)] px-3 text-sm font-medium text-white shadow-[0_10px_22px_rgba(37,99,235,0.28)]"
                      : "flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium text-white/70"
                  }
                  key={item.label}
                >
                  <Icon className="size-4" />
                  {item.label}
                </span>
              );
            })}
          </nav>
          <div className="mt-auto p-3">
            <div className="rounded-md border border-white/10 bg-white/[0.06] p-3">
              <p className="text-xs font-semibold uppercase tracking-normal text-white/40">Current Hotel</p>
              <p className="mt-1 text-sm font-semibold">Arcadia Grand Hotel</p>
              <p className="text-xs text-white/55">Hotel Admin</p>
            </div>
          </div>
        </aside>

        <section className="min-w-0">
          <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-white/10 bg-[var(--background-deep)] px-4 text-white shadow-[0_10px_28px_rgba(15,23,42,0.16)] lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <Button className="text-white hover:bg-white/10 hover:text-white lg:hidden" size="icon" type="button" variant="ghost">
                <Menu />
              </Button>
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold uppercase tracking-normal text-white/50">Arcadia Grand Hotel</p>
                <h1 className="truncate text-lg font-semibold text-white">ERP Design System</h1>
              </div>
            </div>
            <div className="hidden min-w-0 flex-1 justify-center md:flex">
              <div className="relative w-full max-w-xl">
                <Search className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-white/45" />
                <input
                  className="h-10 w-full rounded-md border border-white/15 bg-white/5 px-3 pr-10 text-sm text-white outline-none placeholder:text-white/45 focus:border-white/30 focus:ring-2 focus:ring-white/10"
                  placeholder="Search guests, reservations, tickets..."
                />
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button className="text-white/80 hover:bg-white/10 hover:text-white" data-tooltip="Notifications" size="icon" type="button" variant="ghost">
                <Bell />
                <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-[var(--primary)] px-1 text-xs font-semibold leading-5 text-white">12</span>
              </Button>
              <Button className="text-white/80 hover:bg-white/10 hover:text-white" data-tooltip="Help" size="icon" type="button" variant="ghost">
                <CircleHelp />
              </Button>
              <div className="hidden items-center gap-2 rounded-md border border-white/10 bg-white/[0.06] px-2 py-1 md:flex">
                <div className="flex size-7 items-center justify-center rounded-md bg-white/15 text-xs font-semibold">J</div>
                <div>
                  <p className="text-xs font-semibold leading-4">John Smith</p>
                  <p className="text-[10px] leading-3 text-white/55">Hotel Admin</p>
                </div>
              </div>
            </div>
          </header>

          <div className="grid gap-4 p-4 lg:grid-cols-12 lg:p-6">
            <Panel className="lg:col-span-6" title="Buttons">
              <div className="grid gap-3 text-sm">
                <Row label="Default">
                  <Button type="button">Button</Button>
                  <Button type="button" variant="secondary">Button</Button>
                  <Button type="button" variant="outline">Button</Button>
                  <Button type="button" variant="ghost">Button</Button>
                  <Button type="button" variant="danger">Button</Button>
                </Row>
                <Row label="With Icon">
                  <Button type="button"><Save /> Save Changes</Button>
                  <Button type="button" variant="secondary"><Filter /> Filter</Button>
                  <Button type="button" variant="outline"><Download /> Export</Button>
                </Row>
                <Row label="Icon">
                  <Button data-tooltip="Add" size="icon" type="button"><Plus /></Button>
                  <Button data-tooltip="Settings" size="icon" type="button" variant="secondary"><Settings /></Button>
                  <Button data-tooltip="Delete" size="icon" type="button" variant="danger"><Trash2 /></Button>
                </Row>
              </div>
            </Panel>

            <Panel className="lg:col-span-3" title="Inputs">
              <div className="grid gap-3">
                <Input placeholder="Enter guest name" />
                <Select defaultValue="">
                  <option value="" disabled>Select a room type</option>
                  <option>Deluxe King</option>
                  <option>Suite</option>
                </Select>
                <div className="relative">
                  <Input className="pr-9" placeholder="Search anything..." />
                  <Search className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-[var(--muted)]" />
                </div>
                <Input disabled placeholder="Disabled input" />
              </div>
            </Panel>

            <Panel className="lg:col-span-3" title="Status Badges">
              <div className="flex flex-wrap gap-2">
                <Badge variant="green">Confirmed</Badge>
                <Badge variant="blue">Reserved</Badge>
                <Badge variant="amber">In Progress</Badge>
                <Badge variant="rose">Cancelled</Badge>
                <Badge>Checked Out</Badge>
                <Badge variant="teal">Completed</Badge>
              </div>
              <div className="mt-5 grid gap-2 text-sm">
                <Status color="bg-[var(--success)]" label="Active" />
                <Status color="bg-[var(--primary)]" label="In Progress" />
                <Status color="bg-[var(--warning)]" label="Pending" />
                <Status color="bg-[var(--destructive)]" label="Inactive" />
              </div>
            </Panel>

            <Panel className="lg:col-span-4" title="Alerts / Notifications">
              <Alert icon={<CheckCircle2 />} tone="green" text="Reservation confirmed successfully." />
              <Alert icon={<Bell />} tone="blue" text="New check-in for Room 101." />
              <Alert icon={<AlertTriangle />} tone="amber" text="Low stock: toiletries in Housekeeping." />
              <Alert icon={<X />} tone="rose" text="Payment failed for Reservation #1245." />
            </Panel>

            <Panel className="lg:col-span-3" title="Progress Indicators">
              <div className="grid gap-4">
                <div>
                  <div className="mb-2 flex justify-between text-xs text-[var(--muted)]">
                    <span>Linear Progress</span>
                    <span>65%</span>
                  </div>
                  <div className="h-2 rounded-full bg-[var(--panel-muted)]">
                    <div className="h-full w-[65%] rounded-full bg-[var(--primary)]" />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  {["1", "2", "3", "4"].map((step, index) => (
                    <span
                      className={
                        index < 2
                          ? "grid size-8 place-items-center rounded-full bg-[var(--primary)] text-xs font-semibold text-white"
                          : "grid size-8 place-items-center rounded-full bg-[var(--panel-muted)] text-xs font-semibold text-[var(--muted)]"
                      }
                      key={step}
                    >
                      {step}
                    </span>
                  ))}
                </div>
                <div className="grid place-items-center">
                  <div className="grid size-24 place-items-center rounded-full border-[10px] border-[var(--primary-soft)] border-t-[var(--primary)] text-lg font-semibold">
                    75%
                  </div>
                </div>
              </div>
            </Panel>

            <Panel className="lg:col-span-5" title="Table Actions">
              <div className="overflow-x-auto rounded-md border border-[var(--border)]">
                <div className="grid min-w-[430px] grid-cols-[minmax(96px,1fr)_64px_88px_92px] bg-[var(--panel-muted)] px-3 py-2 text-xs font-semibold uppercase text-[var(--muted)]">
                  <span>Guest Name</span>
                  <span>Room</span>
                  <span>Status</span>
                  <span>Actions</span>
                </div>
                {tableRows.map(([name, room, status, variant]) => (
                  <div className="grid min-w-[430px] grid-cols-[minmax(96px,1fr)_64px_88px_92px] items-center border-t border-[var(--border)] px-3 py-2 text-sm" key={name}>
                    <span className="font-medium">{name}</span>
                    <span className="text-[var(--muted-strong)]">{room}</span>
                    <Badge variant={variant}>{status}</Badge>
                    <span className="flex gap-1">
                      <Button className="h-7 w-7" data-tooltip="View" size="iconSm" type="button" variant="secondary"><Eye /></Button>
                      <Button className="h-7 w-7" data-tooltip="Edit" size="iconSm" type="button" variant="secondary"><Edit3 /></Button>
                      <Button className="h-7 w-7" data-tooltip="More" size="iconSm" type="button" variant="secondary"><MoreVertical /></Button>
                    </span>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel className="lg:col-span-3" title="Toggle Buttons">
              <div className="inline-flex rounded-md border border-[var(--border)] bg-[var(--panel)] p-1">
                <Button size="iconSm" type="button" variant="ghost"><List /></Button>
                <Button size="iconSm" type="button"><Grid3X3 /></Button>
                <Button size="iconSm" type="button" variant="ghost"><LayoutGrid /></Button>
              </div>
            </Panel>

            <Panel className="lg:col-span-3" title="Dropdown Menu">
              <Button className="justify-between" type="button" variant="secondary">
                More Actions
                <ChevronDown />
              </Button>
              <div className="mt-2 grid w-44 gap-1 rounded-md border border-[var(--border)] bg-[var(--panel)] p-1 text-sm shadow-[var(--shadow-panel)]">
                <span className="flex items-center gap-2 rounded px-2 py-1.5"><Eye className="size-4" /> View Details</span>
                <span className="flex items-center gap-2 rounded px-2 py-1.5"><Edit3 className="size-4" /> Edit Record</span>
                <span className="flex items-center gap-2 rounded px-2 py-1.5 text-[var(--destructive)]"><Trash2 className="size-4" /> Delete</span>
              </div>
            </Panel>

            <Panel className="lg:col-span-3" title="Empty State">
              <div className="grid min-h-40 place-items-center text-center">
                <Inbox className="mb-3 size-11 text-[var(--border-strong)]" />
                <p className="font-semibold">No reservations found</p>
                <p className="mt-1 text-sm text-[var(--muted)]">Try adjusting filters or search.</p>
                <Button className="mt-4" size="sm" type="button">Clear Filters</Button>
              </div>
            </Panel>

            <Panel className="lg:col-span-3" title="Modal Sample">
              <div className="rounded-md border border-[var(--border)] bg-[var(--panel)] p-4 shadow-[var(--shadow-panel)]">
                <div className="flex items-center justify-between">
                  <p className="font-semibold">Confirm Check-out</p>
                  <X className="size-4 text-[var(--muted)]" />
                </div>
                <p className="mt-3 text-sm text-[var(--muted)]">Are you sure you want to check-out this guest?</p>
                <div className="mt-4 flex justify-end gap-2">
                  <Button size="sm" type="button" variant="secondary">Cancel</Button>
                  <Button size="sm" type="button">Confirm</Button>
                </div>
              </div>
            </Panel>
          </div>
        </section>
      </div>
    </main>
  );
}

function Panel({ className = "", title, children }: { className?: string; title: string; children: React.ReactNode }) {
  return (
    <section className={`min-w-0 rounded-md border border-[var(--border)] bg-[var(--panel)] p-4 shadow-[var(--shadow-control)] ${className}`}>
      <h2 className="mb-4 text-xs font-semibold uppercase tracking-normal text-[var(--muted-strong)]">{title}</h2>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid min-w-0 gap-2 sm:grid-cols-[72px_1fr] sm:items-center">
      <span className="text-xs font-medium text-[var(--muted)]">{label}</span>
      <div className="flex min-w-0 flex-wrap gap-2">{children}</div>
    </div>
  );
}

function Status({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-2">
      <span className={`size-2.5 rounded-full ${color}`} />
      <span className="text-[var(--muted-strong)]">{label}</span>
    </span>
  );
}

function Alert({ icon, tone, text }: { icon: React.ReactNode; tone: "green" | "blue" | "amber" | "rose"; text: string }) {
  const tones = {
    green: "bg-[var(--success-soft)] text-[var(--success)]",
    blue: "bg-[var(--primary-soft)] text-[var(--primary)]",
    amber: "bg-[var(--warning-soft)] text-[var(--warning)]",
    rose: "bg-[var(--destructive-soft)] text-[var(--destructive)]",
  };

  return (
    <div className={`mb-2 flex items-center justify-between rounded-md px-3 py-2 text-sm ${tones[tone]}`}>
      <span className="flex min-w-0 items-center gap-2">
        <span className="[&_svg]:size-4">{icon}</span>
        <span className="truncate">{text}</span>
      </span>
      <X className="size-4 shrink-0" />
    </div>
  );
}
