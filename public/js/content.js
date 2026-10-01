// content.js — everything the site says, as a graph, for the brainstorm map.
// every fact comes from PROFILE.md (public-safe). no numbers, no ⚠ claims.
//
// node types borrow the canvas vocabulary:
//   title   the name, big
//   sticky  a pastel note: { color, text, internal? }  colors: yellow pink blue green purple gray white
//           internal: true marks exowatt work that stays inside (no link, a small lock line)
//   quote   one big line of type: { text }
//   link    a media / url card: { title, url, note }
//   image   an image card with a title bar: { src, title, url? }
//   logo    a tool or network mark: { icon (simple-icons slug) | glyph, label, url? }
// clusters are canvas frames: a titled region the nodes gather in.
// edges are canvas arrows, optionally labelled.

export const CLUSTERS = [
  { id: 'me', title: 'collin rijock', color: 'white' },
  { id: 'vision', title: 'how i build', color: 'yellow' },
  { id: 'exowatt', title: 'exowatt · now', color: 'blue' },
  { id: 'xmade', title: "things i've made · at exowatt", color: 'blue' },
  { id: 'charles', title: 'super charles · on the side', color: 'purple' },
  { id: 'work', title: 'how i work', color: 'green' },
  { id: 'things', title: "things i've made · on my own time", color: 'pink' },
  { id: 'games', title: 'games i make', color: 'purple' },
  { id: 'ideas', title: 'ideas i keep coming back to', color: 'green' },
  { id: 'writing', title: 'writing', color: 'gray' },
  { id: 'before', title: 'before', color: 'gray' },
  { id: 'stack', title: 'tools', color: 'white' },
  { id: 'links', title: 'find me', color: 'white' },
];

const gh = (repo) => `https://github.com/collinrijock/${repo}`;
const og = (repo) => `https://opengraph.githubassets.com/1/collinrijock/${repo}`;
const icon = (slug) => `https://cdn.jsdelivr.net/npm/simple-icons@15/icons/${slug}.svg`;

