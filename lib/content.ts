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

export const staticContentData: ContentItem[] = [
  {
    id: 'democrats-in-the-seventh-party-system',
    type: 'Essay',
    title: 'Democrats in the Seventh Party System',
    description: '2016 ruined the Democratic Party and it wasn\'t Trump.',
    link: '/essays/democrats-in-the-seventh-party-system',
    content:
      '2016 was an odd year. Many look back with rose-tinted glasses as the last time America collectively had a good year. In the scope of politics, its arguably the most consequential in decades. Trump invoked a new form of right wing American populism, Bernie did the same for the left. Many Americans were disgruntled with the status quo, stagnant wages, and forgotten rust belt towns.\n\nWhat concerns this essay about 2016 is actually the primary for the Democrats. Bernie vs Hillary has cut very deep since then. Think of the two of them representing the Leftist and Centrist arms of the party, a rift which has ruled Democrat discourse for the last ten years. Think about the soft criticism and noticeable silence the DNC has for AOC and Mamdani. The outcry of the youth when a new centrist Democrat receives AIPAC money. Besides Trump its been most of whats spoken of, save for abortion when Roe v Wade was overturned.\n\nThats exactly the change thats in motion. "Besides Trump." Its obvious that Trump rules not only the news cycle, but the collective consciousness. I mean how could he not when hes all over social media. And the first year of Trump\'s presidency has felt more like 10. This is the shift in the party, and its why Gavin Newsom is likely to be the next Dem candidate, and probably President. Most Democrats are uniting and also voting for candidates willing to fight for their ideology, and not compromise with Trump. They think hes getting away with too much and needs pushback. Newsom is not only doing this with say Prop 50, his rhetoric on social media, and his appearance in Davos. Hes capturing the left and the center in a way we havent seen in a while. Whoever can change the zeitgeist from how left / center are you, to how much did you fight to stop Trump, will be our next President.',
    tags: ['Politics'],
  },
  {
    id: 'personal-philosophy',
    type: 'Essay',
    title: 'Breadth and AI First',
    description: 'Why generalists who go deep when it counts have an edge, and how AI changes everything.',
    link: '/essays/personal-philosophy',
    content:
      'This essay explores my philosophy around software engineering. The core idea: breadth first, AI native. The generalist engineer who can reason across systems, ship across the stack, and use AI as a force multiplier has an enormous advantage over the specialist who waits for tickets.',
  },
  {
    id: 'exowatt',
    type: 'Job',
    title: 'Exowatt',
    description: 'Lead engineer at an energy tech company building modular solar thermal power infrastructure.',
    link: '/projects/exowatt',
    content:
      'Exowatt is building modular solar thermal power infrastructure. I lead full-stack engineering on the web platform, owning features end to end.',
    tags: ['React', 'TypeScript', 'Node.js', 'AWS', 'PostgreSQL'],
  },
  {
    id: 'buildrfi',
    type: 'Job',
    title: 'BuildrFi',
    description: 'First engineer at a fintech startup building AI-powered lending tools for construction contractors.',
    link: '/projects/buildrfi',
    content:
      'BuildrFi was an AI-powered cash flow management and lending platform for construction contractors. I was the first engineer and owned the entire product from concept to live MVP. I integrated Plaid, Stripe, and QuickBooks to gather underwriting data, and built an LLM-powered document parser to analyze contracts and invoices for automated loan decisions.',
    tags: ['React', 'TypeScript', 'Node.js', 'MongoDB', 'AWS', 'AI', 'Fintech'],
  },
  {
    id: 'disgo',
    type: 'Project',
    title: 'Disgo',
    description: 'Crypto-powered restaurant loyalty app with NFC check-ins and on-chain rewards.',
    link: '/projects/disgo',
    content:
      'Disgo is a crypto-powered restaurant loyalty platform. Diners tap NFC tags in-store to check in, climb membership tiers, and earn on-chain rewards. I built it as the sole engineer using Expo React Native, Convex, and Web3 integrations. Launched on the App Store and Google Play.',
    tags: ['React Native', 'Expo', 'Web3', 'NFC', 'Convex'],
  },
  {
    id: 'pantheon-of-founders',
    type: 'Essay',
    title: 'Pantheon',
    description: 'Archetypes of successful founders and the lessons from their journeys.',
    link: '/essays/pantheon-of-founders',
    content:
      'From the visionary to the executor, the disruptor to the builder, successful founders often fit into certain archetypes. This essay looks at the different types of founders who have built enduring companies, and what we can learn from their stories, strategies, and mindsets.',
    tags: ['Startup', 'Leadership', 'Founders'],
  },
  {
    id: 'china',
    type: 'Essay',
    title: 'China',
    description: 'The unique ecosystem of technology and innovation in China.',
    link: '/essays/china',
    content:
      "China's tech landscape is often misunderstood in the West. This essay looks at the country's innovation ecosystem, from the super-app phenomenon to the pace of hardware development in Shenzhen. I explore the cultural and economic factors that drive China's tech industry and what the rest of the world can learn from it.",
    tags: ['China', 'Tech', 'Innovation'],
  },
];

// Legacy export for backwards compatibility
export const contentData = staticContentData;
