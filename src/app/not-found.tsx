import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 py-12 text-center">
      <div className="max-w-xl rounded-3xl border border-white/10 bg-[#081024]/90 p-10 shadow-2xl shadow-teal-500/5">
        <p className="text-sm uppercase tracking-[0.35em] text-[#0891B2]">Page not found</p>
        <h1 className="mt-6 text-6xl font-semibold text-white">404</h1>
        <p className="mt-4 text-slate-400 sm:text-lg">
          We couldn&apos;t find the page you were looking for. Navigate back to the homepage and continue your growth strategy.
        </p>
        <Link
          href="/"
          className="mt-8 inline-flex rounded-full bg-[#0891B2] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#0c94bf]"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}
