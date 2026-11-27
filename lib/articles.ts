export interface ArticleSection {
  heading: string;
  paragraphs: string[];
  bullets?: string[];
}

export interface ArticleFaqItem {
  question: string;
  answer: string;
}

export interface ArticleFeaturedGame {
  placeId: string;
  universeId: string;
  name: string;
  creatorName: string;
  creatorId: string;
  robloxUrl: string;
}

export interface ArticleItem {
  slug: string;
  title: string;
  shortTitle: string;
  excerpt: string;
  category: string;
  publishedAt: string;
  updatedAt: string;
  readTimeMinutes: number;
  author: string;
  keywords: string[];
  disclaimerTitle: string;
  disclaimerBody: string;
  featuredGame?: ArticleFeaturedGame;
  /**
   * Paste any public X (Twitter) video post URLs here
   * e.g. 'https://x.com/username/status/1234567890123456789'
   * They will automatically render as native embedded X video players.
   */
  xVideoUrls: string[];
  xSearchUrl: string;
  xSearchLabel: string;
  sections: ArticleSection[];
  faqs: ArticleFaqItem[];
}

export interface LiveRobloxArticleSnapshot {
  universeId: string;
  rootPlaceId: string;
  name: string;
  creatorName: string;
  playing: number;
  visits: number;
  favorites: number;
  upVotes: number;
  downVotes: number;
  likeRatio: number | null;
  created: string | null;
  updated: string | null;
  iconUrl: string | null;
  thumbnailUrl: string | null;
}

