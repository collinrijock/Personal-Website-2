import { GetStaticPaths, GetStaticProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { staticContentData, ContentItem } from '../../lib/content';
import { fetchBlogPosts, fetchBlogPostBySlug, blogPostToContentItem } from '../../lib/api';
import { NodxWaveCanvas } from '../../components/NodxWaveCanvas';

const SITE_URL = 'https://collinrijock.com';

interface EssayPageProps {
  essay: ContentItem | null;
  otherContent: ContentItem[];
}

const EssayPage = ({ essay, otherContent }: EssayPageProps) => {
  if (!essay) {
    return (
      <>
        <Head>
          <title>Essay Not Found | Collin Rijock</title>
          <link rel="icon" href="/favicon.ico" />
        </Head>
        <main>
          <NodxWaveCanvas pageType="Essay" />
          <div className="frame">
            <div className="frame__title-wrap">
              <h1 className="frame__title"><Link href="/">Collin Rijock</Link></h1>
            </div>
            <nav className="frame__links">
              <a href="https://linkedin.com/in/collinrijock" target="_blank" rel="noopener noreferrer">LinkedIn</a>
              <a href="https://github.com/collinrijock" target="_blank" rel="noopener noreferrer">GitHub</a>
              <a href="https://x.com/CollinRijock" target="_blank" rel="noopener noreferrer">Twitter</a>
              <a href="mailto:collinrijock@gmail.com">Contact</a>
            </nav>
          </div>
          <div className="content">
            <div className="scroll__stage">
              <div className="scroll__content">
                <div className="content-details">
                  <section className="content-section">
                    <Link href="/" className="back-link">← Back to home</Link>
                    <h2 className="content-section-title">Essay Not Found</h2>
                    <p>The essay you&apos;re looking for doesn&apos;t exist or has been removed.</p>
                  </section>
                </div>
              </div>
            </div>
          </div>
        </main>
      </>
    );
  }

  const canonicalUrl = `${SITE_URL}/essays/${essay.id}`;

  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: essay.title,
    description: essay.description,
    url: canonicalUrl,
    author: {
      '@type': 'Person',
      name: 'Collin Rijock',
      url: SITE_URL,
    },
    publisher: {
      '@type': 'Person',
      name: 'Collin Rijock',
      url: SITE_URL,
    },
  };

  return (
    <>
      <Head>
        <title>{`${essay.title} | Collin Rijock`}</title>
        <meta name="description" content={essay.description} />
        <link rel="canonical" href={canonicalUrl} />
        <link rel="icon" href="/favicon.ico" />

        {/* Open Graph */}
        <meta property="og:type" content="article" />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:title" content={`${essay.title} | Collin Rijock`} />
        <meta property="og:description" content={essay.description} />
        <meta property="og:image" content={`${SITE_URL}/og-image.png`} />
        <meta property="og:site_name" content="Collin Rijock" />
        <meta property="og:locale" content="en_US" />

        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content="@CollinRijock" />
        <meta name="twitter:creator" content="@CollinRijock" />
        <meta name="twitter:title" content={`${essay.title} | Collin Rijock`} />
        <meta name="twitter:description" content={essay.description} />
        <meta name="twitter:image" content={`${SITE_URL}/og-image.png`} />

        {/* JSON-LD */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
        />
      </Head>
      <main>
        <NodxWaveCanvas pageType="Essay" />
        <div className="frame">
          <div className="frame__title-wrap">
            <h1 className="frame__title"><Link href="/">Collin Rijock</Link></h1>
          </div>
          <nav className="frame__links">
            <a href="https://linkedin.com/in/collinrijock" target="_blank" rel="noopener noreferrer">LinkedIn</a>
            <a href="https://github.com/collinrijock" target="_blank" rel="noopener noreferrer">GitHub</a>
            <a href="https://x.com/CollinRijock" target="_blank" rel="noopener noreferrer">Twitter</a>
            <a href="mailto:collinrijock@gmail.com">Contact</a>
          </nav>
        </div>
        <div className="content">
          <div className="scroll__stage">
            <div className="scroll__content">
              <div className="content-details">
                <section className="content-section">
                  <Link href="/" className="back-link">← Back to home</Link>
                  <p className="card-type">{essay.type}</p>
                  <h2 className="content-section-title">{essay.title}</h2>
                  <p>{essay.content}</p>
                </section>
                <section className="read-more-section">
                  <h2>Read More</h2>
                  <div className="content-grid">
                    {otherContent.map((item) => (
                      <Link href={item.link} key={item.id} className="card-link-wrapper">
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
                </section>
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
};

export const getStaticPaths: GetStaticPaths = async () => {
  const staticEssays = staticContentData.filter(item => item.type === 'Essay');
  const staticPaths = staticEssays.map(essay => ({
    params: { id: essay.id },
  }));

  const blogPosts = await fetchBlogPosts();
  const dynamicPaths = blogPosts
    .filter(post => post.type === 'ESSAY')
    .map(post => ({
      params: { id: post.slug },
    }));

  return {
    paths: [...staticPaths, ...dynamicPaths],
    fallback: 'blocking',
  };
};

export const getStaticProps: GetStaticProps<EssayPageProps> = async (context) => {
  const { params } = context || {};
  const id = params?.id as string;

  let essay = staticContentData.find(item => item.id === id && item.type === 'Essay');

  if (!essay) {
    const blogPost = await fetchBlogPostBySlug(id);
    if (blogPost && blogPost.type === 'ESSAY') {
      essay = blogPostToContentItem(blogPost);
    }
  }

  const blogPosts = await fetchBlogPosts();
  const dynamicContent = blogPosts.map(blogPostToContentItem);
  const allContent = [...dynamicContent, ...staticContentData];

  const otherContent = allContent
    .filter(item => item.id !== id)
    .sort(() => 0.5 - Math.random())
    .slice(0, 3);

  if (!essay) {
    return {
      props: {
        essay: null,
        otherContent,
      },
      revalidate: 60,
    };
  }

  return {
    props: {
      essay,
      otherContent,
    },
    revalidate: 60,
  };
};

export default EssayPage;
