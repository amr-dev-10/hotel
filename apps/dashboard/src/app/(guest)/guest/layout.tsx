import type { ReactNode } from "react";

import { GuestShell } from "@/features/guest-portal/components/guest-shell";

export default function GuestLayout({ children }: { children: ReactNode }) {
  return <GuestShell>{children}</GuestShell>;
}
