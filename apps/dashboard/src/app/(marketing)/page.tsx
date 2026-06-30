import Link from "next/link";
import {
  ArrowRight,
  Bot,
  BrainCircuit,
  Check,
  MessageCircle,
  RadioTower,
  ShieldCheck,
  Sparkles,
  Users,
  Utensils,
} from "lucide-react";

import { FeatureCard } from "@/components/marketing/feature-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const features = [
  {
    title: "WhatsApp Bot",
    description: "Route guest messages, campaigns, and service requests into one operational inbox your team can trust.",
    metric: "Guest replies stay connected to rooms and tickets.",
    icon: MessageCircle,
    toneClassName: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  },
  {
    title: "Live WebSockets",
    description: "Keep tickets, kitchen orders, and front-desk updates moving without manual refresh loops.",
    metric: "Real-time status for every active team.",
    icon: RadioTower,
    toneClassName: "bg-sky-50 text-sky-700 ring-sky-100",
  },
  {
    title: "Dynamic RBAC",
    description: "Control what each role can see and do across reservations, housekeeping, billing, and platform tools.",
    metric: "Permissions follow the work, not guesswork.",
    icon: ShieldCheck,
    toneClassName: "bg-amber-50 text-amber-700 ring-amber-100",
  },
  {
    title: "AI Integrations",
    description: "Use AI-assisted guest support and analytics to surface the work that needs attention first.",
    metric: "Smarter responses and clearer decisions.",
    icon: BrainCircuit,
    toneClassName: "bg-rose-50 text-rose-700 ring-rose-100",
  },
];

const tiers = [
  {
    name: "Starter",
    price: "₹0",
    description: "For lean hotel teams bringing core guest operations online.",
    items: ["Reservations and ticket desk", "WhatsApp bot basics", "Monthly ticket controls"],
    cta: "Hotel login",
    href: "/login",
  },
  {
    name: "Professional",
    price: "₹4,999",
    description: "For growing properties that need live team coordination.",
    items: ["Unlimited ticket volume", "Live chat workflow", "Analytics exports"],
    cta: "View plans",
    href: "#pricing",
    featured: true,
  },
  {
    name: "Enterprise",
    price: "₹14,999",
    description: "For multi-hotel operators and advanced platform governance.",
    items: ["Multi-hotel controls", "AI knowledge workflows", "Inventory and advanced reporting"],
    cta: "Super Admin",
    href: "/platform/login",
  },
];

const workflowItems = [
  { label: "Reservations", value: "142", tone: "bg-sky-50 text-sky-800" },
  { label: "Open tickets", value: "18", tone: "bg-amber-50 text-amber-800" },
  { label: "Rooms ready", value: "86%", tone: "bg-emerald-50 text-emerald-800" },
  { label: "Guest replies", value: "4m", tone: "bg-rose-50 text-rose-800" },
];

