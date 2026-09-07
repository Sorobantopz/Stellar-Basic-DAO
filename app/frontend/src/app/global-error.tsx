"use client";

import { useEffect } from "react";

import { redactPII } from "@/lib/errorReporter";

/**
 * Root error boundary. Next.js only renders this when an error escapes the
 * root layout — without it the user gets a blank page and no recovery path.
 * It must define its own <html>/<body> because the root layout is gone.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global-error]", redactPII(error.message));
  }, [error]);

  return (
    <html lang="en">
      <body className="bg-neutral-950 text-white antialiased">
        <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
          <p className="font-mono text-6xl font-bold text-amber-400">!</p>
          <h1 className="text-2xl font-semibold">The app hit an error</h1>
          <p className="max-w-md text-neutral-400">
            Something went wrong at the app level. Your wallet and data are
            safe — reload to continue.
          </p>
          <button
            type="button"
            onClick={reset}
            className="mt-2 rounded-lg bg-amber-400 px-5 py-2.5 font-medium text-neutral-950 transition hover:bg-amber-300"
          >
            Reload
          </button>
        </main>
      </body>
    </html>
  );
}
