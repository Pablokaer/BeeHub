import { Footer } from "@/components/shell/app-shell";
import { Logo } from "@/components/shell/logo";
import { ButtonLink } from "@/components/ui/button";
import Link from "next/link";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b border-line-strong bg-canvas">
        <div className="site-container flex h-20 items-center gap-4">
          <Logo />
          <nav aria-label="Main" className="ml-auto flex items-center gap-1 text-sm">
            <Link href="/discover" className="hidden rounded-md px-2.5 py-1.5 text-muted hover:text-ink sm:inline">
              Discover
            </Link>
            <Link href="/opportunities" className="hidden rounded-md px-2.5 py-1.5 text-muted hover:text-ink sm:inline">
              Opportunities
            </Link>
            <ButtonLink href="/login" variant="ghost" size="sm">
              Sign in
            </ButtonLink>
            <ButtonLink href="/signup" size="sm">
              Join
            </ButtonLink>
          </nav>
        </div>
      </header>
      <main id="main" className="flex-1">
        {children}
      </main>
      <Footer />
    </div>
  );
}
