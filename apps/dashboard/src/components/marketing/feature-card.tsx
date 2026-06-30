import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type FeatureCardProps = {
  title: string;
  description: string;
  metric: string;
  icon: LucideIcon;
  toneClassName: string;
};

export function FeatureCard({
  title,
  description,
  metric,
  icon: Icon,
  toneClassName,
}: FeatureCardProps) {
  return (
    <article className="group grid min-h-60 content-between rounded-md border border-slate-200 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-1 hover:border-slate-300 hover:shadow-md">
      <div className="grid gap-5">
        <div className={cn("flex size-11 items-center justify-center rounded-md ring-1", toneClassName)}>
          <Icon className="size-5" aria-hidden />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-slate-950">{title}</h3>
          <p className="mt-3 text-sm leading-6 text-slate-600">{description}</p>
        </div>
      </div>
      <div className="mt-6 border-t border-slate-100 pt-4 text-sm font-semibold text-slate-900">{metric}</div>
    </article>
  );
}
