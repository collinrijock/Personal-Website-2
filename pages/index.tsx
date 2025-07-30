import Head from 'next/head';
import { useEffect, useState } from 'react';
import ScrollStage from '../lib/sos/ScrollStage';
import Link from 'next/link';
import { contentData } from '../lib/content';

export default function Home() {
  const [isBlipVisible, setIsBlipVisible] = useState(true);

  useEffect(() => {
    document.body.classList.add('home-background');

    // Prevent creating multiple instances on hot-reload
    if (!document.querySelector('.webgl')) {
      document.body.classList.add('loading');
      const stage = new ScrollStage();
      // The ScrollStage class will handle removing the 'loading' class on window.load
    }
    
    return () => {
      document.body.classList.remove('home-background');
    };
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
            <p className="frame__tagline">Founding Full-Stack Engineer</p>
          </div>
          <nav className="frame__links">
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