export default function MarketingPage() {
  return (
    <main>
      <section className="relative overflow-hidden bg-[#111827] text-white">
        <div aria-hidden className="absolute inset-0">
          <div className="absolute inset-0 bg-[linear-gradient(122deg,rgba(17,24,39,0.96)_0%,rgba(15,61,145,0.82)_46%,rgba(120,53,15,0.72)_100%)]" />
          <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(255,255,255,0.14)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.12)_1px,transparent_1px)] [background-size:72px_72px]" />
          <div className="absolute inset-x-0 bottom-0 h-36 bg-[linear-gradient(0deg,#f8fafc_0%,rgba(248,250,252,0)_100%)]" />
        </div>

        <div className="relative mx-auto grid max-w-7xl gap-8 px-4 pb-10 pt-8 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:px-8 lg:pb-8 lg:pt-10">
          <div className="max-w-2xl">
            <Badge className="border border-white/18 bg-white/12 text-white" variant="default">
              Hotel SaaS operations suite
            </Badge>
            <h1 className="mt-5 max-w-3xl text-4xl font-semibold leading-tight tracking-normal text-white sm:text-5xl lg:text-6xl">
              Arcadia Hotel Platform
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-white/82 sm:text-lg">
              Manage reservations, service tickets, WhatsApp conversations, F&B, and platform controls from one polished
              workspace built for hotel teams.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Button asChild className="h-11 bg-[#F59E0B] px-5 text-slate-950 hover:bg-[#D97706]">
                <Link href="/login">
                  Login to dashboard
                  <ArrowRight />
                </Link>
              </Button>
              <Button asChild className="h-11 border-white/20 bg-white/10 px-5 text-white hover:bg-white/18" variant="secondary">
                <Link href="/platform/login">
                  <ShieldCheck />
                  Super Admin
                </Link>
              </Button>
            </div>

            <dl className="mt-8 hidden max-w-lg grid-cols-3 gap-3 sm:grid">
              {[
                ["Rooms", "Live"],
                ["Teams", "Synced"],
                ["Guests", "Aware"],
              ].map(([label, value]) => (
                <div className="rounded-md border border-white/12 bg-white/8 px-3 py-3" key={label}>
                  <dt className="text-xs font-medium uppercase text-white/55">{label}</dt>
                  <dd className="mt-1 text-sm font-semibold text-white sm:text-base">{value}</dd>
                </div>
              ))}
            </dl>
          </div>

          <HeroOperationsScene />
        </div>
      </section>

      <section className="bg-slate-50 px-4 py-14 sm:px-6 lg:px-8" id="features">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-normal text-[#0F3D91]">Core modules</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-normal text-slate-950 sm:text-4xl">
              The operations stack already inside your product.
            </h2>
            <p className="mt-4 text-base leading-7 text-slate-600">
              The landing page highlights the capabilities your dashboard is already shaping: guest messaging, live team
              updates, role control, and AI-assisted service.
            </p>
          </div>

          <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((feature) => (
              <FeatureCard {...feature} key={feature.title} />
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white px-4 py-14 sm:px-6 lg:px-8" id="workflow">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.78fr_1.22fr] lg:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-normal text-[#0F3D91]">Daily control</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-normal text-slate-950 sm:text-4xl">
              One view for front desk, service, kitchen, and management.
            </h2>
            <p className="mt-4 text-base leading-7 text-slate-600">
              Arcadia brings the moving parts of hotel operations into a single rhythm, from reservation search to guest
              follow-up and platform-level oversight.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {workflowItems.map((item) => (
              <div className="rounded-md border border-slate-200 bg-slate-50 p-5" key={item.label}>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm font-medium text-slate-600">{item.label}</span>
                  <span className={`rounded px-2 py-0.5 text-xs font-semibold ${item.tone}`}>Active</span>
                </div>
                <p className="mt-5 text-3xl font-semibold text-slate-950">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-slate-950 px-4 py-14 text-white sm:px-6 lg:px-8" id="pricing">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-normal text-amber-300">SaaS tiers</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-normal sm:text-4xl">Plans that match hotel maturity.</h2>
            <p className="mt-4 text-base leading-7 text-white/70">
              Pricing mirrors the current platform tiers and can be refined with final sales copy before production.
            </p>
          </div>

          <div className="mt-9 grid gap-4 lg:grid-cols-3">
            {tiers.map((tier) => (
              <article
                className={`rounded-md border p-6 ${
                  tier.featured
                    ? "border-amber-300 bg-white text-slate-950 shadow-lg"
                    : "border-white/12 bg-white/8 text-white"
                }`}
                key={tier.name}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-semibold">{tier.name}</h3>
                    <p className={`mt-2 text-sm leading-6 ${tier.featured ? "text-slate-600" : "text-white/64"}`}>
                      {tier.description}
                    </p>
                  </div>
                  {tier.featured ? <Sparkles className="size-5 text-amber-500" aria-hidden /> : null}
                </div>

                <div className="mt-6 flex items-end gap-1">
                  <span className="text-4xl font-semibold">{tier.price}</span>
                  <span className={`pb-1 text-sm ${tier.featured ? "text-slate-500" : "text-white/60"}`}>/mo</span>
                </div>

                <ul className="mt-6 grid gap-3">
                  {tier.items.map((item) => (
                    <li className="flex items-start gap-3 text-sm" key={item}>
                      <Check className={`mt-0.5 size-4 ${tier.featured ? "text-emerald-600" : "text-emerald-300"}`} />
                      <span className={tier.featured ? "text-slate-700" : "text-white/76"}>{item}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  asChild
                  className={`mt-7 w-full ${
                    tier.featured ? "bg-[#0F3D91] text-white hover:bg-[#0b2e6e]" : "bg-white text-slate-950 hover:bg-slate-100"
                  }`}
                  variant="secondary"
                >
                  <Link href={tier.href}>{tier.cta}</Link>
                </Button>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#F8FAFC] px-4 py-14 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 rounded-md border border-slate-200 bg-white p-6 shadow-sm md:flex-row md:items-center md:justify-between md:p-8">
          <div className="max-w-2xl">
            <h2 className="text-2xl font-semibold text-slate-950 sm:text-3xl">Ready to polish the full hotel workflow?</h2>
            <p className="mt-3 text-base leading-7 text-slate-600">
              Use the existing login paths to continue testing the dashboard, platform portal, and operational modules.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button asChild className="h-11 px-5">
              <Link href="/login">
                Hotel login
                <ArrowRight />
              </Link>
            </Button>
            <Button asChild className="h-11 px-5" variant="secondary">
              <Link href="/platform/login">
                <ShieldCheck />
                Super Admin
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}

function HeroOperationsScene() {
  return (
    <>
      <div className="grid gap-3 rounded-md border border-white/14 bg-white/10 p-3 shadow-2xl backdrop-blur sm:hidden">
        <div className="rounded-md border border-white/10 bg-slate-950/72 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase text-white/48">Live today</p>
              <p className="mt-1 text-sm font-semibold text-white">Operations command center</p>
            </div>
            <span className="rounded bg-emerald-300/18 px-2 py-1 text-xs font-semibold text-emerald-100">Live</span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-md bg-white p-3 text-slate-950">
              <p className="text-xs font-semibold uppercase text-slate-500">Reservations</p>
              <p className="mt-2 text-2xl font-semibold">142</p>
            </div>
            <div className="rounded-md bg-[#FEF3C7] p-3 text-slate-950">
              <p className="text-xs font-semibold uppercase text-amber-800">Tickets</p>
              <p className="mt-2 text-2xl font-semibold">18</p>
            </div>
          </div>

          <div className="mt-3 rounded-md border border-white/10 bg-white/8 p-3">
            <div className="flex items-center gap-3">
              <Bot className="size-5 text-emerald-200" aria-hidden />
              <div>
                <p className="text-sm font-semibold text-white">WhatsApp automation</p>
                <p className="mt-1 text-xs text-white/58">12 guest conversations triaged</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="relative hidden min-h-[320px] overflow-hidden rounded-md border border-white/14 bg-white/10 p-3 shadow-2xl backdrop-blur sm:block sm:min-h-[400px] lg:min-h-[470px]">
      <div className="grid h-full min-h-[294px] gap-3 rounded-md border border-white/10 bg-slate-950/72 p-3 sm:min-h-[374px] lg:min-h-[444px]">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div>
            <p className="text-xs font-semibold uppercase text-white/48">Today</p>
            <p className="mt-1 text-sm font-semibold text-white">Operations command center</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-emerald-200">
            <span className="size-2 rounded bg-emerald-300" />
            Live
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-[0.92fr_1.08fr]">
          <div className="grid gap-3">
            <div className="rounded-md border border-white/10 bg-white/8 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase text-white/48">Occupancy</p>
                  <p className="mt-2 text-4xl font-semibold text-white">86%</p>
                </div>
                <Users className="size-8 text-sky-200" aria-hidden />
              </div>
              <div className="mt-4 grid grid-cols-8 gap-1">
                {[68, 48, 72, 58, 42, 66, 52, 74].map((height, index) => (
                  <span className="rounded bg-sky-300/80" key={index} style={{ height: `${height}px` }} />
                ))}
              </div>
            </div>

            <div className="rounded-md border border-white/10 bg-white/8 p-4">
              <div className="flex items-center gap-3">
                <Bot className="size-5 text-emerald-200" aria-hidden />
                <div>
                  <p className="text-sm font-semibold text-white">WhatsApp automation</p>
                  <p className="mt-1 text-xs text-white/55">12 guest conversations triaged</p>
                </div>
              </div>
              <div className="mt-4 grid gap-2">
                {["Room 408 towel request", "Late checkout approval", "Airport pickup reminder"].map((item) => (
                  <div className="rounded border border-white/8 bg-white/8 px-3 py-2 text-xs text-white/74" key={item}>
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-md border border-white/10 bg-white p-4 text-slate-950">
                <p className="text-xs font-semibold uppercase text-slate-500">Reservations</p>
                <p className="mt-2 text-3xl font-semibold">142</p>
                <p className="mt-1 text-xs text-emerald-700">+18 check-ins today</p>
              </div>
              <div className="rounded-md border border-white/10 bg-[#FEF3C7] p-4 text-slate-950">
                <p className="text-xs font-semibold uppercase text-amber-800">Tickets</p>
                <p className="mt-2 text-3xl font-semibold">18</p>
                <p className="mt-1 text-xs text-amber-800">6 high priority</p>
              </div>
            </div>

            <div className="rounded-md border border-white/10 bg-white/8 p-4">
              <div className="flex items-center gap-3">
                <Utensils className="size-5 text-amber-200" aria-hidden />
                <div>
                  <p className="text-sm font-semibold text-white">F&B service board</p>
                  <p className="mt-1 text-xs text-white/55">Orders, prep status, and guest room mapping.</p>
                </div>
              </div>
              <div className="mt-4 grid gap-3">
                {[
                  ["Suite 1202", "Plating", "w-10/12"],
                  ["Room 315", "Cooking", "w-7/12"],
                  ["Pool bar", "Queued", "w-5/12"],
                ].map(([room, status, width]) => (
                  <div key={room}>
                    <div className="mb-1 flex justify-between text-xs text-white/70">
                      <span>{room}</span>
                      <span>{status}</span>
                    </div>
                    <div className="h-2 rounded bg-white/10">
                      <div className={`h-2 rounded bg-amber-300 ${width}`} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-md border border-white/10 bg-[#ECFDF5] p-4 text-slate-950">
              <div className="flex items-center gap-3">
                <Sparkles className="size-5 text-emerald-700" aria-hidden />
                <div>
                  <p className="text-sm font-semibold">AI service summary</p>
                  <p className="mt-1 text-xs text-slate-600">Priority rooms and unresolved guest requests are ready for review.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>
    </>
  );
}
