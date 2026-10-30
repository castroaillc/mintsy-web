"use client";

import { useEffect, type ReactNode } from "react";
import { useViewer } from "@/lib/data";

/**
 * Client half of the auth guard (src/proxy.ts only checks that a cookie exists). Renders `fallback` while the
 * session loads, and sends signed-out visitors to /welcome (Home) or /sign-in?next=… with a full navigation,
 * which also clears any per-user client state.
 */
export function useRequireAuth(to: "welcome" | "sign-in" = "sign-in") {
  const { user, pending } = useViewer();
  useEffect(() => {
    if (pending || user) return;
    const next = window.location.pathname + window.location.search;
    window.location.replace(to === "welcome" ? "/welcome" : `/sign-in?next=${encodeURIComponent(next)}`);
  }, [pending, user, to]);
  return { ready: !pending && !!user };
}

export function RequireAuth({ children, fallback = null, to }: { children: ReactNode; fallback?: ReactNode; to?: "welcome" | "sign-in" }) {
  const { ready } = useRequireAuth(to);
  return ready ? <>{children}</> : <>{fallback}</>;
}
