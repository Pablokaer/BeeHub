import { Suspense } from "react";
import Link from "next/link";
import { ManageTabs } from "@/components/manage-tabs";
import { Skeleton } from "@/components/ui/misc";

export default function ManageProjectLayout({ children, params }: LayoutProps<"/projects/[slug]/manage">) {
  return (
    <div className="mx-auto max-w-4xl">
      <Suspense fallback={<Skeleton className="mb-5 h-9 w-full" />}>
        <Header params={params} />
      </Suspense>
      {children}
    </div>
  );
}

async function Header({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const base = `/projects/${slug}/manage`;
  return (
    <>
      <p className="eyebrow mb-1">
        <Link href={`/p/${slug}`} className="hover:underline">
          /p/{slug}
        </Link>
      </p>
      <h1 className="mb-3 text-[22px] font-semibold">Manage project</h1>
      <ManageTabs
        base={base}
        items={[
          { href: "", label: "Details" },
          { href: "/team", label: "Team" },
          { href: "/partners", label: "Partners" },
          { href: "/gallery", label: "Gallery" },
          { href: "/settings", label: "Settings" },
        ]}
      />
    </>
  );
}
