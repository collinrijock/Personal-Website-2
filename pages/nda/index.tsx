// /nda: the projects collin keeps under nda, for people he approved.
// server-rendered: the content is only read, rendered and sent when the access
// cookie is valid and the request is still approved. everyone else gets the
// lock page, and the content never leaves the server.
//
// each person sees only the sections they were granted, read fresh from the
// request log on every load (so scripts/nda.mjs grant / ungrant apply on the
// next load). sections they weren't granted are never read, let alone sent.
import type { GetServerSideProps, PageConfig } from "next";
import Link from "next/link";
import Shell, { Lock } from "@/components/nda/Shell";
import { loadSections } from "@/lib/nda/content";
import { currentAccess } from "@/lib/nda/flow";
import { privateHeaders } from "@/lib/nda/http";
import { grantedSections, ndaTextFor } from "@/lib/nda/store";

export const config: PageConfig = { unstable_runtimeJS: false };

type Props =
  | { locked: true; why: "expired" | "invalid" | "revoked" | null }
  | {
      locked: false;
      name: string;
      email: string;
      signature: string;
      signedAt: string;
      version: string;
      agreement: string | null;
      sections: { id: string; label: string; intro: string; projects: { title: string; html: string }[]; empty: boolean }[];
    };

const date = (iso: string) => new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" }).toLowerCase();

export const getServerSideProps: GetServerSideProps<Props> = async ({ req, res, query }) => {
  privateHeaders(res);
  const r = currentAccess(req);
  if (!r) {
    const e = typeof query.e === "string" ? query.e : "";
    return { props: { locked: true, why: e === "expired" || e === "invalid" || e === "revoked" ? e : null } };
  }
  const sections = loadSections(grantedSections(r)).map((s) => ({
    id: s.id,
    label: s.label,
    intro: s.content?.intro || "",
    projects: s.content?.projects || [],
    empty: !s.content,
  }));
  return {
    props: {
      locked: false,
      name: r.name,
      email: r.email,
      signature: r.signature,
      signedAt: r.signed_at,
      version: r.nda_version,
      agreement: ndaTextFor(r.nda_version),
      sections,
    },
  };
};

const WHY = {
  expired: "that link has expired.",
  invalid: "that link isn't valid.",
  revoked: "that access has ended.",
};

export default function Nda(p: Props) {
  if (p.locked) {
    return (
      <Shell title="under nda · collin rijock" label="under nda">
        <section className="nda-locked">
          <div className="nda-badge">
            <Lock size={26} />
          </div>
          {p.why && <p className="nda-why">{WHY[p.why]}</p>}
          <h1>this part is under nda.</h1>
          <p>some of my work isn&apos;t public yet, from exowatt and my own projects. sign a short nda, and if i approve it you&apos;ll get a private link to them by email.</p>
          <p className="nda-actions">
            <Link className="nda-btn" href="/#request-access">
              <Lock size={16} />
              request access <span aria-hidden="true">→</span>
            </Link>
            <Link className="nda-quiet" href="/">
              back to the canvas
            </Link>
          </p>
        </section>
      </Shell>
    );
  }
  return (
    <Shell title="under nda · collin rijock" label="under nda">
      <header className="nda-head">
        <p className="nda-shared">
          <Lock size={14} />
          shared under nda with {p.name}
        </p>
        <h1>my work, under nda.</h1>
        {p.sections.length > 1 && (
          <nav className="nda-toc" aria-label="sections">
            {p.sections.map((s) => (
              <a key={s.id} href={`#${s.id}`}>
                {s.label}
              </a>
            ))}
          </nav>
        )}
      </header>
      {p.sections.length === 0 ? (
        <p className="nda-empty">nothing here yet. i&apos;m still writing it up.</p>
      ) : (
        p.sections.map((s) => (
          <section className="nda-sec" id={s.id} key={s.id} aria-labelledby={`h-${s.id}`}>
            <h2 className="nda-sec-h" id={`h-${s.id}`}>
              {s.label}
            </h2>
            {s.empty ? (
              <p className="nda-empty">nothing here yet.</p>
            ) : (
              <>
                {s.intro ? <div className="nda-intro nda-prose" dangerouslySetInnerHTML={{ __html: s.intro }} /> : null}
                {s.projects.length > 0 && (
                  <div className="nda-projects">
                    {s.projects.map((proj, i) => (
                      <article className="nda-proj" key={i}>
                        <h3 dangerouslySetInnerHTML={{ __html: proj.title }} />
                        <div className="nda-prose" dangerouslySetInnerHTML={{ __html: proj.html }} />
                      </article>
                    ))}
                  </div>
                )}
              </>
            )}
          </section>
        ))
      )}
      <section className="nda-signed">
        <p>
          this page is confidential under the agreement you signed on {date(p.signedAt)}. please don&apos;t share it, or the link.
        </p>
        <details>
          <summary>what you signed</summary>
          <div className="nda-terms">{p.agreement || "(the text of this version isn't on file.)"}</div>
          <p className="nda-sigline">
            signed: {p.signature} &lt;{p.email}&gt; · {date(p.signedAt)} · version {p.version}
          </p>
        </details>
      </section>
    </Shell>
  );
}
