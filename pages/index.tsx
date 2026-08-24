import Head from 'next/head';
import { profile } from '../lib/profile';

const mainLinks = [
  { label: 'super charles', href: 'https://app.collinrijock.com/home' },
  { label: 'exowatt', href: profile.companyUrl },
  { label: 'blog', href: 'https://app.collinrijock.com/blog' },
  { label: 'github', href: profile.links.github },
  { label: 'for agents', href: 'https://app.collinrijock.com/llms.txt' },
];

const footerLinks = [
  { label: 'gh', href: profile.links.github },
  { label: 'x', href: profile.links.twitter },
  { label: 'in', href: profile.links.linkedin },
  { label: 'itch', href: 'https://collinrijock.itch.io' },
  { label: 'email', href: `mailto:${profile.email}` },
];

export default function Home() {
  return (
    <>
      <Head>
        <title>{profile.name}</title>
        <meta name="description" content={profile.metaDescription} />
        <meta name="author" content={profile.name} />
        <link rel="canonical" href={profile.siteUrl} />
        <link rel="icon" href="/favicon.ico" />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={profile.siteUrl} />
        <meta property="og:title" content={profile.name} />
        <meta property="og:description" content={profile.metaDescription} />
      </Head>

      <main className="minimal-home">
        <div className="minimal-home__content">
          <header aria-labelledby="home-title">
            <h1 id="home-title">{profile.name.toLowerCase()}</h1>
            <p>i like to build a lot of different things.</p>
          </header>

          <nav aria-label="primary" className="minimal-home__nav">
            <ul>
              {mainLinks.map((link) => (
                <li key={link.href}>
                  <a href={link.href}>{link.label}</a>
                </li>
              ))}
            </ul>
          </nav>

          <footer className="minimal-home__footer" aria-label="social links">
            <ul>
              {footerLinks.map((link) => (
                <li key={link.href}>
                  <a href={link.href}>{link.label}</a>
                </li>
              ))}
            </ul>
          </footer>
        </div>
      </main>
    </>
  );
}
