import { Suspense } from "react";
import { Footer, SideRail, SideRailSkeleton, TopBar, TopBarSkeleton } from "@/components/shell/app-shell";
import { NavigationMemory } from "@/components/colmeia/back-link";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <Suspense fallback={<TopBarSkeleton />}>
        <TopBar />
      </Suspense>
      <div className="cm-shell flex-1">
        <Suspense fallback={<SideRailSkeleton />}>
          <SideRail />
        </Suspense>
        <main id="main" className="min-w-0 pb-10">
          {children}
        </main>
      </div>
      <Footer />
      <Suspense fallback={null}>
        <NavigationMemory />
      </Suspense>
    </div>
  );
}
