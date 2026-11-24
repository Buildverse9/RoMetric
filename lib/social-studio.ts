import { toPng } from 'html-to-image';
import type { GameRecordData } from './types';
import type { GameCodeDirectoryItem, GameCodeRecord } from './codes-types';
import {
  formatCompactNumber,
  formatExactNumber,
  formatPercent,
  evaluateBreakoutGames,
} from './format';
import { estimateGameRevenue, formatCurrencyCompact } from './revenue';

export type SocialTemplateId =
  | 'leaderboard'
  | 'surge'
  | 'milestone'
  | 'codes'
  | 'vs';

export type SocialAspectRatio = '16:9' | '1:1';

export type CaptionTone = 'news' | 'analyst' | 'debate';

export interface MilestoneSummary {
  headline: string;
  categoryLabel: string;
  heroValue: string;
  heroUnit: string;
  subDetail: string;
  progressLabel: string;
  progressPct: number;
  kind: 'ccu' | 'peak' | 'visits';
}

export interface DetectedStory {
  id: string;
  template: SocialTemplateId;
  kicker: string;
  title: string;
  metric: string;
  primaryUniverseId?: string;
  secondaryUniverseId?: string;
  codeGameSlug?: string;
}

export interface GeneratedCaptions {
  mainPost: string;
  replyPost: string;
  utmUrl: string;
  xIntentUrl: string;
}

export interface DailyChecklistState {
  dateKey: string;
  completedIds: string[];
}

export const SOCIAL_STAGE_DIMENSIONS: Record<
  SocialAspectRatio,
  { width: number; height: number; label: string; exportLabel: string }
> = {
  '16:9': {
    width: 1200,
    height: 675,
    label: '16:9 X Timeline',
    exportLabel: '2400 × 1350 PNG',
  },
  '1:1': {
    width: 1080,
    height: 1080,
    label: '1:1 Square',
    exportLabel: '2160 × 2160 PNG',
  },
};

export const DAILY_CADENCE_TASKS: Array<{
  id: string;
  slot: string;
  title: string;
  hint: string;
  recommendedTemplate: SocialTemplateId;
}> = [
  {
    id: 'morning_leaderboard',
    slot: 'Slot 1 · Morning',
    title: 'Post Daily Top 10 Live CCU Leaderboard',
    hint: 'Builds a reliable daily habit and earns bookmarks from players & devs.',
    recommendedTemplate: 'leaderboard',
  },
  {
    id: 'midday_spike',
    slot: 'Slot 2 · Midday',
    title: 'Post Breakout 24h Surge or Milestone Alert',
    hint: 'Tag the studio or creator handle on X — developer reposts drive the fastest growth.',
    recommendedTemplate: 'surge',
  },
  {
    id: 'evening_engagement',
    slot: 'Slot 3 · Evening',
    title: 'Post Head-to-Head Matchup or Active Code Drop',
    hint: 'Comparisons spark replies; verified code cards drive high-intent clicks to RoMetric.',
    recommendedTemplate: 'vs',
  },
];

const SITE_ORIGIN = 'https://rometrics.vercel.app';

const CCU_THRESHOLDS = [
  1_000_000, 750_000, 500_000, 250_000, 100_000, 50_000, 25_000, 10_000,
];

const VISIT_THRESHOLDS = [
  50_000_000_000, 25_000_000_000, 10_000_000_000, 5_000_000_000, 2_000_000_000,
  1_000_000_000, 500_000_000, 250_000_000, 100_000_000, 50_000_000,
];

export function getTodayUtcKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export function formatSnapshotDate(date = new Date()): string {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function formatSnapshotTimeUtc(date = new Date()): string {
  const hh = String(date.getUTCHours()).padStart(2, '0');
  const mm = String(date.getUTCMinutes()).padStart(2, '0');
  return `${hh}:${mm} UTC`;
}

export function buildUtmUrl(path: string, template: SocialTemplateId): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const sep = cleanPath.includes('?') ? '&' : '?';
  return `${SITE_ORIGIN}${cleanPath}${sep}utm_source=x&utm_medium=social&utm_campaign=${template}`;
}

export function getTopLeaderboardGames(
  games: GameRecordData[],
  count: 5 | 10 = 10
): GameRecordData[] {
  return [...games]
    .filter((g) => g.active && g.currentCcu > 0)
    .sort((a, b) => b.currentCcu - a.currentCcu)
    .slice(0, count);
}

