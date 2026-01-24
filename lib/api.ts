// API helper for fetching blog posts from Super Charles backend

const SUPER_CHARLES_API = process.env.NEXT_PUBLIC_SUPER_CHARLES_API || 'https://super-charles.vercel.app';

export interface BlogPost {
  id: number;
  slug: string;
  title: string;
  description: string | null;
  content?: string; // Only included when fetching single post
  type: 'ESSAY' | 'PROJECT' | 'JOB';
  tags: string[];
  publishedAt: string | null;
  createdAt: string;
}

// Fetch all published blog posts
export async function fetchBlogPosts(): Promise<BlogPost[]> {
  try {
    const res = await fetch(`${SUPER_CHARLES_API}/api/blog/public`, {
      next: { revalidate: 60 }, // Revalidate every 60 seconds
    });

    if (!res.ok) {
      console.error('Failed to fetch blog posts:', res.status);
      return [];
    }

    return await res.json();
  } catch (error) {
    console.error('Error fetching blog posts:', error);
    return [];
  }
}

// Fetch a single blog post by slug
export async function fetchBlogPostBySlug(slug: string): Promise<BlogPost | null> {
  try {
    const res = await fetch(`${SUPER_CHARLES_API}/api/blog/public?slug=${encodeURIComponent(slug)}`, {
      next: { revalidate: 60 },
    });

    if (!res.ok) {
      if (res.status === 404) return null;
      console.error('Failed to fetch blog post:', res.status);
      return null;
    }

    return await res.json();
  } catch (error) {
    console.error('Error fetching blog post:', error);
    return null;
  }
}

// Convert BlogPost to ContentItem format (for compatibility with existing components)
export function blogPostToContentItem(post: BlogPost) {
  const typeMapping: Record<string, string> = {
    ESSAY: 'Essay',
    PROJECT: 'Project',
    JOB: 'Job',
  };

  return {
    id: post.slug,
    type: typeMapping[post.type] || 'Essay',
    title: post.title,
    description: post.description || '',
    link: `/essays/${post.slug}`,
    content: post.content || '',
    tags: post.tags,
  };
}
