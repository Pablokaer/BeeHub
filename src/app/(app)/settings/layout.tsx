import { Suspense } from "react";
import { ManageTabs } from "@/components/manage-tabs";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-3 text-[22px] font-semibold">Settings</h1>
      <Suspense fallback={<div className="mb-5 h-9 border-b border-line" />}>
      <ManageTabs
        base="/settings"
        items={[
          { href: "", label: "Account" },
          { href: "/privacy", label: "Privacy" },
          { href: "/notifications", label: "Notifications" },
          { href: "/blocked", label: "Blocked" },
          { href: "/data", label: "Your data" },
        ]}
      />
      </Suspense>
      {children}
    </div>
  );
}
