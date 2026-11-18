import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "./cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "signal" | "subtle";
export type ButtonSize = "sm" | "md";

const base =
  "inline-flex items-center justify-center gap-1.5 font-semibold whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-60 aria-disabled:opacity-60 select-none";

/** Primary and secondary use the Colmeia stepped silhouettes (see src/styles/colmeia.css). */
const variants: Record<ButtonVariant, string> = {
  primary: "cm-gold",
  secondary: "cm-wax",
  ghost: "text-ink-2 hover:bg-sunken hover:text-ink",
  subtle: "bg-sunken text-ink hover:bg-line",
  danger: "border border-danger/50 bg-surface text-danger hover:bg-danger-soft",
  signal: "bg-signal text-surface hover:opacity-90",
};

const sizes: Record<ButtonSize, string> = {
  sm: "cm-btn-sm h-9 px-3 text-[13px]",
  md: "h-11 px-5 text-sm",
};

export function buttonClass(variant: ButtonVariant = "primary", size: ButtonSize = "md", className?: string) {
  return cn(base, variants[variant], sizes[size], className);
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  type = "button",
  ...props
}: ComponentProps<"button"> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <button type={type} className={buttonClass(variant, size, className)} {...props} />;
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}
