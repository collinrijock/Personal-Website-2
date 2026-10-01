// every setting the nda gate reads, in one place. see docs/nda.md.
import os from "os";
import path from "path";

export type MailMode = "smtp" | "file" | "off";

function env(name: string): string {
  return (process.env[name] || "").trim();
}

export function ndaConfig() {
  const siteUrl = (env("SITE_URL") || "https://collinrijock.com").replace(/\/+$/, "");
  const dataDir = env("NDA_DATA_DIR") || path.join(os.homedir(), "srv/personal-website/shared/nda");
  const secret = env("NDA_SECRET");
  const smtpUser = env("SMTP_USER");
  const smtpPass = env("SMTP_PASS");
  const transport = env("MAIL_TRANSPORT").toLowerCase();
  let mail: MailMode = "off";
  if (transport === "file") mail = "file";
  else if (transport !== "off" && smtpUser && smtpPass) mail = "smtp";
  return {
    siteUrl,
    siteOrigin: safeOrigin(siteUrl),
    dataDir,
    secret,
    ownerEmail: env("NDA_OWNER_EMAIL") || "collinrijock@gmail.com",
    notifyDenied: env("NDA_NOTIFY_DENIED") !== "0",
    mail,
    smtp: {
      host: env("SMTP_HOST") || "smtp.gmail.com",
      port: Number(env("SMTP_PORT") || 465),
      user: smtpUser,
      pass: smtpPass,
    },
    mailFrom: env("MAIL_FROM") || (smtpUser ? `collin rijock <${smtpUser}>` : "collin rijock <nda@localhost>"),
  };
}

function safeOrigin(u: string): string {
  try {
    return new URL(u).origin;
  } catch {
    return "https://collinrijock.com";
  }
}

// requests are open when there is a real secret and a way to send mail
export function ndaOpen(): { open: boolean; why?: string } {
  const c = ndaConfig();
  if (c.secret.length < 16) return { open: false, why: "NDA_SECRET is not set (or shorter than 16 characters)" };
  if (c.mail === "off") return { open: false, why: "mail is not configured (set SMTP_USER and SMTP_PASS, or MAIL_TRANSPORT=file)" };
  return { open: true };
}

export const DAY = 24 * 60 * 60 * 1000;
export const DECIDE_TTL = 14 * DAY;
export const ACCESS_TTL = 90 * DAY;
export const COOKIE_NAME = "nda_access";
