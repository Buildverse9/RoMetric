export type AssetIdCategorySlug =
  | 'crosshairs'
  | 'decals'
  | 'hair'
  | 'faces'
  | 'gears'
  | 'music';

export type CuratedAssetHubType = 'crosshairs' | 'decals' | 'music';
export type LiveCatalogHubType = 'hair' | 'faces' | 'gears';

export interface CuratedAssetIdRecord {
  id: string;
  assetId: string;
  title: string;
  hubType: CuratedAssetHubType;
  subCategory: string;
  creatorOrArtist: string;
  tags: string[];
  /** Optional inline preview pattern for crosshairs so preview works instantly offline & online */
  crosshairStyle?: 'dot' | 'plus' | 'circle-dot' | 't-cross' | 'diamond' | 'box';
  crosshairColor?: string;
  verifiedWorking: boolean;
  addedAt: string;
  source?: 'seed' | 'admin';
}

export interface LiveCatalogAssetItem {
  assetId: string;
  name: string;
  creatorName: string;
  priceRobux: number | null;
  favoriteCount: number;
  thumbnailUrl: string | null;
  itemType: string;
  hubType: LiveCatalogHubType;
}

export interface AssetHubMeta {
  slug: AssetIdCategorySlug;
  mode: 'curated' | 'catalog';
  label: string;
  shortTitle: string;
  seoTitle: string;
  seoDescription: string;
  heroHeadline: string;
  heroSubtitle: string;
  subCategories: string[];
  faqs: Array<{ question: string; answer: string }>;
}

