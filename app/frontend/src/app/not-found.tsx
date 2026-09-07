import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="font-mono text-6xl font-bold text-amber-400">404</p>
      <h1 className="text-2xl font-semibold text-white">
        This page does not exist
      </h1>
      <p className="max-w-md text-neutral-400">
        The link may be mistyped, expired, or the payment may have already
        been claimed. If you scanned a payment link, double-check the code
        and try again.
      </p>
      <Link
        href="/"
        className="mt-2 rounded-lg bg-amber-400 px-5 py-2.5 font-medium text-neutral-950 transition hover:bg-amber-300"
      >
        Go to the homepage
      </Link>
    </main>
  );
}
