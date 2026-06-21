import { Suspense } from "react";

import { GuestLoginPage } from "@/features/guest-portal/components/guest-login-page";

export default function GuestPortalLoginRoute() {
  return (
    <Suspense fallback={null}>
      <GuestLoginPage />
    </Suspense>
  );
}
