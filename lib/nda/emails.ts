// the three emails: the request (to collin), approved and denied (to the
// requester). plain table html with inline styles so gmail renders it, plus a
// text version. every value that came from a person is escaped.
import { esc } from "./http";
import { NDA_TEXT } from "./nda-text";
import { sectionLabel, sectionList, type SectionId } from "./sections";
import type { NdaRequest, RequestLine } from "./store";

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";
const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
const INK = "#0b1020", INK2 = "#4a5468", INK3 = "#8a93a6", LINE = "#e8ebf2";

const when = (iso: string) => {
  const d = new Date(iso);
  return isNaN(+d) ? iso : `${d.toISOString().slice(0, 16).replace("T", " ")} utc`;
};
const day = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const first = (name: string) => name.split(/\s+/)[0] || name;

function layout(title: string, preheader: string, body: string): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(title)}</title></head>
<body style="margin:0;padding:0;background:#f4f5f8;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f5f8;">
<tr><td align="center" style="padding:32px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:#ffffff;border-radius:16px;border:1px solid ${LINE};">
<tr><td style="height:4px;line-height:4px;font-size:0;border-radius:16px 16px 0 0;background:#6a2bff;background-image:linear-gradient(90deg,#18a0ff,#6a2bff,#ff2d87,#ff7a1a);">&nbsp;</td></tr>
<tr><td style="padding:28px 32px 8px;font-family:${FONT};color:${INK};">
<p style="margin:0 0 6px;font-family:${MONO};font-size:12px;color:${INK3};">collin rijock · under nda</p>
${body}
</td></tr>
<tr><td style="padding:8px 32px 28px;font-family:${MONO};font-size:11px;line-height:1.5;color:${INK3};">collinrijock.com</td></tr>
</table>
</td></tr></table>
</body></html>`;
}

function button(href: string, label: string, bg: string, fg: string, border = bg): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="display:inline-table;margin:0 10px 10px 0;"><tr>
<td align="center" bgcolor="${bg}" style="border-radius:999px;border:2px solid ${border};">
<a href="${esc(href)}" target="_blank" style="display:inline-block;padding:15px 34px;font-family:${FONT};font-size:17px;font-weight:600;line-height:1;color:${fg};text-decoration:none;border-radius:999px;">${esc(label)}</a>
</td></tr></table>`;
}

// the smaller pill for the row of approve presets
function pill(href: string, label: string, primary: boolean): string {
  const bg = primary ? "#0b1020" : "#ffffff", fg = primary ? "#ffffff" : INK, border = primary ? "#0b1020" : "#cfd4e0";
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="display:inline-table;margin:0 8px 8px 0;"><tr>
<td align="center" bgcolor="${bg}" style="border-radius:999px;border:1.5px solid ${border};">
<a href="${esc(href)}" target="_blank" style="display:inline-block;padding:11px 18px;font-family:${FONT};font-size:15px;font-weight:600;line-height:1;color:${fg};text-decoration:none;border-radius:999px;white-space:nowrap;">${esc(label)}</a>
</td></tr></table>`;
}

const interestText = (ids: SectionId[] | undefined) => (ids && ids.length ? ids.map(sectionLabel).join(", ") : "");

function rows(pairs: [string, string][]): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:18px 0 22px;border-top:1px solid ${LINE};">
${pairs
  .map(
    ([k, v]) => `<tr><td valign="top" style="padding:9px 12px 9px 0;width:130px;border-bottom:1px solid ${LINE};font-family:${MONO};font-size:12px;color:${INK3};">${esc(k)}</td>
<td valign="top" style="padding:9px 0;border-bottom:1px solid ${LINE};font-family:${FONT};font-size:15px;line-height:1.5;color:${INK};white-space:pre-wrap;word-break:break-word;">${v}</td></tr>`
  )
  .join("\n")}
</table>`;
}

