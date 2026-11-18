import "server-only";
import { siteConfig } from "@/lib/constants";
import { env } from "../env";

const url = (path: string) => new URL(path, env().APP_URL).toString();

export function verifyEmailTemplate(name: string, token: string) {
  const link = url(`/verify-email?token=${encodeURIComponent(token)}`);
  return {
    subject: `Confirm your email for ${siteConfig.name}`,
    text: `Hi ${name},\n\nConfirm your email address to start publishing, applying and messaging on ${siteConfig.name}:\n\n${link}\n\nThis link expires in 48 hours. If you didn't create an account, you can ignore this message.\n`,
    link,
  };
}

export function resetPasswordTemplate(name: string, token: string) {
  const link = url(`/reset-password?token=${encodeURIComponent(token)}`);
  return {
    subject: `Reset your ${siteConfig.name} password`,
    text: `Hi ${name},\n\nSomeone (hopefully you) asked to reset your password. Use this link within 1 hour:\n\n${link}\n\nIf you didn't ask for this, you can ignore this email; your password stays the same.\n`,
    link,
  };
}

export function passwordChangedTemplate(name: string) {
  return {
    subject: `Your ${siteConfig.name} password was changed`,
    text: `Hi ${name},\n\nYour password was just changed and other sessions were signed out. If this wasn't you, reset your password immediately: ${url("/forgot-password")}\n`,
  };
}