export const ASSET_HUB_META: Record<AssetIdCategorySlug, AssetHubMeta> = {
  crosshairs: {
    slug: 'crosshairs',
    mode: 'curated',
    label: 'Crosshair IDs',
    shortTitle: 'Crosshairs',
    seoTitle: 'Roblox Crosshair IDs (2026) — Da Hood & FPS Cursor Codes',
    seoDescription:
      'Copy working Roblox Crosshair IDs for Da Hood, Counter Blox, and FPS games. Test every reticle on light and dark game backdrops with 1-click Copy ID.',
    heroHeadline: 'Roblox Crosshair & Cursor IDs',
    heroSubtitle:
      'Precision dots, glowing circles, and pro FPS crosshairs for Da Hood, Counter Blox, Arsenal, and custom Roblox shooters—with live backdrop contrast testing.',
    subCategories: ['All', 'Da Hood', 'FPS Dots', 'Counter Blox', 'Minimal', 'Glowing'],
    faqs: [
      {
        question: 'How do I use a Roblox Crosshair ID in Da Hood or FPS games?',
        answer:
          'Copy the numeric Crosshair ID from RoMetric using the one-tap Copy ID button, open your game settings menu (such as Da Hood Crosshair Settings), paste the ID into the Custom Crosshair or Decal field, and save.',
      },
      {
        question: 'Do Roblox Crosshair IDs work on both PC and mobile?',
        answer:
          'Yes—any Roblox experience that supports custom crosshair decals renders the same numeric asset ID across desktop, tablet, and mobile clients.',
      },
      {
        question: 'What is the best crosshair ID for Da Hood headshots?',
        answer:
          'Competitive Da Hood players typically prefer compact 2–4px center dots or thin open-center plus reticles in bright cyan, white, or emerald green so the target head stays unobstructed.',
      },
    ],
  },
  decals: {
    slug: 'decals',
    mode: 'curated',
    label: 'Decal & Image IDs',
    shortTitle: 'Decals & Images',
    seoTitle: 'Roblox Image & Decal IDs (2026) — Working Picture Codes',
    seoDescription:
      'Browse verified Roblox Image IDs and Decal codes for anime, memes, aesthetic posters, Bloxburg art, and custom sprays with instant 1-click Copy ID.',
    heroHeadline: 'Roblox Image & Decal IDs',
    heroSubtitle:
      'Searchable library of working Roblox picture codes for Bloxburg paintings, Brookhaven signs, spray paints, and studio builds.',
    subCategories: ['All', 'Anime', 'Meme', 'Aesthetic', 'Gaming', 'Bloxburg Art'],
    faqs: [
      {
        question: 'What is the difference between a Roblox Image ID and Decal ID?',
        answer:
          'A Decal ID points to the marketplace wrapper asset, while an Image ID points to the raw texture asset. Most modern Roblox games (like Bloxburg and Brookhaven) accept either numeric ID and convert it automatically.',
      },
      {
        question: 'How do I paste a Decal ID into Bloxburg or Brookhaven?',
        answer:
          'Click Copy ID on any decal below, place a picture frame, TV, or sign in-game, click Change Picture, and paste the numeric code directly into the Enter Image ID box.',
      },
    ],
  },
  hair: {
    slug: 'hair',
    mode: 'catalog',
    label: 'Hair IDs',
    shortTitle: 'Hair IDs',
    seoTitle: 'Roblox Hair IDs (2026) — Live Catalog Avatar Hair Codes',
    seoDescription:
      'Search thousands of live Roblox Hair IDs directly from the official Roblox Catalog—anime, messy, aesthetic, Y2K, and preppy hair codes with 1-click copy.',
    heroHeadline: 'Roblox Avatar Hair IDs',
    heroSubtitle:
      'Live searchable Roblox Catalog directory for anime spikes, messy layers, Y2K styles, and aesthetic avatar hair codes.',
    subCategories: ['All', 'Anime', 'Messy', 'Preppy', 'Y2K', 'Aesthetic', 'Black', 'Blonde'],
    faqs: [
      {
        question: 'How do I wear a Roblox Hair ID in games like Catalog Avatar Creator or Brookhaven?',
        answer:
          'Copy the numeric Hair ID with one click, open the Avatar Editor or ID input inside Catalog Avatar Creator, Brookhaven, or Berry Avenue, paste the number, and apply it to your character.',
      },
      {
        question: 'Are these Roblox Hair IDs synced live from Roblox?',
        answer:
          'Yes—RoMetric queries the official public Roblox Catalog API in real time so newly published UGC hairs, prices, and thumbnails stay fresh automatically.',
      },
    ],
  },
  faces: {
    slug: 'faces',
    mode: 'catalog',
    label: 'Face & Head IDs',
    shortTitle: 'Face IDs',
    seoTitle: 'Roblox Face IDs (2026) — Classic & Dynamic Head Codes',
    seoDescription:
      'Find working Roblox Face IDs and Dynamic Head codes live from the Roblox Catalog—preppy, anime, kawaii, scary, and classic faces with 1-click Copy ID.',
    heroHeadline: 'Roblox Face & Dynamic Head IDs',
    heroSubtitle:
      'Live Roblox Catalog lookup for classic faces, expressive dynamic heads, anime eyes, and preppy avatar face codes.',
    subCategories: ['All', 'Anime', 'Preppy', 'Kawaii', 'Smile', 'Scary', 'Blush'],
    faqs: [
      {
        question: 'Where can I use Roblox Face IDs?',
        answer:
          'Numeric Face IDs work in Brookhaven RP, Berry Avenue, Catalog Avatar Creator, Dress To Impress custom slots, and Roblox Studio character customization.',
      },
    ],
  },
  gears: {
    slug: 'gears',
    mode: 'catalog',
    label: 'Gear IDs',
    shortTitle: 'Gear IDs',
    seoTitle: 'Roblox Gear IDs (2026) — Swords, Weapons & Admin Codes',
    seoDescription:
      'Copy working Roblox Gear IDs for admin command games, swords, grappling hooks, boomboxes, and classic weapons synced live from the Roblox Catalog.',
    heroHeadline: 'Roblox Gear & Weapon IDs',
    heroSubtitle:
      'Live Catalog index of classic Roblox swords, admin gears, speed coils, grappling hooks, and fun tools ready for :gear commands.',
    subCategories: ['All', 'Sword', 'Gun', 'Coil', 'Potion', 'Boombox', 'Wings'],
    faqs: [
      {
        question: 'How do I spawn a Roblox Gear ID using admin commands?',
        answer:
          'Copy the Gear ID below and type ":gear me <ID>" (HD Admin / Kohl’s Admin) inside any Roblox game where you have admin permissions.',
      },
    ],
  },
  music: {
    slug: 'music',
    mode: 'curated',
    label: 'Music & Song IDs',
    shortTitle: 'Music IDs',
    seoTitle: 'Roblox Music IDs & Song Codes (2026) — Working Boombox List',
    seoDescription:
      'Copy working Roblox Music IDs and Boombox song codes for 2026—Phonk, Anime OST, Meme tracks, Pop, and Gaming beats verified for Roblox audio.',
    heroHeadline: 'Roblox Music & Boombox Song IDs',
    heroSubtitle:
      'Curated directory of working Roblox audio and song IDs filtered by Phonk, Anime, Meme, Gaming, and Pop genres.',
    subCategories: ['All', 'Phonk', 'Anime', 'Meme', 'Gaming', 'Pop & Chill'],
    faqs: [
      {
        question: 'Why do some older Roblox song IDs stop working?',
        answer:
          'Roblox updated audio privacy rules so copyrighted tracks uploaded by individual users are muted. RoMetric focuses on verified public Roblox library tracks and creator-cleared audio IDs.',
      },
      {
        question: 'How do I play a Music ID in Roblox?',
        answer:
          'Equip a Boombox or Radio gamepass inside a supported experience (such as Murder Mystery 2, Brookhaven, or Da Hood), paste the numeric Song ID from RoMetric, and press Play.',
      },
    ],
  },
};

