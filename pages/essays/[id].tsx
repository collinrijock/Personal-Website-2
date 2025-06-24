import { GetStaticPaths, GetStaticProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { contentData } from '../../lib/content';

interface ContentItem {
  id: string;
  type: string;
  title: string;
  description: string;
  link: string;
  content: string;
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
                      <div className="card" key={item.id}>
                        <span className="card-type">{item.type}</span>
                        <h3>{item.title}</h3>
                        <p>{item.description}</p>
                        <Link href={item.link} className="card-link">
                          Details
                        </Link>
                      </div>
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