"use client";

import { useEffect } from "react";

import { redactPII } from "@/lib/errorReporter";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Error messages can embed account addresses — scrub before logging.
    console.error("[segment-error]", redactPII(error.message));
  }, [error]);

  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="font-mono text-6xl font-bold text-amber-400">!</p>
      <h1 className="text-2xl font-semibold text-white">
        Something went wrong
      </h1>
      <p className="max-w-md text-neutral-400">
        An unexpected error interrupted this page. Your wallet and payments
        are safe — try again, and the problem will be reported if error
        reporting is enabled.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-2 rounded-lg bg-amber-400 px-5 py-2.5 font-medium text-neutral-950 transition hover:bg-amber-300"
      >
        Try again
      </button>
    </main>
  );
}