function agreementBox(r: Pick<RequestLine, "signature" | "signed_at" | "nda_version" | "email">): string {
  const paras = NDA_TEXT.split(/\n\n/)
    .map((p) => `<p style="margin:0 0 10px;">${esc(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
  return `<div style="margin:6px 0 4px;padding:16px 18px;border-radius:12px;background:#f7f8fb;border:1px solid ${LINE};font-family:${FONT};font-size:13px;line-height:1.55;color:${INK2};">
${paras}
<p style="margin:14px 0 0;padding-top:12px;border-top:1px solid ${LINE};font-family:${MONO};font-size:12px;color:${INK};">signed: ${esc(r.signature)} &lt;${esc(r.email)}&gt;<br>on: ${esc(when(r.signed_at))}<br>version: ${esc(r.nda_version)}</p>
</div>`;
}

const agreementText = (r: Pick<RequestLine, "signature" | "signed_at" | "nda_version" | "email">) =>
  `${NDA_TEXT}\n\n---\nsigned: ${r.signature} <${r.email}>\non: ${when(r.signed_at)}\nversion: ${r.nda_version}`;

export interface ApproveLink {
  key: string;
  label: string;
  sections: SectionId[];
  url: string;
}

export function ownerRequestEmail(r: RequestLine, approves: ApproveLink[], denyUrl: string, expires: number, notifyDenied: boolean) {
  const interests = interestText(r.interests);
  const subject = `nda request: ${r.name}${r.company ? ` · ${r.company}` : ""}`;
  const html = layout(
    subject,
    `${r.name} signed the nda and wants to see your private projects.`,
    `<h1 style="margin:0 0 6px;font-size:24px;line-height:1.2;font-weight:650;letter-spacing:-0.02em;">${esc(r.name)} wants to see your nda projects</h1>
<p style="margin:0;font-size:15px;line-height:1.55;color:${INK2};">they signed the agreement below. approve and they get a private link for 90 days to the sections you pick. deny and ${notifyDenied ? "they get a short, polite note" : "they hear nothing"}.</p>
${rows([
  ["name", esc(r.name)],
  ["email", `<a href="mailto:${esc(r.email)}" style="color:${INK};">${esc(r.email)}</a>`],
  ["company", r.company ? esc(r.company) : `<span style="color:${INK3};">none given</span>`],
  ["wants to see", esc(r.reason)],
  ["most interested in", interests ? esc(interests) : `<span style="color:${INK3};">didn't say</span>`],
  ["signed as", esc(r.signature)],
  ["signed at", esc(when(r.signed_at))],
  ["nda version", `<span style="font-family:${MONO};font-size:13px;">${esc(r.nda_version)}</span>`],
  ["ip", `<span style="font-family:${MONO};font-size:13px;">${esc(r.ip)}</span>`],
  ["browser", `<span style="font-size:13px;color:${INK2};">${esc(r.user_agent)}</span>`],
  ["request id", `<span style="font-family:${MONO};font-size:13px;">${esc(r.id)}</span>`],
])}
<p style="margin:0 0 10px;font-family:${MONO};font-size:12px;color:${INK3};">approve, and let them see</p>
<div style="margin:0 0 4px;">${approves.map((a, i) => pill(a.url, a.label, i === 0)).join("")}</div>
<p style="margin:0 0 20px;font-size:13px;line-height:1.5;color:${INK3};">"choose…" starts with ${interests ? `what they asked for (${esc(interests)})` : "nothing ticked"}. on every one you can still change the sections before you confirm.</p>
<div style="margin:0 0 6px;">${button(denyUrl, "Deny", "#ffffff", "#b4233c", "#f2c4cd")}</div>
<p style="margin:0 0 26px;font-size:13px;line-height:1.5;color:${INK3};">each button opens a page where you confirm. nothing happens until you press confirm there, so link scanners can't decide for you. the links work until ${esc(day(expires))}.</p>
<p style="margin:0 0 8px;font-family:${MONO};font-size:12px;color:${INK3};">what they signed</p>
${agreementBox(r)}`
  );
  const text = `${r.name} wants to see your nda projects.

name: ${r.name}
email: ${r.email}
company: ${r.company || "none given"}
wants to see: ${r.reason}
most interested in: ${interests || "didn't say"}
signed as: ${r.signature}
signed at: ${when(r.signed_at)}
nda version: ${r.nda_version}
ip: ${r.ip}
browser: ${r.user_agent}
request id: ${r.id}

approve, and let them see:
${approves.map((a) => `  ${a.label}: ${a.url}`).join("\n")}

deny: ${denyUrl}

each link opens a confirm page; nothing happens until you confirm. the links work until ${day(expires)}.

what they signed:

${agreementText(r)}
`;
  return { subject, html, text };
}

export function approvedEmail(r: NdaRequest, sections: SectionId[], accessUrl: string, expires: number) {
  const subject = "your access to collin rijock's nda projects";
  const what = sectionList(sections);
  const listHtml = `<ul style="margin:0 0 22px;padding:0 0 0 20px;font-size:15px;line-height:1.7;color:${INK};">${sections.map((id) => `<li>${esc(sectionLabel(id))}</li>`).join("")}</ul>`;
  const html = layout(
    subject,
    "collin approved your request. here's your private link.",
    `<h1 style="margin:0 0 10px;font-size:24px;line-height:1.2;font-weight:650;letter-spacing:-0.02em;">you're in, ${esc(first(r.name))}.</h1>
<p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:${INK2};">i approved your request to see some of the work i keep under nda. this link is just for you. it works until ${esc(day(expires))}. it opens:</p>
${listHtml}
<div style="margin:0 0 14px;">${button(accessUrl, "open the projects", "#0b1020", "#ffffff")}</div>
<p style="margin:0 0 26px;font-size:13px;line-height:1.55;color:${INK3};">please don't forward it: what's behind it is covered by the agreement you signed, a copy of which is below. if the button doesn't work, paste this into your browser:<br><span style="font-family:${MONO};font-size:12px;word-break:break-all;color:${INK2};">${esc(accessUrl)}</span></p>
<p style="margin:0 0 28px;font-size:15px;line-height:1.6;color:${INK2};">thanks for the interest. reply to this email if you want to talk about any of it.<br>collin</p>
<p style="margin:0 0 8px;font-family:${MONO};font-size:12px;color:${INK3};">what you signed</p>
${agreementBox(r)}`
  );
  const text = `you're in, ${first(r.name)}.

i approved your request to see some of the work i keep under nda: ${what}. this link is just for you, and works until ${day(expires)}:

${accessUrl}

please don't forward it: what's behind it is covered by the agreement you signed, copied below.

thanks for the interest. reply to this email if you want to talk about any of it.
collin

---
what you signed:

${agreementText(r)}
`;
  return { subject, html, text };
}

export function deniedEmail(r: NdaRequest) {
  const subject = "about your nda request";
  const html = layout(
    subject,
    "thanks for asking.",
    `<h1 style="margin:0 0 10px;font-size:24px;line-height:1.2;font-weight:650;letter-spacing:-0.02em;">thanks for asking, ${esc(first(r.name))}.</h1>
<p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:${INK2};">i can't share the work i keep under nda with you right now. it's nothing personal, and i appreciate the interest.</p>
<p style="margin:0 0 6px;font-size:15px;line-height:1.6;color:${INK2};">the rest of what i've built is on the site, and you're welcome to reply here.<br>collin</p>`
  );
  const text = `thanks for asking, ${first(r.name)}.

i can't share the work i keep under nda with you right now. it's nothing personal, and i appreciate the interest.

the rest of what i've built is on the site, and you're welcome to reply here.
collin
`;
  return { subject, html, text };
}
