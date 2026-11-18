import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { db } from "../db";
import { env } from "../env";
import { logger } from "../logger";

export type OutgoingEmail = { to: string; subject: string; text: string; kind: string };

let transporter: Transporter | null | undefined;

function getTransport(): Transporter | null {
  if (transporter !== undefined) return transporter;
  const url = env().SMTP_URL;
  transporter = url ? nodemailer.createTransport(url) : null;
  return transporter;
}

/**
 * Every email is recorded in the outbox first. With SMTP configured it is delivered
 * immediately; without it (local development) it stays in the outbox with status
 * LOGGED and can be read at /dev/mailbox.
 */
export async function sendEmail(email: OutgoingEmail) {
  // Production outbox metadata must not retain reset links or private message bodies.
  const production = env().NODE_ENV === "production";
  const row = await db.emailOutbox.create({ data: {
    ...email, text: production ? "[Email body omitted in production]" : email.text, status: "QUEUED",
  } });
  const transport = getTransport();
  if (!transport) {
    await db.emailOutbox.update({ where: { id: row.id }, data: { status: "LOGGED" } });
    logger.info("mail.logged", { kind: email.kind, outboxId: row.id });
    return;
  }
  try {
    await transport.sendMail({ from: env().MAIL_FROM, to: email.to, subject: email.subject, text: email.text });
    await db.emailOutbox.update({ where: { id: row.id }, data: { status: "SENT", sentAt: new Date() } });
  } catch (err) {
    logger.error("mail.failed", { err, outboxId: row.id });
    await db.emailOutbox.update({
      where: { id: row.id },
      data: { status: "FAILED", error: production ? "Delivery failed" : err instanceof Error ? err.message.slice(0, 500) : "unknown" },
    });
  }
}
