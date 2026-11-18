import Link from "next/link";

export default function NotFound() {
  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-4 text-center">
      <p className="eyebrow">404</p>
      <h1 className="mt-1 text-xl font-semibold">This page isn&apos;t available</h1>
      <p className="mt-1 text-sm text-muted">It may have been removed, made private, or the link is wrong.</p>
      <div className="mt-5 flex gap-2">
        <Link href="/" className="cm-gold inline-flex h-11 items-center px-4 text-sm">
          Go home
        </Link>
        <Link href="/discover" className="rounded-md border border-line-strong px-3.5 py-2 text-sm">
          Discover
        </Link>
      </div>
    </main>
  );
}
