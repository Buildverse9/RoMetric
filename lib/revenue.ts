import type { GameRecordData } from './types';

export interface EstimatedRevenue {
  dailyUsd: number;
  monthlyUsd: number;
  yearlyUsd: number;
  monthlyLowUsd: number;
  monthlyHighUsd: number;
  monthlyRobux: number;
}

const DEVEX_RATE_USD_PER_ROBUX = 0.0035;

/**
 * Genre monetization multipliers reflecting typical Roblox ARPDAU & gamepass depth.
 */
const GENRE_MULTIPLIERS: Record<string, number> = {
  rpg: 1.34,
  simulation: 1.28,
  strategy: 1.24,
  'roleplay & avatar sim': 1.22,
  roleplay: 1.22,
  fighting: 1.18,
  action: 1.16,
  shooter: 1.14,
  adventure: 1.12,
  survival: 1.12,
  'sports & racing': 1.08,
  sports: 1.08,
  horror: 1.02,
  tycoon: 1.26,
  'obby & platformer': 0.86,
  obby: 0.86,
  'party & casual': 0.9,
  puzzle: 0.85,
  social: 0.82,
  entertainment: 0.84,
  education: 0.78,
};

function getGenreMultiplier(genre: string | null | undefined): number {
  if (!genre) return 1.0;
  const key = genre.trim().toLowerCase();
  if (GENRE_MULTIPLIERS[key] !== undefined) {
    return GENRE_MULTIPLIERS[key];
  }
  for (const [pattern, mult] of Object.entries(GENRE_MULTIPLIERS)) {
    if (key.includes(pattern)) return mult;
  }
  return 1.0;
}

/**
 * Estimates developer DevEx-equivalent revenue in USD from live concurrent players,
 * observed peak resilience, genre monetization depth, and player rating quality.
 */
export function estimateGameRevenue(game: GameRecordData): EstimatedRevenue {
  const ccu = Math.max(0, Number(game.currentCcu || 0));
  const peak = Math.max(ccu, Number(game.peakCcuObserved || 0));

  if (ccu <= 0 && peak <= 0) {
    return {
      dailyUsd: 0,
      monthlyUsd: 0,
      yearlyUsd: 0,
      monthlyLowUsd: 0,
      monthlyHighUsd: 0,
      monthlyRobux: 0,
    };
  }

  // Blend live CCU with observed peak so brief off-peak troughs don't skew monthly estimates
  const effectiveCcu = ccu * 0.82 + Math.min(peak, ccu * 2.5 + 100) * 0.18;

  // Base DevEx USD per effective CCU per day (~$18.60/mo per CCU baseline)
  const baseDailyPerCcu = 0.62;
  const genreMult = getGenreMultiplier(game.genre);

  // Rating quality factor (0.84x – 1.14x)
  const ratio =
    game.likeRatio !== null && game.likeRatio !== undefined
      ? Math.max(0, Math.min(100, game.likeRatio))
      : 82;
  const ratingMult = 0.84 + (ratio / 100) * 0.3;

  // Slight scale efficiency curve for established large-scale hits
  const scaleMult =
    effectiveCcu >= 100_000
      ? 1.1
      : effectiveCcu >= 25_000
        ? 1.05
        : effectiveCcu >= 1_000
          ? 1.0
          : 0.92;

  const dailyUsd = Math.round(
    effectiveCcu * baseDailyPerCcu * genreMult * ratingMult * scaleMult
  );
  const monthlyUsd = Math.round(dailyUsd * 30);
  const yearlyUsd = Math.round(dailyUsd * 365);
  const monthlyLowUsd = Math.round(monthlyUsd * 0.72);
  const monthlyHighUsd = Math.round(monthlyUsd * 1.28);
  const monthlyRobux = Math.round(monthlyUsd / DEVEX_RATE_USD_PER_ROBUX);

  return {
    dailyUsd,
    monthlyUsd,
    yearlyUsd,
    monthlyLowUsd,
    monthlyHighUsd,
    monthlyRobux,
  };
}

export function estimatePortfolioMonthlyRevenue(games: GameRecordData[]): number {
  return games.reduce((sum, g) => sum + estimateGameRevenue(g).monthlyUsd, 0);
}

export function formatCurrencyCompact(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '—';
  }
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1_000_000_000) {
    return `${sign}$${(abs / 1_000_000_000).toFixed(2)}B`;
  }
  if (abs >= 1_000_000) {
    return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  }
  if (abs >= 10_000) {
    return `${sign}$${(abs / 1_000).toFixed(1)}K`;
  }
  if (abs >= 1_000) {
    return `${sign}$${(abs / 1_000).toFixed(2)}K`;
  }
  return `${sign}$${Math.round(abs).toLocaleString('en-US')}`;
}

export function formatCurrencyExact(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '—';
  }
  return `$${Math.round(value).toLocaleString('en-US')}`;
}
