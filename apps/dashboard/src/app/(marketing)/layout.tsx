import type { Metadata } from "next";

import { MarketingFooter } from "@/components/marketing/footer";
import { MarketingNavbar } from "@/components/marketing/navbar";

export const metadata: Metadata = {
  title: "Arcadia Hotel Platform | Modern Hotel Operations",
  description: "A public landing page for Arcadia's hotel operations, guest service, and SaaS platform workspace.",
};

export default function MarketingLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <MarketingNavbar />
      {children}
      <MarketingFooter />
    </div>
  );
}