export const NODES = [
  // ── me ──
  { id: 'name', cluster: 'me', type: 'title', text: 'collin rijock' },
  { id: 'lede', cluster: 'me', type: 'quote', text: 'i like to build a lot of different things.' },
  { id: 'miami', cluster: 'me', type: 'sticky', color: 'yellow', text: 'software engineer in **miami**. grew up on key biscayne.' },
  { id: 'fiu', cluster: 'me', type: 'sticky', color: 'white', text: 'b.s. computer science, **fiu**.' },

  // ── vision ──
  { id: 'v-future', cluster: 'vision', type: 'quote', text: "i love building software, and i'm getting into building hardware." },
  { id: 'v-cheap', cluster: 'vision', type: 'sticky', color: 'yellow', text: 'i build a lot of software, **with a lot of agents.**' },
  { id: 'v-touch', cluster: 'vision', type: 'sticky', color: 'yellow', text: 'the useful version is not chat-first. **bounded work, visible state**, projects that ship.' },
  { id: 'v-already', cluster: 'vision', type: 'sticky', color: 'blue', text: 'lately some of it runs **real hardware**: batteries, energy sites.' },
  { id: 'v-going', cluster: 'vision', type: 'sticky', color: 'pink', text: 'breadth first, ai native.' },
  { id: 'v-mountain', cluster: 'vision', type: 'quote', text: 'climb the mountain. do hard things.' },

  // ── exowatt ──
  { id: 'x-logo', cluster: 'exowatt', type: 'link', title: 'exowatt', url: 'https://exowatt.com', note: '24-hour solar for ai data centers' },
  { id: 'x-p3', cluster: 'exowatt', type: 'sticky', color: 'blue', text: 'the **p3**: capture sunlight, store it as heat, make electricity on demand.' },
  { id: 'x-role', cluster: 'exowatt', type: 'sticky', color: 'white', text: 'lead software engineer. the second software hire.' },
  { id: 'x-interns', cluster: 'exowatt', type: 'sticky', color: 'white', text: 'hires and mentors the ai research interns.' },

  // ── made at exowatt: most of it stays inside, so no links ──
  { id: 'x-platform', cluster: 'xmade', type: 'sticky', color: 'blue', internal: true, text: '**the internal company platform.** the software the whole company runs on.' },
  { id: 'x-ems', cluster: 'xmade', type: 'sticky', color: 'blue', internal: true, text: '**an energy management system.** taken from simulation to commanding real hardware.' },
  { id: 'x-patents', cluster: 'xmade', type: 'sticky', color: 'yellow', internal: true, text: '**ai research, with patents.** agents that operate energy sites.' },
  { id: 'x-twins', cluster: 'xmade', type: 'sticky', color: 'blue', internal: true, text: '**a digital twin in a game engine.** real-time 3d twins of energy sites and hardware.' },
  { id: 'x-ade', cluster: 'xmade', type: 'sticky', color: 'purple', internal: true, text: '**my own coding harness and ade.** forked an open-source agent app into an agentic development environment, shipped to every engineer.' },
  { id: 'x-browser', cluster: 'xmade', type: 'sticky', color: 'white', internal: true, text: '**a webkit browser**, forked for agents to drive.' },
  { id: 'x-sim', cluster: 'xmade', type: 'sticky', color: 'green', internal: true, text: 'a simulator that evolves and scores an ai agent that operates a power plant.' },
  { id: 'x-teammates', cluster: 'xmade', type: 'sticky', color: 'purple', internal: true, text: 'ai teammates that take tickets, ask for approval, and act.' },

  // ── super charles ──
  { id: 'c-link', cluster: 'charles', type: 'link', title: 'super charles', url: 'https://app.collinrijock.com', note: 'my life os, with agents that do the work' },
  { id: 'c-db', cluster: 'charles', type: 'quote', text: 'my life on one postgres db.' },
  { id: 'c-what', cluster: 'charles', type: 'sticky', color: 'purple', text: 'tasks, calendar, health and money, **with agents that do the work**.' },
  { id: 'c-chief', cluster: 'charles', type: 'sticky', color: 'purple', text: 'an ai chief of staff and a lot of resident agents.' },
  { id: 'c-mcp', cluster: 'charles', type: 'sticky', color: 'white', text: 'web, mobile and desktop apps, plus an mcp server.' },
  { id: 'c-mini', cluster: 'charles', type: 'sticky', color: 'gray', text: 'self-hosted on a **mac mini** at home.' },
  { id: 'c-know', cluster: 'charles', type: 'sticky', color: 'yellow', text: '"know thyself."' },

  // ── how i work ──
  { id: 'w-sidecar', cluster: 'work', type: 'quote', text: 'i love building software.' },
  { id: 'w-bounded', cluster: 'work', type: 'sticky', color: 'green', text: 'not chat-first. **bounded work, visible state**, projects that ship.' },
  { id: 'w-breadth', cluster: 'work', type: 'sticky', color: 'green', text: 'breadth first, ai native.' },
  { id: 'w-proof', cluster: 'work', type: 'sticky', color: 'yellow', text: 'proof over pitch.' },
  { id: 'w-compound', cluster: 'work', type: 'sticky', color: 'green', text: 'compounding beats intensity.' },
  { id: 'w-concentrate', cluster: 'work', type: 'sticky', color: 'green', text: "concentrate, don't balance." },
  { id: 'w-loops', cluster: 'work', type: 'sticky', color: 'green', text: 'feedback loops over goals.' },
  { id: 'w-own', cluster: 'work', type: 'sticky', color: 'white', text: 'own projects end to end.' },

  // ── things ──
  { id: 't-skills', cluster: 'things', type: 'image', src: og('skill-files'), title: 'skill-files', url: gh('skill-files'), note: 'agent skills, one npx command' },
  { id: 't-voice', cluster: 'things', type: 'image', src: og('voice-os'), title: 'voice-os', url: gh('voice-os'), note: 'a push-to-talk voice os' },
  { id: 't-deck', cluster: 'things', type: 'sticky', color: 'pink', text: '**stream deck daemon.** raw hid, no vendor app. agents that need me take over a key.' },
  { id: 't-jev', cluster: 'things', type: 'sticky', color: 'pink', text: '**jev computer use.** a typed model grounds and verifies each step; code owns the loop.' },
  { id: 't-orca', cluster: 'things', type: 'image', src: og('orca'), title: 'orca, agent-first', url: gh('orca'), note: 'a fork with a refined workspace and terminal' },
  { id: 't-mmm', cluster: 'things', type: 'image', src: og('mmm'), title: 'mmm', url: gh('mmm'), note: 'meme battles ranked with elo' },
  { id: 't-vibe', cluster: 'things', type: 'image', src: og('vibe-founder'), title: 'vibe-founder', url: gh('vibe-founder'), note: 'type an idea, agents write the plan' },
  { id: 't-pokemon', cluster: 'things', type: 'image', src: og('Pokemon-Showdown-Bot'), title: 'pokemon showdown bot', url: gh('Pokemon-Showdown-Bot'), note: 'a deep reinforcement learning bot' },
  { id: 't-shellhacks', cluster: 'things', type: 'quote', text: 'shellhacks, every year since 2020.' },
  { id: 't-carecart', cluster: 'things', type: 'link', title: 'carecart', url: 'https://devpost.com/software/carecart-r6gckp', note: 'matched volunteers with people who needed groceries' },
  { id: 't-galactic', cluster: 'things', type: 'link', title: 'galactic', url: 'https://devpost.com/software/galactic-bzqnfr', note: 'scaffold full-stack apps, shellhacks 2024' },
  { id: 't-itx', cluster: 'things', type: 'link', title: 'itx', url: 'https://devpost.com/software/itx', note: 'mac mdm with a rust daemon, shellhacks 2023' },
  { id: 't-wrapped', cluster: 'things', type: 'link', title: 'whatsapp wrapped', url: 'https://devpost.com/software/whatsapp-wrapped', note: 'spotify wrapped for a group chat, 2022' },
  { id: 't-ascii', cluster: 'things', type: 'image', src: 'img/ascii-mountain.jpg', title: 'this site, drawn in glyphs', note: 'an earlier version' },
  { id: 't-gradient', cluster: 'things', type: 'image', src: 'img/gradient-contours.jpg', title: 'this site, in colour', note: 'three.js, oklab fields, contours' },

  // ── games ──
  { id: 'g-lotfg', cluster: 'games', type: 'image', src: og('LegendsOfTheFriendgroup'), title: 'legends of the friendgroup', url: gh('LegendsOfTheFriendgroup'), note: 'a tavern auto-battler, built with agents driving unity' },
  { id: 'g-lotfg2', cluster: 'games', type: 'sticky', color: 'purple', text: '**v0** was a multiplayer discord activity. now it\'s a pixel-art **tavern auto-battler** with meme cards.' },
  { id: 'g-kotf', cluster: 'games', type: 'sticky', color: 'pink', text: '**kingdom of the fighters.** a satirical co-op arpg, from a joke design doc.' },
  { id: 'g-iron', cluster: 'games', type: 'sticky', color: 'blue', text: '**ironwake.** crew an airship with friends. "movement is the skill. scale is the aesthetic. the ship is home."' },
  { id: 'g-crafty', cluster: 'games', type: 'sticky', color: 'green', text: '**crafty buildy game.** creature-collector survival in a procedural pixel world.' },
  { id: 'g-kakariko', cluster: 'games', type: 'sticky', color: 'yellow', text: '**kakariko village.** a no-build three.js voxel landscape.' },
  { id: 'g-mc', cluster: 'games', type: 'sticky', color: 'gray', text: '**minecraft spatial architect.** floor plan first, playable structures out.' },

  // ── writing ──
  { id: 'r-blog', cluster: 'writing', type: 'link', title: 'the blog', url: 'https://app.collinrijock.com/blog', note: 'essays and drafts' },
  { id: 'r-dems', cluster: 'writing', type: 'link', title: 'democrats in the seventh party system', url: 'https://app.collinrijock.com/blog/democrats-in-the-seventh-party-system', note: '"2016 ruined the democratic party and it wasn\'t trump." · jan 2026' },
  { id: 'r-breadth', cluster: 'writing', type: 'link', title: 'breadth and ai first', url: '/essays/personal-philosophy', note: 'why generalists who go deep when it counts have an edge. draft' },
  { id: 'r-founders', cluster: 'writing', type: 'link', title: 'pantheon of founders', url: '/essays/pantheon-of-founders', note: 'the visionary, the executor, the disruptor, the builder. draft' },
  { id: 'r-china', cluster: 'writing', type: 'link', title: 'china', url: '/essays/china', note: 'super-apps, and hardware at shenzhen speed. draft' },
  { id: 'r-mini', cluster: 'writing', type: 'sticky', color: 'gray', text: '**next up:** the mac mini used to be cringe for server hosting. now it\'s my favourite server.' },
  { id: 'r-data', cluster: 'writing', type: 'sticky', color: 'gray', text: '**next up:** own your data in the age of llms.' },

  // ── ideas ──
  { id: 'i-build', cluster: 'ideas', type: 'quote', text: 'i like building software, writing about ideas, and figuring out how things work.' },
  { id: 'i-breadth', cluster: 'ideas', type: 'sticky', color: 'green', text: '**breadth first, ai native.** the engineer who ships across the stack beats the one waiting for tickets.' },
  { id: 'i-own', cluster: 'ideas', type: 'sticky', color: 'green', text: 'own the system end to end. **that\'s the edge.**' },
  { id: 'i-dead', cluster: 'ideas', type: 'sticky', color: 'yellow', text: 'features nobody uses aren\'t free. **cut them or fix them.**' },
  { id: 'i-files', cluster: 'ideas', type: 'sticky', color: 'white', text: '**files are the only truth.** every other store is a rebuildable cache.' },
  { id: 'i-loud', cluster: 'ideas', type: 'sticky', color: 'pink', text: 'failures should be loud. a pipeline dead for weeks at log level info is lying to you.' },
  { id: 'i-algo', cluster: 'ideas', type: 'sticky', color: 'white', text: 'make the requirements less dumb. **delete. simplify.** then speed up. automate last.' },
  { id: 'i-loop', cluster: 'ideas', type: 'sticky', color: 'purple', text: '**code owns the loop.** the model makes typed judgments inside it.' },
  { id: 'i-bounded', cluster: 'ideas', type: 'sticky', color: 'purple', text: 'agents get **bounded, reversible** work. never delete, never move money, one task per run.' },
  { id: 'i-quiet', cluster: 'ideas', type: 'sticky', color: 'purple', text: 'a good agent is quiet by default. text me when it matters, with a link to the thing.' },
  { id: 'i-undo', cluster: 'ideas', type: 'sticky', color: 'blue', text: '**reversibility makes yes cheap.** propose the write, ship the undo.' },
  { id: 'i-typed', cluster: 'ideas', type: 'sticky', color: 'blue', text: 'typed model first, llm only when it\'s unsure. most of the quality for a fraction of the cost.' },
  { id: 'i-kb', cluster: 'ideas', type: 'sticky', color: 'yellow', text: 'what\'s your favourite knowledge base for agents?' },
  { id: 'i-protocols', cluster: 'ideas', type: 'sticky', color: 'green', text: '**protocols before tools.** write the system down, then automate it.' },
  { id: 'i-block', cluster: 'ideas', type: 'sticky', color: 'white', text: 'one concrete deliverable per block beats a vague intention.' },
  { id: 'i-data', cluster: 'ideas', type: 'sticky', color: 'yellow', text: 'data is the truth i tell myself when i stop lying.' },
  { id: 'i-decade', cluster: 'ideas', type: 'sticky', color: 'green', text: 'compounding beats intensity. anyone can do a hard week. **almost nobody does a decent decade.**' },
  { id: 'i-cli', cluster: 'ideas', type: 'sticky', color: 'gray', text: 'clis over guis. bun over npm. answer first.' },
  { id: 'i-operator', cluster: 'ideas', type: 'sticky', color: 'pink', text: '**operator, not hustler.**' },
  { id: 'i-tenyear', cluster: 'ideas', type: 'sticky', color: 'pink', text: 'non-consensus ten-year ideas beat two-year clones.' },
  { id: 'i-friends', cluster: 'ideas', type: 'sticky', color: 'yellow', text: 'build what you and your friends actually want. (paul graham, but true)' },
  { id: 'i-founders', cluster: 'ideas', type: 'sticky', color: 'white', text: 'i read founders like codebases: hundreds of founders episodes, searchable.' },
  { id: 'i-kobe', cluster: 'ideas', type: 'sticky', color: 'gray', text: 'fundamentals over shiny objects. kinda like kobe.' },
  { id: 'i-colossus', cluster: 'ideas', type: 'sticky', color: 'blue', text: 'a colossus is a level, not an enemy.' },

  // ── before ──
  { id: 'b-buildrfi', cluster: 'before', type: 'sticky', color: 'white', text: '**buildrfi.** first engineer. a contractor lending product, zero to live loans.' },
  { id: 'b-disgo', cluster: 'before', type: 'sticky', color: 'white', text: '**disgo.** solo. crypto loyalty for restaurants, tap an nfc tag to check in.' },
  { id: 'b-lula', cluster: 'before', type: 'sticky', color: 'white', text: '**lula.** early frontend engineer. onboarding and underwriting flows.' },
  { id: 'b-kabcash', cluster: 'before', type: 'sticky', color: 'white', text: '**kabcash.** the react native app, built in college.' },
  { id: 'b-fiu-ml', cluster: 'before', type: 'sticky', color: 'white', text: '**fiu applied research center.** lstm anomaly detection on navy sensor data.' },

  // ── tools ──
  { id: 'l-ts', cluster: 'stack', type: 'logo', icon: 'typescript', label: 'typescript' },
  { id: 'l-react', cluster: 'stack', type: 'logo', icon: 'react', label: 'react' },
  { id: 'l-three', cluster: 'stack', type: 'logo', icon: 'threedotjs', label: 'three.js' },
  { id: 'l-unity', cluster: 'stack', type: 'logo', icon: 'unity', label: 'unity' },
  { id: 'l-rust', cluster: 'stack', type: 'logo', icon: 'rust', label: 'rust' },
  { id: 'l-python', cluster: 'stack', type: 'logo', icon: 'python', label: 'python' },
  { id: 'l-swift', cluster: 'stack', type: 'logo', icon: 'swift', label: 'swift' },
  { id: 'l-pg', cluster: 'stack', type: 'logo', icon: 'postgresql', label: 'postgres' },
  { id: 'l-bun', cluster: 'stack', type: 'logo', icon: 'bun', label: 'bun' },
  { id: 'l-expo', cluster: 'stack', type: 'logo', icon: 'expo', label: 'expo' },
  { id: 'l-claude', cluster: 'stack', type: 'logo', icon: 'claude', label: 'claude' },
  { id: 'l-next', cluster: 'stack', type: 'logo', icon: 'nextdotjs', label: 'next.js' },
  { id: 'l-torch', cluster: 'stack', type: 'logo', icon: 'pytorch', label: 'pytorch' },
  { id: 'l-godot', cluster: 'stack', type: 'logo', icon: 'godotengine', label: 'godot' },

  // ── find me ──
  { id: 'f-github', cluster: 'links', type: 'logo', icon: 'github', label: 'github', url: 'https://github.com/collinrijock' },
  { id: 'f-x', cluster: 'links', type: 'logo', icon: 'x', label: '@CollinRijock', url: 'https://x.com/CollinRijock' },
  { id: 'f-in', cluster: 'links', type: 'logo', glyph: 'in', label: 'linkedin', url: 'https://www.linkedin.com/in/collin-rijock/' },
  { id: 'f-mail', cluster: 'links', type: 'link', title: 'collin@rijock.com', url: 'mailto:collin@rijock.com', note: 'say hi' },
  { id: 'f-skills', cluster: 'links', type: 'sticky', color: 'white', text: '`npx skills add collinrijock/skill-files`' },
  { id: 'f-llms', cluster: 'links', type: 'link', title: 'llms.txt', url: 'llms.txt', note: 'this site, for agents' },
];

