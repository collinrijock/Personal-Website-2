import { GetStaticPaths, GetStaticProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { contentData } from '../../lib/content';
import { NodxWaveCanvas } from '../../components/NodxWaveCanvas';

interface ContentItem {
  id: string;
  type: string;
  title: string;
  description: string;
  link: string;
  content: string;
  tags?: string[];
}

interface EssayPageProps {
  essay: ContentItem;
  otherContent: ContentItem[];
}

const EssayPage = ({ essay, otherContent }: EssayPageProps) => {
  if (!essay) {
    return <div>Essay not found.</div>;
  }

  return (
    <>
      <Head>
        <title>{`${essay.title} | Collin Rijock`}</title>
        <meta name="description" content={essay.description} />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main>
        <NodxWaveCanvas />
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
  const essays = contentData.filter(item => item.type === 'Essay');
  const paths = essays.map(essay => ({
    params: { id: essay.id },
  }));

  return { paths, fallback: false };
};

export const getStaticProps: GetStaticProps = async (context) => {
  const { params } = context;
  const essay = contentData.find(item => item.id === params.id);
  const otherContent = contentData
    .filter(item => item.id !== params.id)
    .sort(() => 0.5 - Math.random())
    .slice(0, 3);

  return {
    props: {
      essay,
      otherContent,
    },
  };
};

export default EssayPage;