export const ASSET_HUB_ORDER: AssetIdCategorySlug[] = [
  'crosshairs',
  'decals',
  'hair',
  'faces',
  'gears',
  'music',
];

export function isValidAssetHubSlug(
  value: string
): value is AssetIdCategorySlug {
  return value in ASSET_HUB_META;
}

export const CURATED_ASSET_IDS_SEED: CuratedAssetIdRecord[] = [
  // ---- CROSSHAIRS ----
  {
    id: 'seed-ch-1',
    assetId: '1827745860',
    title: 'Pro White Center Dot',
    hubType: 'crosshairs',
    subCategory: 'Da Hood',
    creatorOrArtist: 'RoMetric Curated',
    tags: ['da hood', 'dot', 'white', 'headshot', 'clean'],
    crosshairStyle: 'dot',
    crosshairColor: '#ffffff',
    verifiedWorking: true,
    addedAt: '2026-11-01T00:00:00Z',
    source: 'seed',
  },
  {
    id: 'seed-ch-2',
    assetId: '5998624778',
    title: 'Neon Cyan Precision Dot',
    hubType: 'crosshairs',
    subCategory: 'Da Hood',
    creatorOrArtist: 'RoMetric Curated',
    tags: ['da hood', 'cyan', 'dot', 'fps', 'glow'],
    crosshairStyle: 'dot',
    crosshairColor: '#22d3ee',
    verifiedWorking: true,
    addedAt: '2026-11-01T00:00:00Z',
    source: 'seed',
  },
  {
    id: 'seed-ch-3',
    assetId: '2869492720',
    title: 'Classic Counter Blox Green Plus',
    hubType: 'crosshairs',
    subCategory: 'Counter Blox',
    creatorOrArtist: 'RoMetric Curated',
    tags: ['counter blox', 'green', 'plus', 'classic', 'cs'],
    crosshairStyle: 'plus',
    crosshairColor: '#10e89a',
    verifiedWorking: true,
    addedAt: '2026-11-01T00:00:00Z',
    source: 'seed',
  },
  {
    id: 'seed-ch-4',
    assetId: '6371861912',
    title: 'Open Circle Red Reticle',
    hubType: 'crosshairs',
    subCategory: 'FPS Dots',
    creatorOrArtist: 'RoMetric Curated',
    tags: ['circle', 'red', 'arsenal', 'rivals', 'fps'],
    crosshairStyle: 'circle-dot',
    crosshairColor: '#f43f5e',
    verifiedWorking: true,
    addedAt: '2026-11-02T00:00:00Z',
    source: 'seed',
  },
  {
    id: 'seed-ch-5',
    assetId: '4509792662',
    title: 'Minimal Thin White Cross',
    hubType: 'crosshairs',
    subCategory: 'Minimal',
    creatorOrArtist: 'RoMetric Curated',
    tags: ['minimal', 'thin', 'white', 'da hood', 'rivals'],
    crosshairStyle: 'plus',
    crosshairColor: '#f8fafc',
    verifiedWorking: true,
    addedAt: '2026-11-02T00:00:00Z',
    source: 'seed',
  },
  {
    id: 'seed-ch-6',
    assetId: '5667422974',
    title: 'T-Shape Headshot Sight',
    hubType: 'crosshairs',
    subCategory: 'Counter Blox',
    creatorOrArtist: 'RoMetric Curated',
    tags: ['t-cross', 'headshot', 'counter blox', 'yellow'],
    crosshairStyle: 't-cross',
    crosshairColor: '#facc15',
    verifiedWorking: true,
    addedAt: '2026-11-03T00:00:00Z',
    source: 'seed',
  },
  {
    id: 'seed-ch-7',
    assetId: '7246218990',
    title: 'Emerald Glow Ring Dot',
    hubType: 'crosshairs',
    subCategory: 'Glowing',
    creatorOrArtist: 'RoMetric Curated',
    tags: ['emerald', 'glow', 'ring', 'da hood'],
    crosshairStyle: 'circle-dot',
    crosshairColor: '#10e89a',
    verifiedWorking: true,
    addedAt: '2026-11-03T00:00:00Z',
    source: 'seed',
  },
  {
    id: 'seed-ch-8',
    assetId: '6118012304',
    title: 'Diamond Sniper Micro-Cross',
    hubType: 'crosshairs',
    subCategory: 'FPS Dots',
    creatorOrArtist: 'RoMetric Curated',
    tags: ['diamond', 'sniper', 'violet', 'fps'],
    crosshairStyle: 'diamond',
    crosshairColor: '#a78bfa',
    verifiedWorking: true,
    addedAt: '2026-11-04T00:00:00Z',
    source: 'seed',
  },
  {
    id: 'seed-ch-9',
    assetId: '4168421095',
    title: 'Shotgun Box Spread Frame',
    hubType: 'crosshairs',
    subCategory: 'Da Hood',
    creatorOrArtist: 'RoMetric Curated',
    tags: ['shotgun', 'box', 'da hood', 'db'],
    crosshairStyle: 'box',
    crosshairColor: '#fb923c',
    verifiedWorking: true,
    addedAt: '2026-11-04T00:00:00Z',
    source: 'seed',
  },
  {
    id: 'seed-ch-10',
    assetId: '316279304',
    title: 'Classic Crisp Black-Outline Dot',
    hubType: 'crosshairs',
    subCategory: 'Minimal',
    creatorOrArtist: 'RoMetric Curated',
    tags: ['classic', 'dot', 'outline', 'minimal'],
    crosshairStyle: 'dot',
    crosshairColor: '#e2e8f0',
    verifiedWorking: true,
    addedAt: '2026-11-05T00:00:00Z',
    source: 'seed',
  },

  // ---- DECALS & IMAGES ----
  {
    id: 'seed-dc-1',
    assetId: '6403436054',
    title: 'Lofi Night City Window Art',
    hubType: 'decals',
    subCategory: 'Aesthetic',
    creatorOrArtist: 'Community Archive',
    tags: ['lofi', 'city', 'aesthetic', 'bloxburg', 'poster'],
    verifiedWorking: true,
    addedAt: '2026-11-01T00:00:00Z',
    source: 'seed',
  },
  {
    id: 'seed-dc-2',
    assetId: '4830866131',
    title: 'Classic Surprised Cat Reaction',
    hubType: 'decals',
    subCategory: 'Meme',
    creatorOrArtist: 'Community Archive',
    tags: ['cat', 'meme', 'funny', 'spray'],
    verifiedWorking: true,
    addedAt: '2026-11-01T00:00:00Z',
    source: 'seed',
  },
  {
    id: 'seed-dc-3',
    assetId: '7192578452',
    title: 'Neon Samurai Katana Silhouette',
    hubType: 'decals',
    subCategory: 'Anime',
    creatorOrArtist: 'Community Archive',
    tags: ['anime', 'samurai', 'neon', 'katana'],
    verifiedWorking: true,
    addedAt: '2026-11-02T00:00:00Z',
    source: 'seed',
  },
  {
    id: 'seed-dc-4',
    assetId: '5194652831',
    title: 'Minimalist Coffee Shop Menu Board',
    hubType: 'decals',
    subCategory: 'Bloxburg Art',
    creatorOrArtist: 'Community Archive',
    tags: ['bloxburg', 'cafe', 'menu', 'sign'],
    verifiedWorking: true,
    addedAt: '2026-11-02T00:00:00Z',
    source: 'seed',
  },
  {
    id: 'seed-dc-5',
    assetId: '6845245656',
    title: 'Pixel Retro Arcade Screen',
    hubType: 'decals',
    subCategory: 'Gaming',
    creatorOrArtist: 'Community Archive',
    tags: ['gaming', 'arcade', 'pixel', 'retro'],
    verifiedWorking: true,
    addedAt: '2026-11-03T00:00:00Z',
    source: 'seed',
  },
  {
    id: 'seed-dc-6',
    assetId: '7078270658',
    title: 'Pastel Sakura Sunset Painting',
    hubType: 'decals',
    subCategory: 'Bloxburg Art',
    creatorOrArtist: 'Community Archive',
    tags: ['sakura', 'sunset', 'pastel', 'bloxburg'],
    verifiedWorking: true,
    addedAt: '2026-11-03T00:00:00Z',
    source: 'seed',
  },
  {
    id: 'seed-dc-7',
    assetId: '5915590179',
    title: 'Cyber Grid Gaming Setup Wallpaper',
    hubType: 'decals',
    subCategory: 'Gaming',
    creatorOrArtist: 'Community Archive',
    tags: ['gaming', 'setup', 'monitor', 'bloxburg'],
    verifiedWorking: true,
    addedAt: '2026-11-04T00:00:00Z',
    source: 'seed',
  },
  {
    id: 'seed-dc-8',
    assetId: '6205218493',
    title: 'Shiba Inu Sunglasses Doge',
    hubType: 'decals',
    subCategory: 'Meme',
    creatorOrArtist: 'Community Archive',
    tags: ['doge', 'shiba', 'meme', 'cool'],
    verifiedWorking: true,
    addedAt: '2026-11-04T00:00:00Z',
    source: 'seed',
  },
  {
    id: 'seed-dc-9',
    assetId: '7451982041',
    title: 'Anime Cursed Energy Aura Banner',
    hubType: 'decals',
    subCategory: 'Anime',
    creatorOrArtist: 'Community Archive',
    tags: ['anime', 'jjk', 'aura', 'banner'],
    verifiedWorking: true,
    addedAt: '2026-11-05T00:00:00Z',
    source: 'seed',
  },
  {
    id: 'seed-dc-10',
    assetId: '6984102371',
    title: 'Botanical Minimalist Framed Leaves',
    hubType: 'decals',
    subCategory: 'Aesthetic',
    creatorOrArtist: 'Community Archive',
    tags: ['botanical', 'plants', 'bloxburg', 'aesthetic'],
    verifiedWorking: true,
    addedAt: '2026-11-05T00:00:00Z',
    source: 'seed',
  },

  // ---- MUSIC & BOOMBOX SONG IDS ----
  {
    id: 'seed-mu-1',
    assetId: '1848354536',
    title: 'Relaxed Scene (Roblox Library Classic)',
    hubType: 'music',
    subCategory: 'Pop & Chill',
    creatorOrArtist: 'APM Music / Roblox Audio',
    tags: ['chill', 'brookhaven', 'lounge', 'verified'],
    verifiedWorking: true,
    addedAt: '2026-11-01T00:00:00Z',
    source: 'seed',
  },
  {
    id: 'seed-mu-2',
    assetId: '1837879082',
    title: 'Paradise Falls — Synth Chillwave',
    hubType: 'music',
    subCategory: 'Pop & Chill',
    creatorOrArtist: 'Roblox Audio Library',
    tags: ['synth', 'chill', 'aesthetic', 'driving'],
    verifiedWorking: true,
    addedAt: '2026-11-01T00:00:00Z',
    source: 'seed',
  },
  {
    id: 'seed-mu-3',
    assetId: '9043887091',
    title: 'Midnight Drift Phonk Beat',
    hubType: 'music',
    subCategory: 'Phonk',
    creatorOrArtist: 'Roblox Audio Library',
    tags: ['phonk', 'drift', 'bass', 'da hood', '2026'],
    verifiedWorking: true,
    addedAt: '2026-11-02T00:00:00Z',
    source: 'seed',
  },
  {
    id: 'seed-mu-4',
    assetId: '1841647093',
    title: 'Life in an Elevator (Meme Lobby Music)',
    hubType: 'music',
    subCategory: 'Meme',
    creatorOrArtist: 'APM Music / Roblox Audio',
    tags: ['elevator', 'meme', 'funny', 'classic'],
    verifiedWorking: true,
    addedAt: '2026-11-02T00:00:00Z',
    source: 'seed',
  },
  {
    id: 'seed-mu-5',
    assetId: '1836842889',
    title: '8-Bit Arcade Boss Rush',
    hubType: 'music',
    subCategory: 'Gaming',
    creatorOrArtist: 'Roblox Audio Library',
    tags: ['gaming', '8bit', 'arcade', 'retro', 'boss'],
    verifiedWorking: true,
    addedAt: '2026-11-03T00:00:00Z',
    source: 'seed',
  },
  {
    id: 'seed-mu-6',
    assetId: '1845341094',
    title: 'High-Energy Anime Battle Strings',
    hubType: 'music',
    subCategory: 'Anime',
    creatorOrArtist: 'Roblox Audio Library',
    tags: ['anime', 'battle', 'epic', 'pvp'],
    verifiedWorking: true,
    addedAt: '2026-11-03T00:00:00Z',
    source: 'seed',
  },
  {
    id: 'seed-mu-7',
    assetId: '1846368080',
    title: 'Stadium Victory Anthem (Sports Hype)',
    hubType: 'music',
    subCategory: 'Gaming',
    creatorOrArtist: 'Roblox Audio Library',
    tags: ['hype', 'sports', 'rivals', 'anthem'],
    verifiedWorking: true,
    addedAt: '2026-11-04T00:00:00Z',
    source: 'seed',
  },
  {
    id: 'seed-mu-8',
    assetId: '9046863253',
    title: 'Tokyo Street Night Phonk',
    hubType: 'music',
    subCategory: 'Phonk',
    creatorOrArtist: 'Roblox Audio Library',
    tags: ['phonk', 'tokyo', 'night', 'car'],
    verifiedWorking: true,
    addedAt: '2026-11-04T00:00:00Z',
    source: 'seed',
  },
  {
    id: 'seed-mu-9',
    assetId: '1837768375',
    title: 'Sakura Lo-Fi Piano Loop',
    hubType: 'music',
    subCategory: 'Anime',
    creatorOrArtist: 'Roblox Audio Library',
    tags: ['anime', 'piano', 'lofi', 'study'],
    verifiedWorking: true,
    addedAt: '2026-11-05T00:00:00Z',
    source: 'seed',
  },
  {
    id: 'seed-mu-10',
    assetId: '1843404009',
    title: 'Funny Cartoon Chase Theme',
    hubType: 'music',
    subCategory: 'Meme',
    creatorOrArtist: 'Roblox Audio Library',
    tags: ['meme', 'cartoon', 'chase', 'funny'],
    verifiedWorking: true,
    addedAt: '2026-11-05T00:00:00Z',
    source: 'seed',
  },
];

export function isValidAssetIdCategory(
  value: string
): value is AssetIdCategorySlug {
  return Object.prototype.hasOwnProperty.call(ASSET_HUB_META, value);
}