// arrows. within a cluster the map also threads a light chain; these are the cross-links.
export const EDGES = [
  ['name', 'lede'], ['name', 'v-future'], ['name', 'x-role'], ['name', 'c-db'], ['name', 'w-sidecar'],
  ['v-already', 'x-ems', 'already here'],
  ['v-touch', 'x-p3'],
  ['v-touch', 'x-twins'],
  ['v-cheap', 'w-sidecar', 'why'],
  ['r-china', 'v-future', 'shenzhen'],
  ['v-mountain', 'w-own'],
  ['x-twins', 'l-three', 'built with'],
  ['x-sim', 'x-teammates'],
  ['x-patents', 'x-sim', 'the research'], ['x-ade', 'w-bounded'], ['x-ade', 't-skills', 'skills for it'], ['x-browser', 'x-ade', 'for its agents'], ['x-browser', 't-jev', 'drives it'],
  ['x-teammates', 'c-chief', 'same idea, at home'],
  ['c-db', 'l-pg'],
  ['c-chief', 'l-claude'],
  ['c-mcp', 'f-skills'],
  ['c-mini', 'r-mini', 'wrote about it'],
  ['c-mcp', 'l-swift'],
  ['t-jev', 'c-what', 'powers intake'],
  ['t-deck', 'w-bounded', 'visible state'],
  ['t-skills', 'f-skills'],
  ['t-skills', 'w-sidecar'],
  ['t-orca', 'w-bounded'],
  ['t-vibe', 't-shellhacks'],
  ['t-shellhacks', 't-carecart'], ['t-shellhacks', 't-galactic'], ['t-shellhacks', 't-itx'], ['t-shellhacks', 't-wrapped'],
  ['t-itx', 'l-rust'],
  ['t-pokemon', 'l-torch'],
  ['t-pokemon', 'b-fiu-ml', 'same era'],
  ['t-gradient', 'l-three'], ['t-ascii', 't-gradient', 'then'],
  ['g-lotfg', 'g-lotfg2', 'the story'],
  ['g-lotfg2', 'l-unity'],
  ['g-kakariko', 'l-three'], ['g-crafty', 'l-three'],
  ['g-mc', 'l-python'],
  ['r-breadth', 'w-breadth'],
  ['r-founders', 'w-compound'],
  ['b-buildrfi', 'l-next'], ['b-disgo', 'l-expo'], ['b-kabcash', 'l-react'], ['b-lula', 'l-react'],
  ['fiu', 'b-fiu-ml'], ['fiu', 't-shellhacks'],
  ['miami', 'fiu'],
  ['f-github', 't-skills'], ['f-x', 'name'], ['f-mail', 'name', 'say hi'],
  ['r-blog', 'r-dems'],
  ['i-loop', 't-jev', 'how jev works'], ['i-typed', 't-jev'], ['i-bounded', 'c-chief', 'the contract'], ['i-quiet', 'c-chief'],
  ['i-files', 'c-db'], ['i-breadth', 'r-breadth', 'wrote about it'], ['i-founders', 'r-founders'], ['i-protocols', 'w-bounded'],
  ['i-colossus', 'g-iron', 'ironwake'], ['r-mini', 'c-mini', 'the post'], ['i-own', 'w-own'], ['i-undo', 'i-bounded']
];
