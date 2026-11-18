import Link from "next/link";
import { siteConfig } from "@/lib/constants";

/** Approved Bia artwork paired with a readable wordmark. */
export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2.5 font-semibold text-ink" aria-label={`${siteConfig.name} home`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/bia-logo-v2.png" width={44} height={44} alt="" className="size-11 shrink-0 object-contain pixel-image" aria-hidden="true" />
      <span className="hidden text-[18px] tracking-tight sm:inline">{siteConfig.name}</span>
    </Link>
  );
}
