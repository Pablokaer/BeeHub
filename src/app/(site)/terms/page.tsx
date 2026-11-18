import type { Metadata } from "next";

export const metadata: Metadata = { title: "Terms of Service" };

export default function TermsPage() {
  return (
    <article className="mx-auto max-w-2xl px-4 py-12 text-[15px] leading-relaxed text-ink-2">
      <p className="eyebrow">Template · review with legal counsel before launch</p>
      <h1 className="mt-2 text-3xl font-semibold text-ink">Terms of Service</h1>
      <h2 className="mt-8 text-lg font-semibold text-ink">1. Your account</h2>
      <p className="mt-2">You must provide accurate information, keep your password secure and are responsible for activity on your account. One person, one account; you may manage several projects and organizations from it.</p>
      <h2 className="mt-6 text-lg font-semibold text-ink">2. Content you publish</h2>
      <p className="mt-2">You keep ownership of what you post. You grant us a licence to display it on the platform as needed to operate the service. Don&apos;t post content that is illegal, misleading, hateful, harassing or infringes others&apos; rights.</p>
      <h2 className="mt-6 text-lg font-semibold text-ink">3. Opportunities and collaborations</h2>
      <p className="mt-2">Agreements between members (paid work, partnerships, equity, volunteering) are made directly between them. We are not a party to them and don&apos;t guarantee outcomes, payments or the accuracy of listings.</p>
      <h2 className="mt-6 text-lg font-semibold text-ink">4. Moderation</h2>
      <p className="mt-2">We may remove content or suspend accounts that break these terms. You can report content and profiles from their pages.</p>
      <h2 className="mt-6 text-lg font-semibold text-ink">5. Ending your account</h2>
      <p className="mt-2">You can deactivate or permanently delete your account at any time from Settings.</p>
    </article>
  );
}
