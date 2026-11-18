import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-2xl px-4 py-12 text-[15px] leading-relaxed text-ink-2">
      <p className="eyebrow">Template · review with legal counsel before launch</p>
      <h1 className="mt-2 text-3xl font-semibold text-ink">Privacy Policy</h1>
      <h2 className="mt-8 text-lg font-semibold text-ink">What we collect</h2>
      <p className="mt-2">Account data (email, username, password hash), the profile information you choose to add, content you publish, your connections and follows, messages you send, and security logs (sign-ins, IP address, device) used to protect your account.</p>
      <h2 className="mt-6 text-lg font-semibold text-ink">How we use it</h2>
      <p className="mt-2">To run the service: show your profile and content, deliver messages and notifications, and recommend relevant people and opportunities. Recommendations use only professional signals you provide (skills, interests, availability, collaboration preferences) and never sensitive personal attributes.</p>
      <h2 className="mt-6 text-lg font-semibold text-ink">Your controls</h2>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        <li>Choose who sees your profile, location and connections, who can message you and whether you appear in search.</li>
        <li>Block members and report content.</li>
        <li>Download a copy of your data (Settings → Your data).</li>
        <li>Deactivate or permanently delete your account, which erases your personal data and content.</li>
      </ul>
      <h2 className="mt-6 text-lg font-semibold text-ink">Legal basis (GDPR)</h2>
      <p className="mt-2">We process data to perform our contract with you, for our legitimate interest in keeping the platform safe, and with your consent where required. You can exercise your rights of access, rectification, erasure, restriction, portability and objection at any time.</p>
    </article>
  );
}
