import { Suspense } from "react";
import Link from "next/link";
import { ManageTabs } from "@/components/manage-tabs";
import { Skeleton } from "@/components/ui/misc";

export default function ManageOrgLayout({ children, params }: LayoutProps<"/orgs/[slug]/manage">) {
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
  return (
    <>
      <p className="eyebrow mb-1">
        <Link href={`/o/${slug}`} className="hover:underline">
          /o/{slug}
        </Link>
      </p>
      <h1 className="mb-3 text-[22px] font-semibold">Manage organization</h1>
      <ManageTabs
        base={`/orgs/${slug}/manage`}
        items={[
          { href: "", label: "Details" },
          { href: "/members", label: "Members" },
          { href: "/partners", label: "Partners" },
          { href: "/settings", label: "Settings" },
        ]}
      />
    </>
  );
}
