import type { GameRecordData } from './types';

export function formatCompactNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return 'N/A';
  }
  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(2)}B`;
  }
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(2)}M`;
  }
  if (value >= 10_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }
  return value.toLocaleString('en-US');
}

export function formatExactNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return 'N/A';
  }
  return Math.round(value).toLocaleString('en-US');
}

export function formatPercent(
  value: number | null | undefined,
  includeSign = true
): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return 'N/A';
  }
  const sign = includeSign && value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

export function computeLikeRatio(
  upVotes: number | null | undefined,
  downVotes: number | null | undefined
): number | null {
  if (
    upVotes === null ||
    upVotes === undefined ||
    downVotes === null ||
    downVotes === undefined
  ) {
    return null;
  }
  const total = upVotes + downVotes;
  if (total <= 0) return null;
  return Number(((upVotes / total) * 100).toFixed(1));
}

export function formatUtcTimestamp(iso: string | null | undefined): string {
  if (!iso) return 'N/A';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return date.toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
}

export function formatRelativeTime(iso: string | null | undefined): string {
  if (!iso) return 'N/A';
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return 'N/A';
  const diffSec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  return `${diffDays}d ago`;
}

export function slugify(input: string): string {
  const cleaned = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
  return cleaned || 'experience';
}

export function getHourBucket(date: Date): { bucket: string; bucketMs: number } {
  const d = new Date(date);
  d.setUTCMinutes(0, 0, 0);
  return {
    bucket: d.toISOString().slice(0, 13) + ':00Z',
    bucketMs: d.getTime(),
  };
}

export function getDayBucket(date: Date): { bucket: string; bucketMs: number } {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return {
    bucket: d.toISOString().slice(0, 10),
    bucketMs: d.getTime(),
  };
}

export interface TrendingEvaluation {
  eligible: boolean;
  score: number | null;
  reason: string;
  absoluteGain: number | null;
  percentGain: number | null;
}

/**
 * Transparent Trending Discovery Score:
 * Prevents noise (e.g., 1 -> 10 players = +900%) from dominating rankings.
 * Requires:
 *  1) Minimum live CCU >= 50
 *  2) At least 2 persisted observations (so growth is measured, never guessed)
 *  3) Valid measured growth (24h preferred, falling back to 1h if <24h history exists)
 */
export function evaluateTrending(game: GameRecordData): TrendingEvaluation {
  const minCcu = 50;
  const snapshots = game.snapshotCount ?? 0;

  if (game.currentCcu < minCcu) {
    return {
      eligible: false,
      score: null,
      reason: `Below ${minCcu} CCU minimum threshold`,
      absoluteGain: null,
      percentGain: null,
    };
  }

  const pct = game.growth24h ?? game.growth1h ?? null;
  if (pct === null || snapshots < 2) {
    return {
      eligible: false,
      score: null,
      reason: 'Awaiting >= 2 stored snapshots to measure real velocity',
      absoluteGain: null,
      percentGain: null,
    };
  }

  // Reconstruct baseline CCU from observed growth percentage
  const denom = 1 + pct / 100;
  const baselineCcu = denom > 0 ? game.currentCcu / denom : game.currentCcu;
  const absoluteGain = Math.round(game.currentCcu - baselineCcu);

  // Dampened percentage * log10 scale of absolute player base + stability weight
  const boundedPct = Math.max(-100, Math.min(pct, 500));
  const scaleFactor = Math.log10(Math.max(10, game.currentCcu));
  const completenessFactor = Math.min(1, snapshots / 6);
  const rawScore =
    (boundedPct * 0.55 + Math.max(0, Math.log10(Math.max(1, absoluteGain + 1)) * 18)) *
    (0.6 + 0.4 * completenessFactor) *
    (scaleFactor / 3);

  return {
    eligible: true,
    score: Number(rawScore.toFixed(1)),
    reason:
      game.growth24h !== null && game.growth24h !== undefined
        ? 'Measured 24h velocity & stability'
        : 'Measured 1h velocity (building 24h window)',
    absoluteGain,
    percentGain: pct,
  };
}

export interface BreakoutCandidate {
  game: GameRecordData;
  growthPct: number | null;
  breakoutScore: number;
  tag: 'Surging' | 'Near Peak' | 'Fast Climber' | 'Rising Hit';
  peakRatio: number;
}

/**
 * Identifies Breakout Games: fast-rising and surging experiences breaking out
 * with strong momentum, near-peak demand, or rapid player acceleration.
 */
export function evaluateBreakoutGames(
  games: GameRecordData[],
  limit = 6
): BreakoutCandidate[] {
  const active = games.filter((g) => g.active && g.currentCcu >= 100);
  if (active.length === 0) return [];

  const scored: BreakoutCandidate[] = active.map((game) => {
    const pct = game.growth1h ?? game.growth24h ?? null;
    const peak = Math.max(game.currentCcu, game.peakCcuObserved || 0);
    const peakRatio = peak > 0 ? game.currentCcu / peak : 0;

    // Favor rising momentum + emerging-to-mid viral scale + strong player approval
    const positivePct = pct !== null ? Math.max(0, Math.min(pct, 400)) : 0;
    const likeBonus =
      game.likeRatio !== null && game.likeRatio !== undefined
        ? Math.max(0, (game.likeRatio - 70) * 0.45)
        : 4;
    // Emerging / viral breakout bonus: high CCU relative to lifetime visits signals a brand-new breakout hit!
    const visitsPerCcu =
      game.currentCcu > 0 ? game.totalVisits / game.currentCcu : 1_000_000;
    const freshnessBonus =
      visitsPerCcu < 1_500
        ? 38
        : visitsPerCcu < 5_000
          ? 24
          : visitsPerCcu < 15_000
            ? 12
            : 0;
    const nearPeakBonus = peakRatio >= 0.92 ? 18 : peakRatio >= 0.8 ? 8 : 0;
    const scaleFactor = Math.log10(Math.max(100, game.currentCcu));

    const breakoutScore =
      positivePct * 1.45 +
      freshnessBonus +
      nearPeakBonus +
      likeBonus +
      scaleFactor * 4;

    let tag: BreakoutCandidate['tag'] = 'Rising Hit';
    if (positivePct >= 15) {
      tag = 'Surging';
    } else if (freshnessBonus >= 24) {
      tag = 'Fast Climber';
    } else if (peakRatio >= 0.92) {
      tag = 'Near Peak';
    }

    return {
      game,
      growthPct: pct,
      breakoutScore: Number(breakoutScore.toFixed(1)),
      tag,
      peakRatio,
    };
  });

  return scored
    .sort((a, b) => b.breakoutScore - a.breakoutScore)
    .slice(0, limit);
}