export function computeNet24hGain(game: GameRecordData): number | null {
  const pct = game.growth24h ?? game.growth1h ?? null;
  if (pct === null || !Number.isFinite(pct)) return null;
  const denom = 1 + pct / 100;
  if (denom <= 0) return null;
  const baseline = game.currentCcu / denom;
  return Math.round(game.currentCcu - baseline);
}

export function getTopSurgeGames(
  games: GameRecordData[],
  limit = 6
): GameRecordData[] {
  const meaningful = games.filter(
    (g) => g.active && g.currentCcu >= 1000 && (g.growth24h ?? g.growth1h ?? 0) > 0
  );
  if (meaningful.length > 0) {
    return [...meaningful]
      .sort((a, b) => {
        const pctA = a.growth24h ?? a.growth1h ?? 0;
        const pctB = b.growth24h ?? b.growth1h ?? 0;
        const scoreA = pctA * Math.log10(Math.max(100, a.currentCcu));
        const scoreB = pctB * Math.log10(Math.max(100, b.currentCcu));
        return scoreB - scoreA;
      })
      .slice(0, limit);
  }
  return evaluateBreakoutGames(games, limit).map((c) => c.game);
}

export function detectGameMilestone(game: GameRecordData): MilestoneSummary {
  const ccu = Math.max(0, game.currentCcu || 0);
  const peak = Math.max(ccu, game.peakCcuObserved || 0);
  const visits = Math.max(0, game.totalVisits || 0);
  const peakRatio = peak > 0 ? (ccu / peak) * 100 : 0;

  // 1. Check if near or setting a new observed peak with significant CCU
  if (ccu >= 5_000 && peak > 0 && peakRatio >= 94) {
    const isNewPeak = ccu >= peak;
    return {
      headline: isNewPeak
        ? `${game.name} sets a new observed CCU peak`
        : `${game.name} approaches its all-time observed peak`,
      categoryLabel: isNewPeak ? 'New CCU Peak' : 'Near Peak Surge',
      heroValue: formatCompactNumber(ccu),
      heroUnit: 'Concurrent Players',
      subDetail: `Observed peak ${formatExactNumber(peak)} · ${peakRatio.toFixed(1)}% of record high`,
      progressLabel: 'Share of Observed Peak',
      progressPct: Math.min(100, Math.round(peakRatio)),
      kind: 'peak',
    };
  }

  // 2. Check crossed major live CCU threshold
  const crossedCcu = CCU_THRESHOLDS.find((t) => ccu >= t);
  if (crossedCcu && ccu >= 25_000) {
    const nextCcu =
      CCU_THRESHOLDS[CCU_THRESHOLDS.indexOf(crossedCcu) - 1] ?? crossedCcu * 2;
    const pctToNext = Math.min(100, Math.round((ccu / nextCcu) * 100));
    return {
      headline: `${game.name} holds above ${formatCompactNumber(crossedCcu)} live players`,
      categoryLabel: 'Live CCU Milestone',
      heroValue: formatCompactNumber(ccu),
      heroUnit: 'Concurrent Players',
      subDetail: `${formatExactNumber(ccu)} active now · Next mark ${formatCompactNumber(nextCcu)} CCU`,
      progressLabel: `Progress toward ${formatCompactNumber(nextCcu)} CCU`,
      progressPct: pctToNext,
      kind: 'ccu',
    };
  }

  // 3. Check lifetime visits milestone
  const crossedVisits = VISIT_THRESHOLDS.find((t) => visits >= t);
  if (crossedVisits) {
    const nextVisits =
      VISIT_THRESHOLDS[VISIT_THRESHOLDS.indexOf(crossedVisits) - 1] ??
      crossedVisits * 2;
    const pctToNext = Math.min(100, Math.round((visits / nextVisits) * 100));
    return {
      headline: `${game.name} surpasses ${formatCompactNumber(crossedVisits)} lifetime visits`,
      categoryLabel: 'Lifetime Visits Milestone',
      heroValue: formatCompactNumber(visits),
      heroUnit: 'Total Visits',
      subDetail: `${formatCompactNumber(ccu)} playing live · Next mark ${formatCompactNumber(nextVisits)} visits`,
      progressLabel: `Progress toward ${formatCompactNumber(nextVisits)} visits`,
      progressPct: pctToNext,
      kind: 'visits',
    };
  }

  // Fallback general milestone summary
  const nextVisitGoal = 50_000_000;
  return {
    headline: `${game.name} climbs to ${formatCompactNumber(ccu)} live players`,
    categoryLabel: 'Live Analytics Milestone',
    heroValue: formatCompactNumber(ccu),
    heroUnit: 'Concurrent Players',
    subDetail: `${formatCompactNumber(visits)} lifetime visits · Peak ${formatCompactNumber(peak)}`,
    progressLabel: `Progress toward ${formatCompactNumber(nextVisitGoal)} visits`,
    progressPct: Math.min(100, Math.round((visits / nextVisitGoal) * 100)),
    kind: 'ccu',
  };
}

