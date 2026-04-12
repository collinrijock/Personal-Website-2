// Static content data (fallback when API is unavailable)
// This will be merged with dynamic blog posts from Super Charles

export interface ContentItem {
  id: string;
  type: string;
  title: string;
  description: string;
  link: string;
  content: string;
  tags?: string[];
}

// Static content - this serves as fallback when API is unavailable
// Once seeded to the database, these will come from Super Charles API
export const staticContentData: ContentItem[] = [
  {
    id: "personal-philosophy",
    type: "Essay",
    title: "Breadth and AI first - Philosophy around being a SWE",
    description: "A look at my personal philosophy and how it shapes my life.",
    link: "/essays/personal-philosophy",
    content:
      "This essay explores my personal philosophy, which is a combination of values, beliefs, and principles that guide my decision-making and actions. It's a reflection of my unique perspective on life and the world around me. I discuss how my philosophy has influenced my choices, relationships, and experiences, and how it continues to shape my outlook on life.",
  },
  {
    id: "buildrfi",
    type: "Job",
    title: "BuildrFi",
    description:
      "A decentralized platform for construction project financing and management on the blockchain.",
    link: "/projects/buildrfi",
    content:
      "BuildrFi aims to revolutionize the construction industry by leveraging blockchain technology for transparent and efficient project financing. It connects developers with investors through smart contracts, automating payments based on project milestones. The platform also provides tools for project management, ensuring accountability and reducing disputes.",
    tags: ["Blockchain", "DeFi", "React", "Solidity"],
  },
  {
    id: "disgo",
    type: "Project",
    title: "Disgo",
    description:
      "A social discovery app that helps you find new places and events based on your friends' recommendations.",
    link: "/projects/disgo",
    content:
      'Disgo is a mobile application designed to make social planning easier. It aggregates recommendations from your social circle to suggest restaurants, bars, and events you\'re likely to enjoy. The app features a real-time map, event creation, and a unique "vibe" filter to match your mood.',
    tags: ["Mobile App", "React Native", "Firebase"],
  },
  {
    id: "pantheon-of-founders",
    type: "Essay",
    title: "Pantheon",
    description:
      "A look at the archetypes of successful founders and the timeless lessons from their journeys.",
    link: "/essays/pantheon-of-founders",
    content:
      "From the visionary to the executor, the disruptor to the builder, successful founders often fit into certain archetypes. This essay examines the different types of founders who have built enduring companies. By studying their stories, strategies, and mindsets, we can extract timeless lessons on leadership, resilience, and the art of turning an idea into a reality.",
    tags: ["Startup", "Leadership", "Founders"],
  },
  {
    id: "china",
    type: "Essay",
    title: "China",
    description: "Understanding the unique ecosystem of technology and innovation in China.",
    link: "/essays/china",
    content:
      "China's tech landscape is often misunderstood in the West. This essay provides an inside look at the country's unique innovation ecosystem, from the \"super-app\" phenomenon to the rapid pace of hardware development in Shenzhen. I explore the cultural and economic factors that drive China's tech industry and what the rest of the world can learn from its model of relentless iteration and competition.",
    tags: ["China", "Tech", "Innovation"],
  },
];

// Legacy export for backwards compatibility
export const contentData = staticContentData;
