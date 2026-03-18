import { GetServerSideProps } from 'next';
import { staticContentData } from '../lib/content';
import { fetchBlogPosts } from '../lib/api';

const SITE_URL = 'https://collinrijock.com';

interface SitemapUrl {
  url: string;
  lastmod?: string;
  changefreq?: string;
  priority?: string;
}

function generateSiteMap(urls: SitemapUrl[]) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    ({ url, lastmod, changefreq, priority }) => `  <url>
    <loc>${url}</loc>
    ${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}
    ${changefreq ? `<changefreq>${changefreq}</changefreq>` : ''}
    ${priority ? `<priority>${priority}</priority>` : ''}
  </url>`
  )
  .join('\n')}
</urlset>`;
}

export const getServerSideProps: GetServerSideProps = async ({ res }) => {
  const today = new Date().toISOString().split('T')[0];
  const blogPosts = await fetchBlogPosts();

  const staticIds = new Set(staticContentData.map((item) => item.id));

  const urls: SitemapUrl[] = [
    { url: SITE_URL, changefreq: 'weekly', priority: '1.0', lastmod: today },
    ...staticContentData.map((item) => ({
      url: `${SITE_URL}${item.link}`,
      changefreq: 'monthly',
      priority: item.type === 'Essay' ? '0.8' : '0.7',
      lastmod: today,
    })),
    ...blogPosts
      .filter((post) => !staticIds.has(post.slug))
      .map((post) => ({
        url: `${SITE_URL}/essays/${post.slug}`,
        changefreq: 'monthly',
        priority: '0.8',
        lastmod: post.publishedAt
          ? new Date(post.publishedAt).toISOString().split('T')[0]
          : today,
      })),
  ];

  const sitemap = generateSiteMap(urls);

  res.setHeader('Content-Type', 'text/xml');
  res.write(sitemap);
  res.end();

  return { props: {} };
};

function SiteMap() {
  return null;
}

export default SiteMap;