export function findRivalGame(
  primary: GameRecordData,
  games: GameRecordData[]
): GameRecordData | null {
  const candidates = games.filter(
    (g) => g.active && g.universeId !== primary.universeId && g.currentCcu > 0
  );
  if (candidates.length === 0) return null;

  // Prefer same genre with closest CCU scale
  const sameGenre = candidates.filter(
    (g) =>
      g.genre &&
      primary.genre &&
      g.genre.toLowerCase() === primary.genre.toLowerCase()
  );
  const pool = sameGenre.length > 0 ? sameGenre : candidates;

  return [...pool].sort((a, b) => {
    const diffA = Math.abs(Math.log10(a.currentCcu + 10) - Math.log10(primary.currentCcu + 10));
    const diffB = Math.abs(Math.log10(b.currentCcu + 10) - Math.log10(primary.currentCcu + 10));
    return diffA - diffB;
  })[0];
}

export function detectSocialStories(
  games: GameRecordData[],
  codeGames: GameCodeDirectoryItem[]
): DetectedStory[] {
  const stories: DetectedStory[] = [];
  const topList = getTopLeaderboardGames(games, 10);

  if (topList.length > 0) {
    const leader = topList[0];
    const totalTop10 = topList.reduce((sum, g) => sum + g.currentCcu, 0);
    stories.push({
      id: 'story-leaderboard',
      template: 'leaderboard',
      kicker: 'Daily Leaderboard',
      title: `Top 10 Live CCU · #1 ${leader.name}`,
      metric: `${formatCompactNumber(totalTop10)} combined`,
      primaryUniverseId: leader.universeId,
    });
  }

  const surges = getTopSurgeGames(games, 3);
  if (surges.length > 0) {
    const topSurge = surges[0];
    const pct = topSurge.growth24h ?? topSurge.growth1h ?? null;
    stories.push({
      id: 'story-surge',
      template: 'surge',
      kicker: '24h Breakout Surge',
      title: topSurge.name,
      metric:
        pct !== null
          ? `${formatPercent(pct)} · ${formatCompactNumber(topSurge.currentCcu)} CCU`
          : `${formatCompactNumber(topSurge.currentCcu)} live CCU`,
      primaryUniverseId: topSurge.universeId,
    });
  }

  // Pick strongest milestone candidate (prefer near-peak or 100K+ CCU / 1B+ visits)
  const milestoneCandidate =
    topList.find(
      (g) =>
        g.currentCcu >= 10_000 &&
        g.peakCcuObserved > 0 &&
        g.currentCcu / g.peakCcuObserved >= 0.94
    ) ||
    topList.find((g) => g.totalVisits >= 1_000_000_000) ||
    topList[0];

  if (milestoneCandidate) {
    const ms = detectGameMilestone(milestoneCandidate);
    stories.push({
      id: 'story-milestone',
      template: 'milestone',
      kicker: ms.categoryLabel,
      title: milestoneCandidate.name,
      metric: `${ms.heroValue} ${ms.kind === 'visits' ? 'Visits' : 'CCU'}`,
      primaryUniverseId: milestoneCandidate.universeId,
    });
  }

  const bestCodeGame = [...codeGames]
    .filter((g) => g.activeCodeCount > 0)
    .sort((a, b) => b.currentCcu - a.currentCcu)[0];

  if (bestCodeGame) {
    stories.push({
      id: 'story-codes',
      template: 'codes',
      kicker: 'Active Code Drop',
      title: bestCodeGame.name,
      metric: `${bestCodeGame.activeCodeCount} verified active`,
      primaryUniverseId: bestCodeGame.universeId,
      codeGameSlug: bestCodeGame.slug,
    });
  }

  if (topList.length >= 2) {
    const gameA = topList[0];
    const gameB = findRivalGame(gameA, topList) || topList[1];
    stories.push({
      id: 'story-vs',
      template: 'vs',
      kicker: 'Head-to-Head Debate',
      title: `${gameA.name} vs ${gameB.name}`,
      metric: `${formatCompactNumber(gameA.currentCcu)} vs ${formatCompactNumber(gameB.currentCcu)}`,
      primaryUniverseId: gameA.universeId,
      secondaryUniverseId: gameB.universeId,
    });
  }

  return stories;
}