export const ARTICLES: ArticleItem[] = [
  {
    slug: 'gta-6-on-roblox-loading-screen-prank',
    title:
      '"GTA 6" on Roblox: Inside the Viral Loading Screen Experience That Never Actually Starts',
    shortTitle: '"GTA 6" on Roblox — The Infinite Loading Screen Explained',
    excerpt:
      'Over a million players rushed into "GTA 6" on Roblox expecting Vice City gameplay—only to discover a hilarious joke experience that recreates the iconic loading screen and loops forever without ever starting.',
    category: 'Viral & Culture',
    publishedAt: '2026-11-24T12:00:00Z',
    updatedAt: '2026-11-24T12:00:00Z',
    readTimeMinutes: 4,
    author: 'RoMetric Editorial',
    keywords: [
      'GTA 6 on Roblox',
      'Roblox GTA 6',
      'GTA 6 Roblox loading screen',
      '84045493213464',
      'Dubayy GTA 6 Roblox',
      'is GTA 6 on Roblox real',
    ],
    disclaimerTitle: 'Just for Fun — Not the Actual GTA 6 Game',
    disclaimerBody:
      'This Roblox experience is made purely for fun and comedy. It does not contain the actual GTA 6 game or playable Vice City gameplay—only the iconic loading screen has been recreated, and the game simply keeps loading forever and never starts.',
    featuredGame: {
      placeId: '84045493213464',
      universeId: '10778568998',
      name: 'GTA 6',
      creatorName: 'Dubayy',
      creatorId: '17108485',
      robloxUrl: 'https://www.roblox.com/games/84045493213464/GTA-6',
    },
    xVideoUrls: ['https://x.com/RoMetricHQ/status/2125497503751823744'],
    xSearchUrl:
      'https://x.com/search?q=%22GTA%206%22%20Roblox%20loading&f=video',
    xSearchLabel: 'Watch live "GTA 6 on Roblox" clips on X',
    sections: [
      {
        heading: 'What Happens When You Join "GTA 6" on Roblox?',
        paragraphs: [
          'If you have scrolled through X, TikTok, or the Roblox discovery charts recently, you have almost certainly seen clips of players launching a game simply titled "GTA 6" (published by group Dubayy under Place ID 84045493213464). Within its first 48 hours online, the experience surged past 1.75 million visits and pulled thousands of concurrent players at the same time.',
          'The twist? There is no open-world Vice City map waiting on the other side. The entire experience is built strictly for fun: only the iconic GTA-style loading screen has been copied into Roblox. Once you press Play, the loading art and progress indicator keep cycling endlessly—and the actual game never gets started.',
        ],
      },
      {
        heading: 'Why Players Keep Joining (and Laughing About It)',
        paragraphs: [
          'Part of what made this experience go mega-viral is how cleanly it nails the punchline. Anyone who has spent years waiting on classic Grand Theft Auto loading screens instantly recognizes the joke. Instead of being a hidden scam, it leans right into internet meme culture—even sneaking the cheeky subtitle "Grand Trains Analytics 6" at the bottom of its Roblox description.',
          'Players immediately started screen-recording their friends sitting patiently for five or ten minutes waiting for the progress bar to finish, then posting those reaction clips to X. Every viral clip drove another wave of curious Roblox players straight into the lobby to see the prank for themselves—and to troll their own friends into joining.',
        ],
        bullets: [
          'Purely a comedy & parody experience built for laughs—not an actual GTA 6 port or playable city game.',
          'Only the loading screen sequence is recreated; it keeps loading indefinitely and never transitions into gameplay.',
          'Its polarized upvote/downvote ratio captures the exact split between players laughing at the prank and players realizing they waited for nothing.',
        ],
      },
      {
        heading: 'How to Spot Parody Experiences vs. Real Open-World Games',
        paragraphs: [
          'Viral meme experiences pop up regularly on Roblox whenever a massive gaming headline dominates social media. Because launching a Roblox experience takes seconds and costs nothing, curiosity alone can send a one-room joke game straight into the top trending charts overnight.',
          'If you are jumping into "GTA 6" on Roblox, go in knowing it is strictly for fun and a quick laugh with friends. Remember that Rockstar Games has not released GTA 6 on Roblox, and you should never click off-platform links or download external files claiming to unlock "playable GTA 6" inside Roblox.',
        ],
      },
    ],
    faqs: [
      {
        question: 'Does the "GTA 6" game on Roblox actually load and start?',
        answer:
          'No. The experience is made purely for fun—only the loading screen is recreated, so it keeps loading endlessly and never actually starts into gameplay.',
      },
      {
        question: 'Is the actual GTA 6 game available inside Roblox?',
        answer:
          'No. Grand Theft Auto VI is developed by Rockstar Games and is not available on Roblox. Place ID 84045493213464 by Dubayy is a community-made parody experience built around the loading screen joke.',
      },
      {
        question: 'Why does GTA 6 on Roblox have millions of visits?',
        answer:
          'Short reaction videos on X and TikTok showing players waiting on the endless loading screen went viral, sparking a wave of players joining to see the joke firsthand and prank their friends.',
      },
    ],
  },
  {
    slug: 'how-much-do-top-roblox-games-make-a-month',
    title:
      'How Much Do Top Roblox Games Make a Month? (2026 Earnings & DevEx Breakdown)',
    shortTitle: 'How Much Do Top Roblox Games Make a Month?',
    excerpt:
      'From 1,000-CCU breakout hits to 200,000-CCU mega-experiences like Brookhaven RP, see how much Roblox games actually earn per month in USD and Robux after DevEx.',
    category: 'Revenue & Economy',
    publishedAt: '2026-11-27T12:00:00Z',
    updatedAt: '2026-11-27T12:00:00Z',
    readTimeMinutes: 5,
    author: 'RoMetric Research',
    keywords: [
      'how much do Roblox games make',
      'how much does Brookhaven make a month',
      'highest earning Roblox games 2026',
      'Roblox DevEx calculator',
      'Roblox game revenue per player',
      'how much money do Roblox developers make',
    ],
    disclaimerTitle: 'How RoMetric Estimates Developer Earnings',
    disclaimerBody:
      'Roblox does not publish exact private payouts for individual experiences. All dollar figures are transparent DevEx-equivalent estimates modeled from live concurrent players (CCU), observed peak resilience, genre monetization depth, and approval ratings.',
    featuredGame: {
      placeId: '4924922222',
      universeId: '1686885941',
      name: 'Brookhaven RP',
      creatorName: 'Wolfpaq',
      creatorId: '4924922222',
      robloxUrl: 'https://www.roblox.com/games/4924922222/Brookhaven-RP',
    },
    xVideoUrls: [],
    xSearchUrl:
      'https://x.com/search?q=Roblox%20game%20revenue%20DevEx&f=top',
    xSearchLabel: 'Explore Roblox developer revenue discussions on X',
    sections: [
      {
        heading: 'How Much Does a Roblox Game Make per 1,000 Live Players?',
        paragraphs: [
          'The single fastest benchmark used by Roblox studios and analysts is monthly DevEx revenue per sustained concurrent player (CCU). Across the Roblox economy, an average game with steady retention and standard gamepass monetization generates roughly $15 to $25 USD per month for every 1 sustained CCU at official Developer Exchange (DevEx) rates ($0.0035 per Robux).',
          'That means a breakout game holding 1,000 average live players typically earns around $15,000 to $25,000 per month before team splits and ad spend. A top-50 hit averaging 25,000 live players often lands between $450,000 and $650,000 per month—while flagship mega-hits sustaining 150,000+ CCU can cross $2M to $4M+ per month.',
        ],
        bullets: [
          '100 avg CCU: ~$1,500 – $2,500 / month (strong indie side income).',
          '1,000 avg CCU: ~$15,000 – $25,000 / month (full-time solo or small team).',
          '10,000 avg CCU: ~$160,000 – $260,000 / month (mid-sized Roblox studio).',
          '100,000+ avg CCU: ~$2.0M+ / month (flagship front-page franchises).',
        ],
      },
      {
        heading: 'Why Two Games With the Same Player Count Earn Very Different Money',
        paragraphs: [
          'Player count alone never tells the whole story. Genre monetization depth can easily double or halve a game’s earnings per player. RPGs, anime simulators, tycoons, and roleplay experiences with recurring passes, VIP bundles, and gacha/boost loops consistently outperform casual obbies or short-session meme experiences.',
          'Approval rating and session length matter just as much: games with 90%+ like ratios keep players coming back across weekends and updates, turning casual visitors into repeat Premium Payouts and gamepass buyers.',
        ],
      },
      {
        heading: 'How Roblox DevEx Converts Robux Into Real USD',
        paragraphs: [
          'When players spend Robux inside an experience, Roblox retains its marketplace fee before crediting net Robux to the creator. Eligible developers then convert earned Robux into USD via the Developer Exchange (DevEx) program at $0.0035 per Robux (so 1,000,000 earned Robux cashes out to $3,500 USD).',
          'On RoMetric, every game page and revenue insight report automatically tracks live CCU alongside estimated daily, monthly, and annual USD and Robux run-rates so you can compare any two Roblox experiences side by side in real time.',
        ],
      },
    ],
    faqs: [
      {
        question: 'How much does a top Roblox game make per month?',
        answer:
          'Top front-page Roblox experiences averaging 50,000 to 250,000+ concurrent players are estimated to generate between $1M and $5M+ per month in gross DevEx-equivalent developer revenue.',
      },
      {
        question: 'How much is 1,000,000 Robux worth in real money via DevEx?',
        answer:
          'At the standard Roblox DevEx payout rate of $0.0035 per Robux, 1,000,000 earned Robux converts to $3,500 USD.',
      },
      {
        question: 'Can I check how much a specific Roblox game makes?',
        answer:
          'Yes — open any game page on RoMetric or search our Market Insights hub to see live player counts alongside estimated daily, monthly, and yearly USD and Robux revenue.',
      },
    ],
  },
];

