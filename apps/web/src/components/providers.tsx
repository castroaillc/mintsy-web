"use client";

import type { ReactNode } from "react";
import { SWRConfig } from "swr";
import { swrFetcher } from "@/lib/graphql";
import { ToastProvider } from "./toast";

/**
 * Client data: SWR over /graphql. Revalidates on focus and reconnect, so signed media URLs and newly
 * published books stay fresh; nothing is persisted between visits.
 */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <SWRConfig
      value={{
        fetcher: swrFetcher as never,
        revalidateOnFocus: true,
        revalidateOnReconnect: true,
        focusThrottleInterval: 60_000,
        dedupingInterval: 4_000,
        errorRetryCount: 2,
      }}
    >
      <ToastProvider>{children}</ToastProvider>
    </SWRConfig>
  );
}
