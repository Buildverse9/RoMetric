import type { TimeRange } from './types';

export interface R2HistoryPoint {
  timestamp: string;
  timestampMs: number;
  ccu: number;
  minCcu?: number;
  maxCcu?: number;
  visits: number;
  favorites: number;
  sourceTable: 'game_hourly_stats' | 'game_daily_stats';
}

const PRIVATE_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^::1$/,
  /^\[::1\]$/,
  /\.local$/i,
  /\.internal$/i,
];

function getValidatedR2WorkerUrl(): string | null {
  const raw = (
    process.env.WARM_HISTORY_WORKER_URL ||
    process.env.R2_HISTORY_WORKER_URL ||
    ''
  ).trim();
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'https:') return null;
    if (PRIVATE_HOST_PATTERNS.some((re) => re.test(parsed.hostname))) {
      return null;
    }
    return parsed.origin + parsed.pathname.replace(/\/+$/, '');
  } catch {
    return null;
  }
}

export function isR2WarmHistoryConfigured(): boolean {
  return getValidatedR2WorkerUrl() !== null;
}

/**
 * Fetches Tier 2 Warm History (14d hourly + up to 5 years daily) directly from
 * the Cloudflare Worker + D1 database (5 GB free, no card, $0 egress, zero Supabase reads).
 * Returns null gracefully when WARM_HISTORY_WORKER_URL / R2_HISTORY_WORKER_URL is unset or unreachable.
 */
export async function fetchR2WarmHistory(
  universeId: string,
  range: TimeRange
): Promise<R2HistoryPoint[] | null> {
  if (range === '1h' || range === '24h') return null;
  if (!/^[0-9]{1,20}$/.test(universeId)) return null;

  const baseUrl = getValidatedR2WorkerUrl();
  if (!baseUrl) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2500);

  try {
    const res = await fetch(
      `${baseUrl}/history/${encodeURIComponent(universeId)}?range=${encodeURIComponent(range)}`,
      {
        headers: { Accept: 'application/json' },
        signal: controller.signal,
        next: { revalidate: 300 },
      }
    );
    if (!res.ok) return null;
    const payload = (await res.json()) as {
      points?: Array<{
        t: string;
        ms: number;
        c: number;
        min?: number;
        max?: number;
        v?: number;
        f?: number;
        src?: 'h' | 'd';
      }>;
    };

    if (!Array.isArray(payload.points) || payload.points.length === 0) {
      return null;
    }

    const out: R2HistoryPoint[] = [];
    for (const p of payload.points) {
      if (!p || typeof p.ms !== 'number' || !Number.isFinite(p.ms)) continue;
      out.push({
        timestamp: typeof p.t === 'string' ? p.t : new Date(p.ms).toISOString(),
        timestampMs: p.ms,
        ccu: Math.max(0, Math.round(Number(p.c) || 0)),
        minCcu: typeof p.min === 'number' ? Math.max(0, Math.round(p.min)) : undefined,
        maxCcu: typeof p.max === 'number' ? Math.max(0, Math.round(p.max)) : undefined,
        visits: Math.max(0, Math.round(Number(p.v) || 0)),
        favorites: Math.max(0, Math.round(Number(p.f) || 0)),
        sourceTable: p.src === 'h' ? 'game_hourly_stats' : 'game_daily_stats',
      });
    }
    return out.length > 0 ? out : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
