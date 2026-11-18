import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ create: vi.fn(), update: vi.fn(), sendMail: vi.fn(), error: vi.fn() }));
vi.mock("@/server/db", () => ({ db: { emailOutbox: { create: mocks.create, update: mocks.update } } }));
vi.mock("@/server/env", () => ({ env: () => ({ NODE_ENV: "production", SMTP_URL: "smtp://test.invalid", MAIL_FROM: "app@test.invalid" }) }));
vi.mock("@/server/logger", () => ({ logger: { error: mocks.error } }));
vi.mock("nodemailer", () => ({ default: { createTransport: () => ({ sendMail: mocks.sendMail }) } }));
import { sendEmail } from "@/server/mail/mailer";
beforeEach(() => { vi.resetAllMocks(); mocks.create.mockResolvedValue({ id: "mail-1" }); });
it("delivers the recovery link without persisting its bearer token in production", async () => {
  const text = "https://app.test/reset?token=secret-recovery-token";
  await sendEmail({ to: "member@test.invalid", kind: "password-reset", subject: "Reset", text });
  expect(mocks.sendMail).toHaveBeenCalledWith(expect.objectContaining({ text }));
  expect(JSON.stringify(mocks.create.mock.calls)).not.toContain("secret-recovery-token");
});
it("does not persist SMTP exception details in the production outbox", async () => {
  mocks.sendMail.mockRejectedValue(new Error("smtp://user:secret-password@test.invalid"));
  await sendEmail({ to: "member@test.invalid", kind: "password-reset", subject: "Reset", text: "token" });
  expect(mocks.update).toHaveBeenCalledWith({ where: { id: "mail-1" }, data: { status: "FAILED", error: "Delivery failed" } });
});
