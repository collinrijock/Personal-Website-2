// /nda: the projects collin keeps under nda, for people he approved.
// server-rendered: the content is only read, rendered and sent when the access
// cookie is valid and the request is still approved. everyone else gets the
// lock page, and the content never leaves the server.
import type { GetServerSideProps, PageConfig } from "next";
import Link from "next/link";
import Shell, { Lock } from "@/components/nda/Shell";
import { loadProjects } from "@/lib/nda/content";
import { currentAccess } from "@/lib/nda/flow";
import { privateHeaders } from "@/lib/nda/http";
import { ndaTextFor } from "@/lib/nda/store";

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
      intro: string;
      projects: { title: string; html: string }[];
      empty: boolean;
    };

const date = (iso: string) => new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" }).toLowerCase();

export const getServerSideProps: GetServerSideProps<Props> = async ({ req, res, query }) => {
  privateHeaders(res);
  const r = currentAccess(req);
  if (!r) {
    const e = typeof query.e === "string" ? query.e : "";
    return { props: { locked: true, why: e === "expired" || e === "invalid" || e === "revoked" ? e : null } };
  }
  const content = loadProjects();
  return {
    props: {
      locked: false,
      name: r.name,
      email: r.email,
      signature: r.signature,
      signedAt: r.signed_at,
      version: r.nda_version,
      agreement: ndaTextFor(r.nda_version),
      intro: content?.intro || "",
      projects: content?.projects || [],
      empty: !content || (!content.projects.length && !content.intro.trim()),
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
          <p>some of my personal projects and side work aren&apos;t public yet. sign a short nda, and if i approve it you&apos;ll get a private link to them by email.</p>
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
        <h1>side projects, under nda.</h1>
        {p.intro ? <div className="nda-intro nda-prose" dangerouslySetInnerHTML={{ __html: p.intro }} /> : null}
      </header>
      {p.empty ? (
        <p className="nda-empty">nothing here yet. i&apos;m still writing it up.</p>
      ) : (
        <div className="nda-projects">
          {p.projects.map((proj, i) => (
            <article className="nda-proj" key={i}>
              <h2 dangerouslySetInnerHTML={{ __html: proj.title }} />
              <div className="nda-prose" dangerouslySetInnerHTML={{ __html: proj.html }} />
            </article>
          ))}
        </div>
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
