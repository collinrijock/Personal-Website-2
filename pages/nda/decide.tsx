// /nda/decide?token=… : where the approve / deny buttons in collin's email land.
// email link scanners fetch links like this one, so a GET only shows the
// request and a confirm button. the decision is a POST to /api/nda/decide.
import type { GetServerSideProps, PageConfig } from "next";
import Shell, { Lock } from "@/components/nda/Shell";
import { viewDecision } from "@/lib/nda/flow";
import { privateHeaders } from "@/lib/nda/http";

export const config: PageConfig = { unstable_runtimeJS: false };

interface Summary {
  id: string;
  name: string;
  email: string;
  company: string;
  reason: string;
  signature: string;
  signedAt: string;
  version: string;
  ip: string;
  status: string;
  decidedAt: string | null;
}
type Props =
  | { state: "invalid" | "expired" | "missing" }
  | { state: "ready" | "done"; action: "approve" | "deny"; token: string; request: Summary; flash: "1" | "nomail" | "already" | "failed" | null };

const when = (iso: string | null) => (iso ? `${new Date(iso).toISOString().slice(0, 16).replace("T", " ")} utc` : "");

export const getServerSideProps: GetServerSideProps<Props> = async ({ res, query }) => {
  privateHeaders(res);
  const token = typeof query.token === "string" ? query.token : "";
  const v = viewDecision(token);
  if (v.state === "invalid" || v.state === "expired" || v.state === "missing") return { props: { state: v.state } };
  const r = v.request;
  const flash = typeof query.done === "string" && ["1", "nomail", "already"].includes(query.done) ? (query.done as "1" | "nomail" | "already") : query.failed ? "failed" : null;
  return {
    props: {
      state: v.state,
      action: v.action,
      token,
      flash,
      request: {
        id: r.id,
        name: r.name,
        email: r.email,
        company: r.company,
        reason: r.reason,
        signature: r.signature,
        signedAt: r.signed_at,
        version: r.nda_version,
        ip: r.ip,
        status: r.status,
        decidedAt: r.decided_at || null,
      },
    },
  };
};

const BAD = {
  invalid: ["this link isn't valid.", "it may have been copied wrong. the buttons in the email are the way in."],
  expired: ["this link has expired.", "decision links last 14 days. you can still decide with scripts/nda.mjs (see docs/nda.md)."],
  missing: ["that request isn't on file.", "it may have been made against a different data directory."],
};

export default function Decide(p: Props) {
  if (!("request" in p)) {
    return (
      <Shell title="nda request · collin rijock" label="nda request">
        <section className="nda-locked">
          <div className="nda-badge">
            <Lock size={26} />
          </div>
          <h1>{BAD[p.state][0]}</h1>
          <p>{BAD[p.state][1]}</p>
        </section>
      </Shell>
    );
  }
  const r = p.request;
  const approve = p.action === "approve";
  return (
    <Shell title="nda request · collin rijock" label="nda request">
      <section className={`nda-decide ${approve ? "is-approve" : "is-deny"}`}>
        {p.state === "ready" ? (
          <>
            <h1>{approve ? `approve ${r.name}?` : `deny ${r.name}?`}</h1>
            <p className="nda-lede">{approve ? "they'll get an email with a private link to /nda that works for 90 days, and a copy of what they signed." : "they won't get access. if notes are on, they'll get a short, polite email."}</p>
          </>
        ) : (
          <>
            <p className={`nda-state s-${r.status}`}>{r.status}</p>
            <h1>
              {p.flash === "already" ? "this one was already decided." : `${r.name} is ${r.status}.`}
            </h1>
            <p className="nda-lede">
              {r.status === "approved" && p.flash === "nomail"
                ? "approved, but the email to them didn't send. run `node scripts/nda.mjs link " + r.id + "` and send them the link yourself."
                : r.decidedAt
                ? `decided ${when(r.decidedAt)}. each request can only be decided once.`
                : "each request can only be decided once."}
            </p>
          </>
        )}
        <dl className="nda-facts">
          <dt>name</dt>
          <dd>{r.name}</dd>
          <dt>email</dt>
          <dd>{r.email}</dd>
          <dt>company</dt>
          <dd>{r.company || <span className="nda-dim">none given</span>}</dd>
          <dt>wants to see</dt>
          <dd className="nda-reason">{r.reason}</dd>
          <dt>signed as</dt>
          <dd>{r.signature}</dd>
          <dt>signed at</dt>
          <dd>{when(r.signedAt)}</dd>
          <dt>nda version</dt>
          <dd className="nda-mono">{r.version}</dd>
          <dt>ip</dt>
          <dd className="nda-mono">{r.ip}</dd>
          <dt>request</dt>
          <dd className="nda-mono">{r.id}</dd>
        </dl>
        {p.state === "ready" && (
          <form method="post" action="/api/nda/decide" className="nda-confirm">
            <input type="hidden" name="token" value={p.token} />
            <button type="submit" className={`nda-btn ${approve ? "" : "is-deny"}`}>
              {approve ? "confirm: approve access" : "confirm: deny"}
            </button>
            <span className="nda-dim">nothing has happened yet. this button decides it, once.</span>
          </form>
        )}
      </section>
    </Shell>
  );
}
