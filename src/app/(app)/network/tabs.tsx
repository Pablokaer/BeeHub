import { Tabs } from "@/components/ui/misc";

export function NetworkTabs({ active, counts }: { active: "connections" | "requests" | "invitations"; counts?: { requests?: number; invitations?: number } }) {
  return (
    <Tabs
      label="Network"
      items={[
        { href: "/network", label: "Connections & suggestions", active: active === "connections" },
        { href: "/network/requests", label: "Requests", active: active === "requests", count: counts?.requests },
        { href: "/network/invitations", label: "Team invitations", active: active === "invitations", count: counts?.invitations },
      ]}
    />
  );
}
