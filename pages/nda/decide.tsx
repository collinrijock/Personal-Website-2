// /nda/decide?token=… : where the approve / deny buttons in collin's email land.
// email link scanners fetch links like this one, so a GET only shows the
// request and a confirm button. the decision is a POST to /api/nda/decide.
//
// an approve link also carries the sections to start with ticked (one link per
// preset in the email). the four toggles stay editable here. the page ships no
// javascript: the count on the button and the "pick at least one" hint are css
// (a counter over the ticked boxes, and :has()).
import type { GetServerSideProps, PageConfig } from "next";
import Shell, { Lock } from "@/components/nda/Shell";
import { viewDecision } from "@/lib/nda/flow";
import { privateHeaders } from "@/lib/nda/http";
import { SECTIONS, sectionLabel, type SectionId } from "@/lib/nda/sections";
import { grantedSections } from "@/lib/nda/store";

export const config: PageConfig = { unstable_runtimeJS: false };

interface Summary {
  id: string;
  name: string;
  email: string;
  company: string;
  reason: string;
  interests: SectionId[];
  signature: string;
  signedAt: string;
  version: string;
  ip: string;
  status: string;
  decidedAt: string | null;
  granted: SectionId[];
}
type Flash = "1" | "nomail" | "already" | "failed" | "none" | null;
type Props =
  | { state: "invalid" | "expired" | "missing" }
  | { state: "ready" | "done"; action: "approve" | "deny"; token: string; denyToken: string | null; preset: SectionId[]; request: Summary; flash: Flash };

const when = (iso: string | null) => (iso ? `${new Date(iso).toISOString().slice(0, 16).replace("T", " ")} utc` : "");

export const getServerSideProps: GetServerSideProps<Props> = async ({ res, query }) => {
  privateHeaders(res);
  const token = typeof query.token === "string" ? query.token : "";
  const v = viewDecision(token);
  if (v.state === "invalid" || v.state === "expired" || v.state === "missing") return { props: { state: v.state } };
  const r = v.request;
  const done = typeof query.done === "string" && ["1", "nomail", "already"].includes(query.done) ? (query.done as "1" | "nomail" | "already") : null;
  const flash: Flash = done || (query.failed === "none" ? "none" : query.failed ? "failed" : null);
  return {
    props: {
      state: v.state,
      action: v.action,
      token,
      denyToken: v.denyToken,
      preset: v.preset,
      flash,
      request: {
        id: r.id,
        name: r.name,
        email: r.email,
        company: r.company,
        reason: r.reason,
        interests: r.interests || [],
        signature: r.signature,
        signedAt: r.signed_at,
        version: r.nda_version,
        ip: r.ip,
        status: r.status,
        decidedAt: r.decided_at || null,
        granted: grantedSections(r),
      },
    },
  };
};

const BAD = {
  invalid: ["this link isn't valid.", "it may have been copied wrong. the buttons in the email are the way in."],
  expired: ["this link has expired.", "decision links last 14 days. you can still decide with scripts/nda.mjs (see docs/nda.md)."],
  missing: ["that request isn't on file.", "it may have been made against a different data directory."],
};

const labels = (ids: SectionId[]) => ids.map(sectionLabel).join(", ");

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
  const n = p.preset.length;
  return (
    <Shell title="nda request · collin rijock" label="nda request">
      <section className={`nda-decide ${approve ? "is-approve" : "is-deny"}`}>
        {p.state === "ready" ? (
          <>
            {p.flash === "none" && <p className="nda-why">pick at least one section. nothing was decided.</p>}
            {p.flash === "failed" && <p className="nda-why">that didn&apos;t go through. nothing was decided.</p>}
            <h1>{approve ? `approve ${r.name}?` : `deny ${r.name}?`}</h1>
            <p className="nda-lede">
              {approve
                ? "pick what they can see. they'll get an email with a private link to /nda that works for 90 days, and a copy of what they signed. you can change the sections later with scripts/nda.mjs."
                : "they won't get access. if notes are on, they'll get a short, polite email."}
            </p>
          </>
        ) : (
          <>
            <p className={`nda-state s-${r.status}`}>{r.status}</p>
            <h1>{p.flash === "already" ? "this one was already decided." : `${r.name} is ${r.status}.`}</h1>
            <p className="nda-lede">
              {r.status === "approved" && p.flash === "nomail"
                ? "approved, but the email to them didn't send. run `node scripts/nda.mjs link " + r.id + "` and send them the link yourself."
                : r.decidedAt
                ? `decided ${when(r.decidedAt)}. each request can only be decided once.`
                : "each request can only be decided once."}
            </p>
          </>
        )}
        {p.state === "ready" && approve && (
          <form method="post" action="/api/nda/decide" className="nda-confirm nda-pick">
            <input type="hidden" name="token" value={p.token} />
            <fieldset className="nda-chips">
              <legend>what they can see</legend>
              {/* each box is a sibling of the others (not wrapped), so the css can tell one ticked from several */}
              {SECTIONS.map((s) => [
                <input key={`i-${s.id}`} className="nda-chk" type="checkbox" id={`s-${s.id}`} name="sections" value={s.id} defaultChecked={p.preset.includes(s.id)} />,
                <label key={`l-${s.id}`} className="nda-chip" htmlFor={`s-${s.id}`}>
                  <span className="nda-tick" aria-hidden="true" />
                  {s.label}
                  {r.interests.includes(s.id) && <em className="nda-asked">asked</em>}
                </label>,
              ])}
            </fieldset>
            <p className="nda-none">pick at least one section to approve.</p>
            <div className="nda-confirm-row">
              <button type="submit" className="nda-btn nda-approve">
{/* the server writes the starting count; css swaps in a live one (a counter over the ticked boxes).
                    one span, so the button's flex gap doesn't pull the words apart */}
                <span className="nda-btxt">
                  confirm: approve with <span className="nda-n"><span className="nda-n0">{n}</span></span> section<span className="nda-s"><span className="nda-s0">{n === 1 ? "" : "s"}</span></span>
                </span>
              </button>
              <span className="nda-dim">nothing has happened yet. this button decides it, once.</span>
            </div>
          </form>
        )}
        {p.state === "ready" && approve && p.denyToken && (
          <form method="post" action="/api/nda/decide" className="nda-alt">
            <input type="hidden" name="token" value={p.denyToken} />
            <button type="submit" className="nda-deny-btn">
              deny instead
            </button>
          </form>
        )}
        {p.state === "ready" && !approve && (
          <form method="post" action="/api/nda/decide" className="nda-confirm">
            <input type="hidden" name="token" value={p.token} />
            <button type="submit" className="nda-btn is-deny">
              confirm: deny
            </button>
            <span className="nda-dim">nothing has happened yet. this button decides it, once.</span>
          </form>
        )}
        <dl className="nda-facts">
          {r.status === "approved" && (
            <>
              <dt>can see</dt>
              <dd className="nda-cansee">{labels(r.granted)}</dd>
            </>
          )}
          <dt>name</dt>
          <dd>{r.name}</dd>
          <dt>email</dt>
          <dd>{r.email}</dd>
          <dt>company</dt>
          <dd>{r.company || <span className="nda-dim">none given</span>}</dd>
          <dt>wants to see</dt>
          <dd className="nda-reason">{r.reason}</dd>
          <dt>interested in</dt>
          <dd>{r.interests.length ? labels(r.interests) : <span className="nda-dim">didn&apos;t say</span>}</dd>
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
      </section>
    </Shell>
  );
}
