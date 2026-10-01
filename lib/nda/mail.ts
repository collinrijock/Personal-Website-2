// the mailer. smtp through nodemailer (gmail by default: smtp.gmail.com:465
// with an app password), or MAIL_TRANSPORT=file, which writes each message as
// .eml + .html into NDA_DATA_DIR/outbox/ for local testing.
import fs from "fs";
import path from "path";
import nodemailer from "nodemailer";
import { ndaConfig } from "./config";

export interface Message {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  kind: string; // for the outbox file name: owner-request, approved, denied
  ref: string; // request id
}

let smtp: nodemailer.Transporter | null = null;
let smtpKey = "";

function smtpTransport() {
  const c = ndaConfig();
  const key = `${c.smtp.host}:${c.smtp.port}:${c.smtp.user}`;
  if (!smtp || key !== smtpKey) {
    smtp = nodemailer.createTransport({
      host: c.smtp.host,
      port: c.smtp.port,
      secure: c.smtp.port === 465,
      auth: { user: c.smtp.user, pass: c.smtp.pass },
      connectionTimeout: 15_000,
      greetingTimeout: 15_000,
      socketTimeout: 30_000,
    });
    smtpKey = key;
  }
  return smtp;
}

const oneLine = (s: string) => s.replace(/[\r\n]+/g, " ").trim();

export async function sendMail(m: Message): Promise<void> {
  const c = ndaConfig();
  const mail = {
    from: c.mailFrom,
    to: m.to,
    subject: oneLine(m.subject),
    html: m.html,
    text: m.text,
    ...(m.replyTo ? { replyTo: m.replyTo } : {}),
  };
  if (c.mail === "file") {
    const out = path.join(c.dataDir, "outbox");
    fs.mkdirSync(out, { recursive: true, mode: 0o700 });
    const t = nodemailer.createTransport({ streamTransport: true, buffer: true, newline: "unix" });
    const info: any = await t.sendMail(mail);
    const base = path.join(out, `${new Date().toISOString().replace(/[:.]/g, "-")}-${m.kind}-${m.ref}`);
    writeAtomic(`${base}.eml`, info.message as Buffer);
    writeAtomic(`${base}.html`, m.html);
    return;
  }
  if (c.mail === "smtp") {
    await smtpTransport().sendMail(mail);
    return;
  }
  throw new Error("mail is not configured");
}

function writeAtomic(file: string, data: string | Buffer) {
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, data, { mode: 0o600 });
  fs.renameSync(tmp, file);
}
