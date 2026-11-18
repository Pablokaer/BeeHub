import { cn } from "./ui/cn";

/** Bia welcomes members; decorative instances stay silent to assistive technology. */
export function BeeMascot({ className, decorative = true }: { className?: string; decorative?: boolean }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/brand/bia-bee-v2.png" width={1536} height={1024} alt={decorative ? "" : "Bia, the BeeHub community bee"} aria-hidden={decorative || undefined} className={cn("pixel-image", className)} />
  );
}