export interface CaptionGenerationInput {
  template: SocialTemplateId;
  tone: CaptionTone;
  includeLinkInMain: boolean;
  leaderboardGames: GameRecordData[];
  primaryGame: GameRecordData | null;
  secondaryGame: GameRecordData | null;
  milestone: MilestoneSummary | null;
  codeGame: GameCodeDirectoryItem | null;
  activeCodes: GameCodeRecord[];
  showRevenue: boolean;
}

export function generateSocialCaptions(
  input: CaptionGenerationInput
): GeneratedCaptions {
  const {
    template,
    tone,
    includeLinkInMain,
    leaderboardGames,
    primaryGame,
    secondaryGame,
    milestone,
    codeGame,
    activeCodes,
    showRevenue,
  } = input;

  let mainBody = '';
  let replyPrompt = '';
  let path = '/rankings';

  if (template === 'leaderboard') {
    path = '/rankings';
    const top3 = leaderboardGames.slice(0, 3);
    const lines = top3
      .map(
        (g, i) =>
          `${i + 1}. ${g.name} — ${formatCompactNumber(g.currentCcu)} CCU`
      )
      .join('\n');
    const totalTop = leaderboardGames.reduce((s, g) => s + g.currentCcu, 0);

    if (tone === 'news') {
      mainBody = `Top Roblox games by live player count right now:\n\n${lines}\n\nTop ${leaderboardGames.length} combined: ${formatCompactNumber(totalTop)} concurrent players.\n\n#Roblox #RobloxDev`;
    } else if (tone === 'analyst') {
      mainBody = `Live Roblox market snapshot (${formatSnapshotDate()}):\n\n${lines}\n\nThe top ${leaderboardGames.length} experiences currently hold ${formatCompactNumber(totalTop)} active players across Roblox.`;
    } else {
      mainBody = `Here are the top ${leaderboardGames.length} most-played Roblox games right now:\n\n${lines}\n\nWhich game deserves to be #1 this week?`;
    }
    replyPrompt = `Full live rankings, 24h deltas & historical charts on RoMetric:`;
  } else if (template === 'surge' && primaryGame) {
    path = `/games/${primaryGame.universeId}`;
    const pct = primaryGame.growth24h ?? primaryGame.growth1h ?? null;
    const pctStr = pct !== null ? formatPercent(pct) : 'surging';
    const netGain = computeNet24hGain(primaryGame);
    const rev = estimateGameRevenue(primaryGame);
    const revLine = showRevenue
      ? `\nEst. Monthly DevEx: ${formatCurrencyCompact(rev.monthlyUsd)}`
      : '';

    if (tone === 'news') {
      mainBody = `BREAKOUT ALERT: ${primaryGame.name} is surging ${pctStr} in the last 24h.\n\n• Live Players: ${formatExactNumber(primaryGame.currentCcu)}${netGain && netGain > 0 ? ` (+${formatCompactNumber(netGain)})` : ''}\n• Creator: ${primaryGame.creatorName}${revLine}\n\n#Roblox`;
    } else if (tone === 'analyst') {
      mainBody = `Velocity check on ${primaryGame.name} by ${primaryGame.creatorName}:\n\n• 24h Momentum: ${pctStr}\n• Live CCU: ${formatExactNumber(primaryGame.currentCcu)}\n• Observed Peak: ${formatExactNumber(Math.max(primaryGame.currentCcu, primaryGame.peakCcuObserved || 0))}${revLine}`;
    } else {
      mainBody = `${primaryGame.name} just jumped ${pctStr} to ${formatCompactNumber(primaryGame.currentCcu)} live players.\n\nReal breakout hit or weekend update spike?`;
    }
    replyPrompt = `Track ${primaryGame.name}'s live chart, peak CCU & revenue estimate:`;
  } else if (template === 'milestone' && primaryGame && milestone) {
    path = `/games/${primaryGame.universeId}`;
    if (tone === 'news') {
      mainBody = `MILESTONE: ${milestone.headline}.\n\n• ${milestone.heroUnit}: ${milestone.heroValue}\n• Lifetime Visits: ${formatCompactNumber(primaryGame.totalVisits)}\n• Creator: ${primaryGame.creatorName}\n\n#Roblox #RobloxDev`;
    } else if (tone === 'analyst') {
      mainBody = `${primaryGame.name} milestone snapshot:\n\n• ${milestone.categoryLabel}: ${milestone.heroValue}\n• Live CCU: ${formatExactNumber(primaryGame.currentCcu)}\n• Total Visits: ${formatCompactNumber(primaryGame.totalVisits)}\n• Rating: ${primaryGame.likeRatio !== null && primaryGame.likeRatio !== undefined ? `${primaryGame.likeRatio.toFixed(1)}%` : 'N/A'}`;
    } else {
      mainBody = `${milestone.headline} (${milestone.heroValue}).\n\nCongrats to ${primaryGame.creatorName} — how much higher can this go?`;
    }
    replyPrompt = `Live analytics & historical milestones for ${primaryGame.name}:`;
  } else if (template === 'codes' && codeGame) {
    path = `/codes/${codeGame.slug}`;
    const previewCodes = activeCodes
      .slice(0, 3)
      .map((c) => `• ${c.code}${c.rewardDescription ? ` — ${c.rewardDescription.slice(0, 38)}` : ''}`)
      .join('\n');
    const moreCount = Math.max(0, activeCodes.length - 3);

    if (tone === 'news') {
      mainBody = `${activeCodes.length} verified active ${codeGame.name} codes working right now:\n\n${previewCodes || '• Check full verified code list in the graphic'}${moreCount > 0 ? `\n+ ${moreCount} more active codes` : ''}\n\n#Roblox #RobloxCodes`;
    } else if (tone === 'analyst') {
      mainBody = `Updated ${codeGame.name} code tracker (${formatSnapshotDate()}):\n\n• Active Verified Codes: ${activeCodes.length}\n• Live Players: ${formatCompactNumber(codeGame.currentCcu)}\n\nFull copy-ready code sheet below.`;
    } else {
      mainBody = `Still playing ${codeGame.name}? Don't miss these ${activeCodes.length} working codes:\n\n${previewCodes || '• See all active codes in the graphic'}\n\nBookmark this so you don't lose them.`;
    }
    replyPrompt = `Copy every active ${codeGame.name} code with one click on RoMetric:`;
  } else if (template === 'vs' && primaryGame && secondaryGame) {
    path = `/compare?games=${primaryGame.universeId},${secondaryGame.universeId}`;
    const leader =
      primaryGame.currentCcu >= secondaryGame.currentCcu
        ? primaryGame
        : secondaryGame;
    const gap = Math.abs(primaryGame.currentCcu - secondaryGame.currentCcu);

    if (tone === 'news') {
      mainBody = `HEAD-TO-HEAD: ${primaryGame.name} vs ${secondaryGame.name}\n\n• ${primaryGame.name}: ${formatCompactNumber(primaryGame.currentCcu)} CCU\n• ${secondaryGame.name}: ${formatCompactNumber(secondaryGame.currentCcu)} CCU\n\n${leader.name} leads live by ${formatCompactNumber(gap)} players.\n\n#Roblox`;
    } else if (tone === 'analyst') {
      mainBody = `Side-by-side comparison — ${primaryGame.name} vs ${secondaryGame.name}:\n\n• Live CCU: ${formatCompactNumber(primaryGame.currentCcu)} vs ${formatCompactNumber(secondaryGame.currentCcu)}\n• Lifetime Visits: ${formatCompactNumber(primaryGame.totalVisits)} vs ${formatCompactNumber(secondaryGame.totalVisits)}\n\nFull metric breakdown in the chart.`;
    } else {
      mainBody = `${primaryGame.name} (${formatCompactNumber(primaryGame.currentCcu)} live) vs ${secondaryGame.name} (${formatCompactNumber(secondaryGame.currentCcu)} live).\n\nIf you can only keep one on Roblox, which are you picking?`;
    }
    replyPrompt = `Compare both games live (charts, peaks & est. revenue) on RoMetric:`;
  } else {
    mainBody = `Live Roblox analytics, player counts, and verified game codes — tracked continuously on RoMetric.`;
    replyPrompt = `Explore live Roblox charts on RoMetric:`;
  }

  const utmUrl = buildUtmUrl(path, template);
  const mainPost = includeLinkInMain ? `${mainBody}\n\n${utmUrl}` : mainBody;
  const replyPost = `${replyPrompt}\n${utmUrl}`;
  const xIntentUrl = `https://x.com/intent/tweet?text=${encodeURIComponent(mainPost)}`;

  return {
    mainPost,
    replyPost,
    utmUrl,
    xIntentUrl,
  };
}

