// the frame around the /nda pages: the site's fonts and css (public/css/site.css
// + nda.css), a quiet nav, and noindex. these pages ship no javascript.
import Head from "next/head";
import Link from "next/link";
import type { ReactNode } from "react";

export function Lock({ size = 18 }: { size?: number }) {
  return (
    <svg className="nda-lock-ico" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" d="M5.5 11h13v10h-13zM8 11V7.5a4 4 0 0 1 8 0V11" />
    </svg>
  );
}

export default function Shell({ title, label, children }: { title: string; label: string; children: ReactNode }) {
  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="robots" content="noindex, nofollow" />
        <meta name="referrer" content="no-referrer" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <link rel="icon" href="/favicon.ico" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font, @next/next/no-css-tags */}
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@300..700&family=Geist+Mono:wght@400;500&display=swap" />
        {/* eslint-disable-next-line @next/next/no-css-tags */}
        <link rel="stylesheet" href="/css/site.css" />
        {/* eslint-disable-next-line @next/next/no-css-tags */}
        <link rel="stylesheet" href="/css/nda.css" />
      </Head>
      <div className="nda-doc">
        <nav className="nda-nav wrap" aria-label="site">
          <Link className="nda-me" href="/">
            collin rijock
          </Link>
          <p className="label">
            <i style={{ ["--dot" as string]: "var(--c0)" }} />
            {label}
          </p>
        </nav>
        <main className="nda-main wrap">{children}</main>
        <footer className="nda-foot wrap">
          <p className="fine">
            © 2026 collin rijock · <Link href="/">back to the site</Link>
          </p>
        </footer>
      </div>
    </>
  );
}
