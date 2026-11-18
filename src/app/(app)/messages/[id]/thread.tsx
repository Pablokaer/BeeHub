"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { sendMessageAction } from "@/app/actions/social";
import { ActionForm, SubmitButton } from "@/components/ui/form";
import { RichText } from "@/components/rich-text";
import { cn } from "@/components/ui/cn";

type Msg = { id: string; body: string; senderId: string; createdAt: string };

/** Conversation view: renders server messages, polls for new ones every few seconds. */
export function Thread({ conversationId, viewerId, initial, canSend, otherName, otherLastReadAt }: { conversationId: string; viewerId: string; initial: Msg[]; canSend: boolean; otherName: string; otherLastReadAt: string | null }) {
  const [polled, setPolled] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const bottom = useRef<HTMLDivElement>(null);
  const messages = useMemo(() => {
    const map = new Map<string, Msg>();
    for (const m of [...initial, ...polled]) map.set(m.id, m);
    return [...map.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }, [initial, polled]);
  const last = messages[messages.length - 1]?.createdAt;

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  useEffect(() => {
    let stop = false;
    const tick = async () => {
      if (document.hidden) return;
      try {
        const res = await fetch(`/api/messages/${conversationId}?after=${encodeURIComponent(last ?? new Date(0).toISOString())}`, { cache: "no-store" });
        if (!res.ok || stop) return;
        const data = (await res.json()) as { messages: Msg[] };
        if (data.messages.length) setPolled((p) => [...p, ...data.messages]);
      } catch {
        /* offline: try again on the next tick */
      }
    };
    const id = setInterval(tick, 4000);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, [conversationId, last]);

  const lastMine = [...messages].reverse().find((m) => m.senderId === viewerId);
  const seen = lastMine && otherLastReadAt && otherLastReadAt >= lastMine.createdAt;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ol className="flex flex-1 flex-col gap-2 overflow-y-auto p-4" aria-live="polite" aria-label={`Messages with ${otherName}`}>
        {messages.length === 0 && <li className="m-auto text-sm text-muted">Introduce yourself and why you&apos;re reaching out.</li>}
        {messages.map((m) => {
          const mine = m.senderId === viewerId;
          return (
            <li key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
              <div className={cn("max-w-[80%] rounded-2xl px-3.5 py-2 text-sm", mine ? "rounded-br-sm bg-accent text-accent-ink [&_a]:text-accent-ink [&_a]:underline" : "rounded-bl-sm bg-sunken text-ink")}>
                <RichText text={m.body} />
                <time dateTime={m.createdAt} className={cn("mt-0.5 block text-right text-[10.5px]", mine ? "text-accent-ink/70" : "text-muted")}>
                  {new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </time>
              </div>
            </li>
          );
        })}
        {seen && <li className="text-right text-[11px] text-muted">Seen</li>}
        <div ref={bottom} />
      </ol>
      {canSend ? (
        <ActionForm action={sendMessageAction} resetOnSuccess successToast={false} onSuccess={() => setDraft("")} className="flex items-end gap-2 border-t border-line p-3">
          <input type="hidden" name="conversationId" value={conversationId} />
          <label htmlFor="msg-body" className="sr-only">
            Message
          </label>
          <textarea
            id="msg-body"
            name="body"
            rows={1}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (draft.trim()) e.currentTarget.form?.requestSubmit();
              }
            }}
            maxLength={4000}
            placeholder="Write a message… (Enter to send, Shift+Enter for a new line)"
            className="max-h-40 min-h-9 flex-1 resize-y rounded-md border border-line-strong bg-surface px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
          />
          <SubmitButton disabled={!draft.trim()}>Send</SubmitButton>
        </ActionForm>
      ) : (
        <p className="border-t border-line p-3 text-center text-[13px] text-muted">You can&apos;t reply to this conversation.</p>
      )}
    </div>
  );
}