function isRobloxCdnUrl(src: string): boolean {
  try {
    const u = new URL(src, window.location.href);
    return (
      u.protocol === 'https:' &&
      u.hostname.toLowerCase().endsWith('.rbxcdn.com')
    );
  } catch {
    return false;
  }
}

export function getProxiedArtworkUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('/')) return url;
  if (url.includes('.rbxcdn.com')) {
    return `/api/roblox/image-proxy?url=${encodeURIComponent(url)}`;
  }
  return url;
}

async function waitForImages(
  container: HTMLElement,
  timeoutMs = 3500
): Promise<void> {
  const imgs = Array.from(container.querySelectorAll('img'));
  if (imgs.length === 0) return;

  await Promise.race([
    Promise.all(
      imgs.map(
        (img) =>
          new Promise<void>((resolve) => {
            if (img.complete && img.naturalWidth > 0) {
              resolve();
              return;
            }
            const done = () => resolve();
            img.addEventListener('load', done, { once: true });
            img.addEventListener('error', done, { once: true });
          })
      )
    ),
    new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
  ]);
}

/**
 * Exports a fixed-pixel Social Studio canvas (1200x675 or 1080x1080) as a crisp 2x Retina PNG
 * without preview scale distortion or Roblox CDN CORS tainting.
 */
