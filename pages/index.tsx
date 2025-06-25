import Head from 'next/head';
import { useEffect } from 'react';
import ScrollStage from '../lib/sos/ScrollStage';
import Link from 'next/link';
import { contentData } from '../lib/content';

export default function Home() {
  useEffect(() => {
    // Prevent creating multiple instances on hot-reload
    if (document.querySelector('.webgl')) return;
    
    document.body.classList.add('loading');
    const stage = new ScrollStage();
    // The ScrollStage class will handle removing the 'loading' class on window.load
  }, []);

  return (
    <>
      <Head>
        <title>Collin Rijock</title>
        <meta name="description" content="The personal website of Collin Rijock, showcasing projects and essays." />
        <meta name="keywords" content="collin rijock, developer, writer, portfolio, webgl, react, javascript, essays, startups, engineer, founder" />
        <meta name="author" content="Collin Rijock" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main>
        <div className="frame">
          <div className="frame__title-wrap">
            <h1 className="frame__title">Collin Rijock</h1>
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