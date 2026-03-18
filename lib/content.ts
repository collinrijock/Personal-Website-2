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
      '2016 was an odd year — many look back with rose-tinted glasses as the last time America collectively had a good year. In the scope of politics, it\'s arguably the most consequential in decades. Trump invoked a new form of right wing American populism, Bernie did the same for the left. Many Americans were disgruntled with the status quo, stagnant wages, and forgotten rust belt towns.\n\nWhat concerns this essay about 2016 is actually the primary for the Democrats. Bernie vs Hillary has cut very deep since then. Think of the two of them representing the Leftist and Centrist arms of the party, a rift which has ruled Democrat discourse for the last ten years. Think about the soft criticism and noticeable silence the DNC has for AOC and Mamdani. The outcry of the youth when a new centrist Democrat receives AIPAC money.\n\nThat\'s exactly the change that\'s in motion. "Besides Trump." It\'s obvious that Trump rules not only the news cycle, but the collective consciousness. And the first year of his presidency has felt more like ten. This is the shift in the party, and it\'s why Gavin Newsom is likely to be the next Dem candidate, and probably President. Most Democrats are uniting around candidates willing to fight for their ideology and not compromise with Trump. Whoever can change the zeitgeist from "how left are you?" to "how much did you fight to stop Trump?" will be our next President.',
    tags: ['Politics'],
  },
  {
    id: 'personal-philosophy',
    type: 'Essay',
    title: 'Breadth and AI First',
    description: 'My engineering philosophy: why the best builders are generalists who go deep when it counts, and how AI changes the calculus entirely.',
    link: '/essays/personal-philosophy',
    content:
      'This essay explores my personal philosophy around software engineering — a combination of values, beliefs, and principles that guide how I build and think. The core thesis: breadth first, AI native. In an era of AI-powered tools, the generalist engineer who can reason across systems, ship across the stack, and wield AI as a force multiplier has an enormous edge over the specialist who waits for tickets.',
  },
  {
    id: 'exowatt',
    type: 'Job',
    title: 'Exowatt',
    description: 'Lead Engineer building the energy management system and internal tools for Exowatt\'s modular solar thermal power platform.',
    link: '/projects/exowatt',
    content:
      'Exowatt is building modular solar thermal power infrastructure to make clean energy abundant and affordable. As Lead Software Engineer, I own full-stack feature development end-to-end — no PM, no tickets, just shipping.\n\nI built and launched the entire Lightspeed platform solo: backend infrastructure, UI/UX, customer onboarding, AI chat assistant, and Slack integration. I also built the Ramp financial integration from scratch, sourcing my own requirements and drafting my own tickets. I redesigned the systems commissioning UX for Lighthouse module motor controls — the same UI that was used live in production when Meta visited our facility. I built the CEO dashboard for runway tracking, manufacturing data, and weekly cash reporting.',
    tags: ['React', 'TypeScript', 'Node.js', 'AWS', 'PostgreSQL', 'InfluxDB'],
  },
  {
    id: 'buildrfi',
    type: 'Job',
    title: 'BuildrFi',
    description: 'First engineer at an AI-powered fintech startup for construction contractors. Built the full lending platform from zero to live MVP.',
    link: '/projects/buildrfi',
    content:
      'BuildrFi was an AI-powered cash flow management and lending platform for construction contractors. As the first engineer, I owned the entire product from concept to live MVP.\n\nI integrated Plaid, Stripe, and QuickBooks APIs to gather underwriting data, and built an LLM-powered document parser using Claude to analyze contracts, invoices, and bills for automated loan decisions. I implemented cutting-edge AI tools to automate parts of customer workflows and launched the MVP to give out loans to customers. We applied to Y Combinator (W25).',
    tags: ['React', 'TypeScript', 'Node.js', 'MongoDB', 'AWS', 'AI', 'Fintech'],
  },
  {
    id: 'disgo',
    type: 'Project',
    title: 'Disgo',
    description: 'Crypto-powered restaurant loyalty app with NFC check-ins and on-chain rewards. 100+ MAU on App Store and Google Play.',
    link: '/projects/disgo',
    content:
      'Disgo is a crypto-powered restaurant loyalty platform where diners tap NFC tags in-store to check in, climb membership tiers, and earn on-chain rewards. Built as the sole engineer using Expo React Native, Convex, and Web3 integrations.\n\nDiners tap NFC tags placed at restaurant tables to check in, which triggers tier progression and on-chain reward distribution. Launched to both the App Store and Google Play with over 100 monthly active users.',
    tags: ['React Native', 'Expo', 'Web3', 'NFC', 'Convex'],
  },
  {
    id: 'pantheon-of-founders',
    type: 'Essay',
    title: 'Pantheon',
    description: 'A look at the archetypes of successful founders and the timeless lessons from their journeys.',
    link: '/essays/pantheon-of-founders',
    content:
      'From the visionary to the executor, the disruptor to the builder, successful founders often fit into certain archetypes. This essay examines the different types of founders who have built enduring companies. By studying their stories, strategies, and mindsets, we can extract timeless lessons on leadership, resilience, and the art of turning an idea into a reality.',
    tags: ['Startup', 'Leadership', 'Founders'],
  },
  {
    id: 'china',
    type: 'Essay',
    title: 'China',
    description: 'Understanding the unique ecosystem of technology and innovation in China.',
    link: '/essays/china',
    content:
      "China's tech landscape is often misunderstood in the West. This essay provides an inside look at the country's unique innovation ecosystem, from the \"super-app\" phenomenon to the rapid pace of hardware development in Shenzhen. I explore the cultural and economic factors that drive China's tech industry and what the rest of the world can learn from its model of relentless iteration and competition.",
    tags: ['China', 'Tech', 'Innovation'],
  },
];

// Legacy export for backwards compatibility
export const contentData = staticContentData;
