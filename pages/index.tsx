import Head from 'next/head';
import { useEffect, useState } from 'react';
import ScrollStage from '../lib/sos/ScrollStage';
import Link from 'next/link';
import { GetStaticProps } from 'next';
import { staticContentData, ContentItem } from '../lib/content';
import { fetchBlogPosts, blogPostToContentItem } from '../lib/api';

const SITE_URL = 'https://collinrijock.com';

const personJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Person',
  name: 'Collin Rijock',
  url: SITE_URL,
  jobTitle: 'Lead Software Engineer',
  worksFor: {
    '@type': 'Organization',
    name: 'Exowatt',
    url: 'https://exowatt.com',
  },
  alumniOf: {
    '@type': 'CollegeOrUniversity',
    name: 'Florida International University',
  },
  address: {
    '@type': 'PostalAddress',
    addressLocality: 'Miami',
    addressRegion: 'FL',
    addressCountry: 'US',
  },
  sameAs: [
    'https://github.com/collinrijock',
    'https://x.com/CollinRijock',
    'https://linkedin.com/in/collinrijock',
  ],
  description:
    'Lead Software Engineer at Exowatt. Founding engineer, full-stack builder, and explorer based in Miami.',
};

interface HomeProps {
  contentData: ContentItem[];
}

export default function Home({ contentData }: HomeProps) {
  const [isBlipVisible, setIsBlipVisible] = useState(true);

  useEffect(() => {
    document.body.classList.add('home-background');

    if (!document.querySelector('.webgl')) {
      document.body.classList.add('loading');
      const stage = new ScrollStage();
    }

    return () => {
      document.body.classList.remove('home-background');
    };
  }, []);

  return (
    <>
      <Head>
        <title>Collin Rijock — Engineer. Founder. Explorer.</title>
        <meta
          name="description"
          content="Lead Software Engineer at Exowatt. Founding engineer and full-stack builder based in Miami — previously BuildrFi (AI fintech) and Lula (Series B insurtech, $2M→$30M ARR)."
        />
        <meta
          name="keywords"
          content="collin rijock, software engineer, founding engineer, full-stack, react, typescript, node.js, miami, exowatt, fintech, startups, essays"
        />
        <meta name="author" content="Collin Rijock" />
        <link rel="canonical" href={SITE_URL} />
        <link rel="icon" href="/favicon.ico" />

        {/* Open Graph */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content={SITE_URL} />
        <meta property="og:title" content="Collin Rijock — Engineer. Founder. Explorer." />
        <meta
          property="og:description"
          content="Lead Software Engineer at Exowatt. Founding engineer and full-stack builder based in Miami — previously BuildrFi (AI fintech) and Lula (Series B insurtech, $2M→$30M ARR)."
        />
        <meta property="og:image" content={`${SITE_URL}/og-image.png`} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:site_name" content="Collin Rijock" />
        <meta property="og:locale" content="en_US" />

        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content="@CollinRijock" />
        <meta name="twitter:creator" content="@CollinRijock" />
        <meta name="twitter:title" content="Collin Rijock — Engineer. Founder. Explorer." />
        <meta
          name="twitter:description"
          content="Lead Software Engineer at Exowatt. Founding engineer and full-stack builder based in Miami."
        />
        <meta name="twitter:image" content={`${SITE_URL}/og-image.png`} />

        {/* JSON-LD */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(personJsonLd) }}
        />
      </Head>
      <main>
        <div className="frame">
          <div className="frame__title-wrap">
            <h1 className="frame__title">Collin Rijock</h1>
            <p className="frame__tagline">Engineer · Founder · Explorer</p>
          </div>
          <nav className="frame__links">
            <a href="https://linkedin.com/in/collinrijock" target="_blank" rel="noopener noreferrer">LinkedIn</a>
            <a href="https://github.com/collinrijock" target="_blank" rel="noopener noreferrer">GitHub</a>
            <a href="https://x.com/CollinRijock" target="_blank" rel="noopener noreferrer">Twitter</a>
            <a href="mailto:collinrijock@gmail.com">Contact</a>
          </nav>
          {isBlipVisible && (
            <div className="frame__interactive-blip">
              <button onClick={() => setIsBlipVisible(false)} className="blip-close-button" aria-label="Close tip">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
              <div className="blip-content">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="blip-icon">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="16" x2="12" y2="12"></line>
                  <line x1="12" y1="8" x2="12.01" y2="8"></line>
                </svg>
                <p>Move mouse, click, and scroll to interact</p>
              </div>
            </div>
          )}
        </div>
        <div className="content">
          <div className="scroll__stage">
            <div className="scroll__content">

              <div className="bio-section">
                <div className="bio-text">
                  <p>
                    Explorer at heart, engineer by trade. I&apos;ve spent my career as a founding engineer —
                    scaling Lula from $2M to $30M ARR, building BuildrFi&apos;s AI lending platform from zero
                    to live MVP, and shipping Exowatt&apos;s Lightspeed platform solo from infra to UI. I write
                    about technology, startups, and ideas.
                  </p>
                </div>
              </div>

              <div className="content-grid">
                {contentData.map((item, index) => (
                  <Link href={item.link} key={index} className="card-link-wrapper">
                    <div className={`card ${item.type === 'Job' ? 'card--job' : item.type === 'Project' ? 'card--project' : ''}`}>
                      <span className={`card-type ${item.type === 'Job' ? 'card-type--job' : item.type === 'Project' ? 'card-type--project' : ''}`}>{item.type}</span>
                      <h3>{item.title}</h3>
                      <p>{item.description}</p>
                      {item.tags && (
                        <div className="card-tags-container">
                          {item.tags.map((tag) => (
                            <span key={tag} className="card-tag">{tag}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
          <div className="layout__line"></div>
        </div>
      </main>
    </>
  );
}

export const getStaticProps: GetStaticProps<HomeProps> = async () => {
  const blogPosts = await fetchBlogPosts();
  const dynamicContent = blogPosts.map(blogPostToContentItem);
  const contentData = dynamicContent.length > 0 ? dynamicContent : staticContentData;

  return {
    props: {
      contentData,
    },
    revalidate: 60,
  };
};