export async function exportSocialCanvasToPng(
  sourceEl: HTMLElement,
  options: {
    width: number;
    height: number;
    filenameBase: string;
  }
): Promise<{ dataUrl: string; blob: Blob; filename: string }> {
  const host = document.createElement('div');
  host.style.position = 'fixed';
  host.style.left = '-12000px';
  host.style.top = '0';
  host.style.width = `${options.width}px`;
  host.style.height = `${options.height}px`;
  host.style.zIndex = '-1';
  host.style.pointerEvents = 'none';
  host.style.background = '#ffffff';

  const cloned = sourceEl.cloneNode(true) as HTMLElement;
  cloned.style.width = `${options.width}px`;
  cloned.style.height = `${options.height}px`;
  cloned.style.transform = 'none';
  cloned.style.margin = '0';
  cloned.style.boxShadow = 'none';

  // Ensure every external Roblox thumbnail routes through our same-origin proxy
  cloned.querySelectorAll('img').forEach((img) => {
    const src = img.getAttribute('src') || img.src || '';
    if (isRobloxCdnUrl(src)) {
      img.setAttribute('crossorigin', 'anonymous');
      img.setAttribute('src', `/api/roblox/image-proxy?url=${encodeURIComponent(src)}`);
      img.removeAttribute('srcset');
    }
  });

  host.appendChild(cloned);
  document.body.appendChild(host);

  try {
    await waitForImages(cloned);
    let dataUrl: string;
    try {
      dataUrl = await toPng(cloned, {
        width: options.width,
        height: options.height,
        pixelRatio: 2,
        backgroundColor: '#ffffff',
        cacheBust: false,
      });
    } catch {
      dataUrl = await toPng(cloned, {
        width: options.width,
        height: options.height,
        pixelRatio: 2,
        backgroundColor: '#ffffff',
        cacheBust: false,
        skipFonts: true,
      });
    }

    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const safeName = options.filenameBase
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 56);
    const filename = `rometric-${safeName || 'social-card'}-${getTodayUtcKey()}.png`;

    return { dataUrl, blob, filename };
  } finally {
    host.remove();
  }
}
