"use client";

import type { ReactNode } from "react";
import { useMemo } from "react";

import { buildAbility, type AppAction, type AppSubject } from "@/lib/auth/ability";
import { useAuthStore } from "@/stores/auth.store";

interface CanProps {
  I: AppAction;
  a: AppSubject;
  children: ReactNode;
  fallback?: ReactNode;
}

export function Can({ I, a, children, fallback = null }: CanProps) {
  const currentUser = useAuthStore((state) => state.currentUser);
  const ability = useMemo(() => buildAbility(currentUser), [currentUser]);

  return ability.can(I, a) || ability.can("manage", "all") ? children : fallback;
}
