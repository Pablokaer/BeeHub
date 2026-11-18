import { Logo } from "@/components/shell/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center px-4 py-10">
      <Logo />
      <main id="main" className="mt-8 w-full max-w-[400px]">
        {children}
      </main>
    </div>
  );
}
