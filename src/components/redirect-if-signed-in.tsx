"use client";

import { useEffect } from "react";
import { useViewer } from "@/lib/data";

/** Welcome / sign-in / sign-up: someone already signed in goes to `to` (default Home). */
export function RedirectIfSignedIn({ to = "/" }: { to?: string }) {
  const { user, pending } = useViewer();
  useEffect(() => {
    if (!pending && user) window.location.replace(to);
  }, [pending, user, to]);
  return null;
}
