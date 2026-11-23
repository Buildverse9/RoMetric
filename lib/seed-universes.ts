import type { TrackingTier } from './types';

export interface SeedUniverseEntry {
  universeId: string;
  tier: TrackingTier;
}

/**
 * Curated fallback list of verified, publicly listed Roblox Universe IDs.
 * Combined with Roblox's live Explore Charts API (Top Playing Now, Top Trending,
 * Up & Coming) so RoMetric always tracks current viral hits alongside classics.
 * Every single metric is fetched live from Roblox's official public APIs.
 */
export const SEED_UNIVERSES: SeedUniverseEntry[] = [
  { universeId: '10563114921', tier: 'tier_1' }, // Steal An Egg
  { universeId: '1686885941', tier: 'tier_1' },  // Brookhaven RP
  { universeId: '383310974', tier: 'tier_1' },   // Adopt Me!
  { universeId: '994732206', tier: 'tier_1' },   // Blox Fruits
  { universeId: '10766972131', tier: 'tier_1' }, // Throw Food For Animals
  { universeId: '5569032992', tier: 'tier_1' },  // Dandy's World
  { universeId: '66654135', tier: 'tier_1' },    // Murder Mystery 2
  { universeId: '7326934954', tier: 'tier_1' },  // 99 Nights in the Forest
  { universeId: '6035872082', tier: 'tier_1' },  // RIVALS
  { universeId: '10773618503', tier: 'tier_1' }, // Hyper Realistic Ragdoll
  { universeId: '3508322461', tier: 'tier_1' },  // Jujutsu Shenanigans
  { universeId: '2711375305', tier: 'tier_1' },  // Catalog Avatar Creator
  { universeId: '5203828273', tier: 'tier_1' },  // Dress To Impress
  { universeId: '5750914919', tier: 'tier_1' },  // Fisch
  { universeId: '7709344486', tier: 'tier_1' },  // Steal a Brainrot
  { universeId: '3317771874', tier: 'tier_1' },  // Pet Simulator 99
  { universeId: '3808081382', tier: 'tier_1' },  // The Strongest Battlegrounds
  { universeId: '10770730129', tier: 'tier_1' }, // Ragdoll Soccer
  { universeId: '7660436108', tier: 'tier_1' },  // Anime Crusaders X
  { universeId: '10770526777', tier: 'tier_1' }, // 100 Miles Down the River
  { universeId: '2440500124', tier: 'tier_2' },  // DOORS
  { universeId: '4777817887', tier: 'tier_2' },  // Blade Ball
  { universeId: '2619619496', tier: 'tier_2' },  // BedWars
  { universeId: '703124385', tier: 'tier_2' },   // Tower of Hell
  { universeId: '3240075297', tier: 'tier_2' },  // Berry Avenue RP
  { universeId: '5361032378', tier: 'tier_2' },  // Sol's RNG
  { universeId: '601130232', tier: 'tier_2' },   // Bee Swarm Simulator
  { universeId: '4778845442', tier: 'tier_2' },  // Toilet Tower Defense
  { universeId: '65241', tier: 'tier_2' },       // Natural Disaster Survival
  { universeId: '47545', tier: 'tier_2' },       // Work at a Pizza Place
  { universeId: '245662005', tier: 'tier_2' },   // Jailbreak
  { universeId: '111958650', tier: 'tier_2' },   // Arsenal
  { universeId: '321778215', tier: 'tier_2' },   // Royale High
  { universeId: '88070565', tier: 'tier_2' },    // Welcome to Bloxburg
  { universeId: '1516533665', tier: 'tier_2' },  // Piggy
  { universeId: '3647333358', tier: 'tier_2' },  // Evade
  { universeId: '6331902150', tier: 'tier_3' },  // Forsaken
  { universeId: '140239261', tier: 'tier_3' },   // MeepCity
  { universeId: '115797356', tier: 'tier_3' },   // Counter Blox
  { universeId: '1451439645', tier: 'tier_3' },  // King Legacy
  { universeId: '210851291', tier: 'tier_3' },   // Build A Boat For Treasure
  { universeId: '1526814825', tier: 'tier_3' },  // All Star Tower Defense
];

export const DEFAULT_ADMIN_EMAIL = 'shraddhavengurlekar200216@gmail.com';
