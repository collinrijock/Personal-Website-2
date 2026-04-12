import Head from 'next/head';
import { useEffect, useState } from 'react';
import ScrollStage from '../lib/sos/ScrollStage';
import Link from 'next/link';
import { GetStaticProps } from 'next';
import { staticContentData, ContentItem } from '../lib/content';
import { fetchBlogPosts, blogPostToContentItem } from '../lib/api';
import { profile } from '../lib/profile';

const personJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Person',
  name: profile.name,
  url: profile.siteUrl,
  jobTitle: profile.title,
  worksFor: {
    '@type': 'Organization',
    name: profile.company,
    url: profile.companyUrl,
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
  sameAs: [profile.links.github, profile.links.twitter, profile.links.linkedin],
  description: profile.metaDescription,
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
        <title>{profile.name}</title>
        <meta name="description" content={profile.metaDescription} />
        <meta
          name="keywords"
          content="collin rijock, software engineer, founding engineer, full-stack, react, typescript, node.js, miami, exowatt, fintech, startups, essays"
        />
        <meta name="author" content={profile.name} />
        <link rel="canonical" href={profile.siteUrl} />
        <link rel="icon" href="/favicon.ico" />

        <meta property="og:type" content="website" />
        <meta property="og:url" content={profile.siteUrl} />
        <meta property="og:title" content={profile.name} />
        <meta property="og:description" content={profile.metaDescription} />
        <meta property="og:image" content={`${profile.siteUrl}/og-image.png`} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:site_name" content={profile.name} />
        <meta property="og:locale" content="en_US" />

        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content="@CollinRijock" />
        <meta name="twitter:creator" content="@CollinRijock" />
        <meta name="twitter:title" content={profile.name} />
        <meta name="twitter:description" content={profile.metaDescription} />
        <meta name="twitter:image" content={`${profile.siteUrl}/og-image.png`} />

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(personJsonLd) }}
        />
      </Head>
      <main>
        <div className="frame">
          <div className="frame__title-wrap">
            <h1 className="frame__title">{profile.name}</h1>
            <p className="frame__tagline">{profile.tagline}</p>
          </div>
          <nav className="frame__links">
            <a href={profile.links.linkedin} target="_blank" rel="noopener noreferrer">LinkedIn</a>
            <a href={profile.links.github} target="_blank" rel="noopener noreferrer">GitHub</a>
            <a href={profile.links.twitter} target="_blank" rel="noopener noreferrer">Twitter</a>
            <a href={`mailto:${profile.email}`}>Contact</a>
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
                  <p>{profile.bio}</p>
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
