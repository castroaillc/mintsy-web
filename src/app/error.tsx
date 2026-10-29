"use client";

import { Button } from "@/components/ui/button";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const mongo = /mongo|ECONNREFUSED|Server selection/i.test(error.message);
  return (
    <div className="mx-auto max-w-lg py-24 text-center">
      <h1 className="text-2xl font-bold">Something went wrong</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {mongo ? "Couldn't reach MongoDB. Check MONGODB_URI in .env.local and that the database is running." : error.message}
      </p>
      <Button className="mt-6" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
