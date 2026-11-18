"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div role="alert" className="mx-auto max-w-md py-16 text-center">
      <h1 className="text-lg font-semibold">Something went wrong</h1>
      <p className="mt-1 text-sm text-muted">The page couldn&apos;t be loaded. Try again, and if it keeps happening, come back in a few minutes.</p>
      {error.digest && <p className="mt-2 font-mono text-xs text-muted">Reference: {error.digest}</p>}
      <Button className="mt-5" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