export function getArticleBySlug(slug: string): ArticleItem | undefined {
  return ARTICLES.find((a) => a.slug === slug);
}

export function formatArticleDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(d);
}

/**
 * Fetches live public Roblox metrics and artwork for an article's featured experience.
 * Cached via Next.js fetch revalidation so articles stay fast and fresh.
 */
export async function fetchLiveArticleGameSnapshot(
  placeId: string,
  knownUniverseId?: string
): Promise<LiveRobloxArticleSnapshot | null> {
  try {
    let universeId = knownUniverseId || '';
    if (!universeId) {
      const uRes = await fetch(
        `https://apis.roblox.com/universes/v1/places/${encodeURIComponent(placeId)}/universe`,
        { next: { revalidate: 300 } }
      );
      if (!uRes.ok) return null;
      const uJson = (await uRes.json()) as { universeId?: number };
      if (!uJson.universeId) return null;
      universeId = String(uJson.universeId);
    }

    const [gameRes, votesRes, iconRes, thumbRes] = await Promise.all([
      fetch(
        `https://games.roblox.com/v1/games?universeIds=${encodeURIComponent(universeId)}`,
        { next: { revalidate: 120 } }
      ),
      fetch(
        `https://games.roblox.com/v1/games/votes?universeIds=${encodeURIComponent(universeId)}`,
        { next: { revalidate: 120 } }
      ),
      fetch(
        `https://thumbnails.roblox.com/v1/games/icons?universeIds=${encodeURIComponent(universeId)}&size=512x512&format=Png&isCircular=false`,
        { next: { revalidate: 3600 } }
      ),
      fetch(
        `https://thumbnails.roblox.com/v1/games/multiget/thumbnails?universeIds=${encodeURIComponent(universeId)}&countPerUniverse=1&defaults=true&size=768x432&format=Png&isCircular=false`,
        { next: { revalidate: 3600 } }
      ),
    ]);

    if (!gameRes.ok) return null;
    const gamePayload = (await gameRes.json()) as {
      data?: Array<{
        id: number;
        rootPlaceId: number;
        name: string;
        creator?: { name?: string };
        playing?: number;
        visits?: number;
        favoritedCount?: number;
        created?: string;
        updated?: string;
      }>;
    };
    const info = gamePayload.data?.[0];
    if (!info) return null;

    let upVotes = 0;
    let downVotes = 0;
    if (votesRes.ok) {
      const vPayload = (await votesRes.json()) as {
        data?: Array<{ upVotes?: number; downVotes?: number }>;
      };
      upVotes = Number(vPayload.data?.[0]?.upVotes ?? 0);
      downVotes = Number(vPayload.data?.[0]?.downVotes ?? 0);
    }

    let iconUrl: string | null = null;
    if (iconRes.ok) {
      const iPayload = (await iconRes.json()) as {
        data?: Array<{ imageUrl?: string }>;
      };
      iconUrl = iPayload.data?.[0]?.imageUrl || null;
    }

    let thumbnailUrl: string | null = null;
    if (thumbRes.ok) {
      const tPayload = (await thumbRes.json()) as {
        data?: Array<{ thumbnails?: Array<{ imageUrl?: string }> }>;
      };
      thumbnailUrl = tPayload.data?.[0]?.thumbnails?.[0]?.imageUrl || null;
    }

    const totalVotes = upVotes + downVotes;
    const likeRatio =
      totalVotes > 0 ? Number(((upVotes / totalVotes) * 100).toFixed(1)) : null;

    return {
      universeId: String(info.id),
      rootPlaceId: String(info.rootPlaceId || placeId),
      name: info.name.trim(),
      creatorName: info.creator?.name || 'Roblox Creator',
      playing: Number(info.playing ?? 0),
      visits: Number(info.visits ?? 0),
      favorites: Number(info.favoritedCount ?? 0),
      upVotes,
      downVotes,
      likeRatio,
      created: info.created || null,
      updated: info.updated || null,
      iconUrl,
      thumbnailUrl,
    };
  } catch {
    return null;
  }
}
