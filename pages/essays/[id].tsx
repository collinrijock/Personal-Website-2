import { GetStaticPaths, GetStaticProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { staticContentData, ContentItem } from '../../lib/content';
import { fetchBlogPosts, fetchBlogPostBySlug, blogPostToContentItem } from '../../lib/api';
import { NodxWaveCanvas } from '../../components/NodxWaveCanvas';

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

  return (
    <>
      <Head>
        <title>{`${essay.title} | Collin Rijock`}</title>
        <meta name="description" content={essay.description} />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main>
        <NodxWaveCanvas pageType="Essay" />
        <div className="frame">
          <div className="frame__title-wrap">
            <h1 className="frame__title"><Link href="/">Collin Rijock</Link></h1>
          </div>
          <nav className="frame__links">
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
  // Get all static essay IDs
  const staticEssays = staticContentData.filter(item => item.type === 'Essay');
  const staticPaths = staticEssays.map(essay => ({
    params: { id: essay.id },
  }));

  // Get all dynamic blog post slugs
  const blogPosts = await fetchBlogPosts();
  const dynamicPaths = blogPosts
    .filter(post => post.type === 'ESSAY')
    .map(post => ({
      params: { id: post.slug },
    }));

  return {
    paths: [...staticPaths, ...dynamicPaths],
    // Enable fallback for new posts
    fallback: 'blocking',
  };
};

export const getStaticProps: GetStaticProps<EssayPageProps> = async (context) => {
  const { params } = context || {};
  const id = params?.id as string;

  // First, try to find in static content
  let essay = staticContentData.find(item => item.id === id && item.type === 'Essay');

  // If not found in static, fetch from API
  if (!essay) {
    const blogPost = await fetchBlogPostBySlug(id);
    if (blogPost && blogPost.type === 'ESSAY') {
      essay = blogPostToContentItem(blogPost);
    }
  }

  // Get other content for "Read More" section
  const blogPosts = await fetchBlogPosts();
  const dynamicContent = blogPosts.map(blogPostToContentItem);
  const allContent = [...dynamicContent, ...staticContentData];

  const otherContent = allContent
    .filter(item => item.id !== id)
    .sort(() => 0.5 - Math.random())
    .slice(0, 3);

  // Return 404 if essay not found
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
    // Revalidate every 60 seconds
    revalidate: 60,
  };
};

export default EssayPage;
