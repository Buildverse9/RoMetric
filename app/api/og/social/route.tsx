import React from 'react';
import { ImageResponse } from 'next/og';
import type { NextRequest } from 'next/server';
import {
  fetchSupabaseGameById,
  fetchSupabaseGamesList,
} from '@/lib/supabase-server';
import { fetchGameCodesBySlugOrId } from '@/lib/codes-server';
import {
  formatCompactNumber,
  formatExactNumber,
  formatPercent,
} from '@/lib/format';
import { estimateGameRevenue, formatCurrencyCompact } from '@/lib/revenue';
import {
  computeGameRevenueSurge,
  computeNet24hGain,
  detectGameMilestone,
  findRivalGame,
  formatSnapshotDate,
  getTopEarningGames,
  getTopLeaderboardGames,
  getTopRevenueSurgeGames,
  getTopSurgeGames,
  type SocialTemplateId,
} from '@/lib/social-studio-shared';
import type { GameRecordData } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VALID_TEMPLATES: SocialTemplateId[] = [
  'leaderboard',
  'top_earning',
  'revenue_surge',
  'surge',
  'milestone',
  'codes',
  'vs',
];

function parseTemplate(raw: string | null): SocialTemplateId {
  if (raw && VALID_TEMPLATES.includes(raw as SocialTemplateId)) {
    return raw as SocialTemplateId;
  }
  return 'leaderboard';
}

async function fetchImageDataUri(
  url: string | null | undefined,
  timeoutMs = 1600
): Promise<string | null> {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (
      parsed.protocol !== 'https:' ||
      !parsed.hostname.toLowerCase().endsWith('.rbxcdn.com')
    ) {
      return null;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(parsed.toString(), {
      signal: controller.signal,
      headers: { Accept: 'image/png,image/jpeg,image/webp,*/*' },
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const contentType = (res.headers.get('content-type') || 'image/png')
      .split(';')[0]
      .trim()
      .toLowerCase();
    if (
      contentType !== 'image/png' &&
      contentType !== 'image/jpeg' &&
      contentType !== 'image/jpg' &&
      contentType !== 'image/gif'
    ) {
      return null;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length === 0 || buf.length > 1_200_000) return null;
    return `data:${contentType};base64,${buf.toString('base64')}`;
  } catch {
    return null;
  }
}

function getInitials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() || '')
      .join('') || 'R'
  );
}

function OgThumb({
  dataUri,
  name,
  size,
  radius = 12,
}: {
  dataUri: string | null;
  name: string;
  size: number;
  radius?: number;
}) {
  if (dataUri) {
    return (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img
        src={dataUri}
        alt={name}
        width={size}
        height={size}
        style={{
          width: size,
          height: size,
          borderRadius: radius,
          border: '1px solid #E2E8F0',
          objectFit: 'cover',
          backgroundColor: '#F8FAFC',
          flexShrink: 0,
        }}
      />
    );
  }
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        borderRadius: radius,
        backgroundColor: '#F1F5F9',
        border: '1px solid #E2E8F0',
        color: '#334155',
        fontSize: Math.max(13, Math.round(size * 0.34)),
        fontWeight: 800,
        flexShrink: 0,
      }}
    >
      {getInitials(name)}
    </div>
  );
}

function OgHeader({ kicker }: { kicker: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingBottom: 16,
        borderBottom: '1px solid #E2E8F0',
        width: '100%',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 32,
            height: 32,
            borderRadius: 8,
            backgroundColor: '#091318',
            color: '#10E89A',
            fontSize: 16,
            fontWeight: 900,
          }}
        >
          R
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span
            style={{
              fontSize: 22,
              fontWeight: 800,
              color: '#0F172A',
              letterSpacing: '-0.02em',
            }}
          >
            RoMetric
          </span>
          <span style={{ fontSize: 16, color: '#CBD5E1' }}>·</span>
          <span style={{ fontSize: 15, fontWeight: 600, color: '#475569' }}>
            {kicker}
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#64748B', fontWeight: 500 }}>
        <span>Live Snapshot</span>
        <span>·</span>
        <span>{formatSnapshotDate()}</span>
      </div>
    </div>
  );
}

function OgFooter({ left, right }: { left: string; right: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 14,
        borderTop: '1px solid #E2E8F0',
        width: '100%',
      }}
    >
      <span style={{ fontSize: 14, color: '#64748B', fontWeight: 500 }}>
        {left}
      </span>
      <span style={{ fontSize: 14, color: '#0F172A', fontWeight: 700 }}>
        {right}
      </span>
    </div>
  );
}

function truncateText(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen - 1)}…`;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const template = parseTemplate(searchParams.get('t'));
  const rawCount = Number(searchParams.get('count'));
  const count: 5 | 10 = rawCount === 5 ? 5 : 10;
  const primaryId = (searchParams.get('g') || searchParams.get('a') || '').replace(/[^0-9]/g, '');
  const secondaryId = (searchParams.get('b') || '').replace(/[^0-9]/g, '');
  const codeSlug = (searchParams.get('slug') || '').trim();
  const customHeadline = (searchParams.get('h') || '').trim().slice(0, 90);
  const showRevenue = searchParams.get('rev') !== '0';

  let games: GameRecordData[] = [];
  try {
    games = await fetchSupabaseGamesList();
  } catch {
    games = [];
  }

  let primaryGame: GameRecordData | null = null;
  if (primaryId) {
    primaryGame =
      games.find((g) => g.universeId === primaryId) ||
      (await fetchSupabaseGameById(primaryId).catch(() => null));
  }

  // 1. LEADERBOARD or TOP EARNING (ranked white data table)
  if (template === 'leaderboard' || template === 'top_earning') {
    const isEarning = template === 'top_earning';
    const ranked = isEarning
      ? getTopEarningGames(games, count)
      : getTopLeaderboardGames(games, count);
    const displayRows = ranked.slice(0, count === 5 ? 5 : 8); // 8 crisp rows fit 1200x630 cleanly without cramping
    const maxVal = isEarning
      ? Math.max(1, displayRows[0] ? estimateGameRevenue(displayRows[0]).monthlyUsd : 1)
      : Math.max(1, displayRows[0]?.currentCcu || 1);
    const totalStat = isEarning
      ? formatCurrencyCompact(
          ranked.reduce((s, g) => s + estimateGameRevenue(g).monthlyUsd, 0)
        ) + '/mo'
      : formatCompactNumber(ranked.reduce((s, g) => s + g.currentCcu, 0)) + ' CCU';

    const thumbs = await Promise.all(
      displayRows.map((g) => fetchImageDataUri(g.iconUrl || g.thumbnailUrl, 1200))
    );

    const headline =
      customHeadline ||
      (isEarning
        ? `Top ${ranked.length} Earning Roblox Games (Est. Monthly)`
        : `Top ${ranked.length} Roblox Games by Live Players`);

    return new ImageResponse(
      (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            width: 1200,
            height: 630,
            backgroundColor: '#FFFFFF',
            color: '#0F172A',
            padding: '32px 46px',
            fontFamily: 'sans-serif',
          }}
        >
          <OgHeader
            kicker={isEarning ? 'Top Earning Leaderboard' : 'Live CCU Leaderboard'}
          />

          <div
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'space-between',
              paddingTop: 14,
              paddingBottom: 10,
            }}
          >
            <span
              style={{
                fontSize: 30,
                fontWeight: 800,
                color: '#0F172A',
                letterSpacing: '-0.03em',
              }}
            >
              {truncateText(headline, 54)}
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
              <span style={{ fontSize: 12, color: '#64748B', fontWeight: 600 }}>
                Combined Top {ranked.length}
              </span>
              <span style={{ fontSize: 22, fontWeight: 800, color: '#0F172A' }}>
                {totalStat}
              </span>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: displayRows.length > 5 ? 6 : 12,
              flex: 1,
              justifyContent: 'center',
            }}
          >
            {displayRows.map((g, idx) => {
              const rev = estimateGameRevenue(g);
              const val = isEarning ? rev.monthlyUsd : g.currentCcu;
              const pctW = Math.max(5, Math.round((val / maxVal) * 100));
              const growth = g.growth24h ?? g.growth1h ?? null;
              const rightSecondary = isEarning
                ? `${formatCurrencyCompact(rev.dailyUsd)}/d`
                : growth !== null
                  ? `${growth > 0 ? '▲ ' : growth < 0 ? '▼ ' : ''}${formatPercent(growth)}`
                  : '—';
              const rightColor = isEarning
                ? '#475569'
                : growth !== null && growth > 0.05
                  ? '#16A34A'
                  : growth !== null && growth < -0.05
                    ? '#DC2626'
                    : '#64748B';

              return (
                <div
                  key={g.universeId}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    padding: displayRows.length > 5 ? '6px 12px' : '11px 14px',
                    borderRadius: 10,
                    backgroundColor: idx % 2 === 0 ? '#F8FAFC' : '#FFFFFF',
                    border: '1px solid #F1F5F9',
                  }}
                >
                  <span
                    style={{
                      width: 28,
                      fontSize: 15,
                      fontWeight: 800,
                      color: idx < 3 ? '#0F172A' : '#64748B',
                    }}
                  >
                    {String(idx + 1).padStart(2, '0')}
                  </span>

                  <OgThumb
                    dataUri={thumbs[idx]}
                    name={g.name}
                    size={displayRows.length > 5 ? 30 : 42}
                    radius={8}
                  />

                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      width: 290,
                    }}
                  >
                    <span
                      style={{
                        fontSize: displayRows.length > 5 ? 15 : 17,
                        fontWeight: 700,
                        color: '#0F172A',
                      }}
                    >
                      {truncateText(g.name, 28)}
                    </span>
                    {displayRows.length <= 5 && (
                      <span style={{ fontSize: 12, color: '#64748B' }}>
                        {truncateText(g.creatorName, 30)}
                      </span>
                    )}
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      flex: 1,
                      height: 10,
                      borderRadius: 999,
                      backgroundColor: '#E2E8F0',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        width: `${pctW}%`,
                        height: 10,
                        borderRadius: 999,
                        backgroundColor: idx === 0 ? '#16A34A' : '#0F172A',
                      }}
                    />
                  </div>

                  <span
                    style={{
                      width: 122,
                      textAlign: 'right',
                      fontSize: 16,
                      fontWeight: 800,
                      color: '#0F172A',
                    }}
                  >
                    {isEarning
                      ? `${formatCurrencyCompact(rev.monthlyUsd)}/mo`
                      : formatExactNumber(g.currentCcu)}
                  </span>

                  <span
                    style={{
                      width: 92,
                      textAlign: 'right',
                      fontSize: 14,
                      fontWeight: 700,
                      color: rightColor,
                    }}
                  >
                    {rightSecondary}
                  </span>
                </div>
              );
            })}
          </div>

          <OgFooter
            left={
              isEarning
                ? 'Estimated DevEx monthly revenue from live CCU, genre & rating telemetry'
                : 'Tap to inspect live Roblox rankings, charts & revenue estimates'
            }
            right="rometrics.vercel.app/rankings"
          />
        </div>
      ),
      {
        width: 1200,
        height: 630,
        headers: {
          'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300',
        },
      }
    );
  }

  // 2. REVENUE SURGE ("Revenue Jump")
  if (template === 'revenue_surge') {
    const game = primaryGame || getTopRevenueSurgeGames(games, 1)[0] || games[0];
    if (game) {
      const revSurge = computeGameRevenueSurge(game);
      const thumb = await fetchImageDataUri(game.iconUrl || game.thumbnailUrl);
      const isGain = revSurge.deltaMonthlyUsd > 0;
      const headline =
        customHeadline ||
        (isGain
          ? `${game.name} est. monthly revenue jumps ${formatCurrencyCompact(revSurge.deltaMonthlyUsd)}`
          : `${game.name} — Estimated Roblox DevEx Revenue`);
      const maxBar = Math.max(
        1,
        revSurge.currentMonthlyUsd,
        revSurge.previousMonthlyUsd
      );
      const prevW = Math.max(
        10,
        Math.round((revSurge.previousMonthlyUsd / maxBar) * 100)
      );
      const currW = Math.max(
        10,
        Math.round((revSurge.currentMonthlyUsd / maxBar) * 100)
      );

      return new ImageResponse(
        (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              width: 1200,
              height: 630,
              backgroundColor: '#FFFFFF',
              color: '#0F172A',
              padding: '34px 48px',
              fontFamily: 'sans-serif',
            }}
          >
            <OgHeader kicker="24h Revenue Jump Alert" />

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 24,
                flex: 1,
                justifyContent: 'center',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 28,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 20, flex: 1 }}>
                  <OgThumb dataUri={thumb} name={game.name} size={110} radius={18} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: '#16A34A' }}>
                      Est. DevEx Revenue Telemetry · {game.genre || 'Experience'}
                    </span>
                    <span
                      style={{
                        fontSize: 32,
                        fontWeight: 800,
                        color: '#0F172A',
                        lineHeight: 1.15,
                        letterSpacing: '-0.03em',
                      }}
                    >
                      {truncateText(headline, 62)}
                    </span>
                    <span style={{ fontSize: 15, color: '#475569', fontWeight: 500 }}>
                      Developed by {game.creatorName}
                    </span>
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-end',
                    backgroundColor: '#F0FDF4',
                    border: '1px solid #BBF7D0',
                    borderRadius: 18,
                    padding: '18px 26px',
                    minWidth: 260,
                  }}
                >
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#15803D' }}>
                    {isGain ? '24h Monthly Run-Rate Gain' : 'Est. Monthly DevEx'}
                  </span>
                  <span
                    style={{
                      fontSize: 44,
                      fontWeight: 900,
                      color: '#16A34A',
                      marginTop: 4,
                    }}
                  >
                    {isGain
                      ? `+${formatCurrencyCompact(revSurge.deltaMonthlyUsd)}`
                      : formatCurrencyCompact(revSurge.currentMonthlyUsd)}
                  </span>
                  <span style={{ fontSize: 15, fontWeight: 700, color: '#166534', marginTop: 4 }}>
                    {isGain
                      ? `${formatPercent(revSurge.revenueGrowthPct)} in 24h`
                      : `${formatCurrencyCompact(revSurge.currentDailyUsd)}/day est.`}
                  </span>
                </div>
              </div>

              {/* Before vs After Bar */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                  backgroundColor: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  borderRadius: 14,
                  padding: '16px 22px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <span style={{ width: 130, fontSize: 13, fontWeight: 600, color: '#64748B' }}>
                    24h Baseline Est.
                  </span>
                  <div style={{ display: 'flex', flex: 1, height: 12, backgroundColor: '#E2E8F0', borderRadius: 999 }}>
                    <div style={{ width: `${prevW}%`, height: 12, backgroundColor: '#94A3B8', borderRadius: 999 }} />
                  </div>
                  <span style={{ width: 110, textAlign: 'right', fontSize: 15, fontWeight: 700, color: '#475569' }}>
                    {formatCurrencyCompact(revSurge.previousMonthlyUsd)}/mo
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <span style={{ width: 130, fontSize: 13, fontWeight: 700, color: '#0F172A' }}>
                    Current Pace
                  </span>
                  <div style={{ display: 'flex', flex: 1, height: 12, backgroundColor: '#E2E8F0', borderRadius: 999 }}>
                    <div style={{ width: `${currW}%`, height: 12, backgroundColor: '#16A34A', borderRadius: 999 }} />
                  </div>
                  <span style={{ width: 110, textAlign: 'right', fontSize: 15, fontWeight: 800, color: '#0F172A' }}>
                    {formatCurrencyCompact(revSurge.currentMonthlyUsd)}/mo
                  </span>
                </div>
              </div>

              {/* 4-column KPI strip */}
              <div style={{ display: 'flex', gap: 14 }}>
                {[
                  {
                    label: 'Est. Monthly USD',
                    value: formatCurrencyCompact(revSurge.currentMonthlyUsd),
                  },
                  {
                    label: 'Est. Daily USD',
                    value: `${formatCurrencyCompact(revSurge.currentDailyUsd)}/d`,
                  },
                  {
                    label: 'Est. Monthly Robux',
                    value: `${formatCompactNumber(revSurge.currentMonthlyRobux)} R$`,
                  },
                  {
                    label: 'Live Players (CCU)',
                    value: formatCompactNumber(game.currentCcu),
                  },
                ].map((kpi) => (
                  <div
                    key={kpi.label}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      flex: 1,
                      border: '1px solid #E2E8F0',
                      borderRadius: 12,
                      padding: '14px 18px',
                    }}
                  >
                    <span style={{ fontSize: 13, color: '#64748B', fontWeight: 600 }}>
                      {kpi.label}
                    </span>
                    <span style={{ fontSize: 25, fontWeight: 800, color: '#0F172A', marginTop: 4 }}>
                      {kpi.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <OgFooter
              left="Tap to view full live charts & revenue breakdown on RoMetric"
              right={`rometrics.vercel.app/games/${game.universeId}`}
            />
          </div>
        ),
        {
          width: 1200,
          height: 630,
          headers: {
            'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300',
          },
        }
      );
    }
  }

  // 3. BREAKOUT 24H SURGE
  if (template === 'surge') {
    const game = primaryGame || getTopSurgeGames(games, 1)[0] || games[0];
    if (game) {
      const thumb = await fetchImageDataUri(game.iconUrl || game.thumbnailUrl);
      const pct = game.growth24h ?? game.growth1h ?? null;
      const netGain = computeNet24hGain(game);
      const peak = Math.max(game.currentCcu, game.peakCcuObserved || 0);
      const rev = estimateGameRevenue(game);
      const headline =
        customHeadline || `${game.name} surges in 24-hour player activity`;

      return new ImageResponse(
        (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              width: 1200,
              height: 630,
              backgroundColor: '#FFFFFF',
              color: '#0F172A',
              padding: '34px 48px',
              fontFamily: 'sans-serif',
            }}
          >
            <OgHeader kicker="24h Breakout Surge Alert" />

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 28,
                flex: 1,
                justifyContent: 'center',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 28,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 22, flex: 1 }}>
                  <OgThumb dataUri={thumb} name={game.name} size={118} radius={18} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: '#16A34A' }}>
                      Breakout Momentum · {game.genre || 'Roblox Experience'}
                    </span>
                    <span
                      style={{
                        fontSize: 34,
                        fontWeight: 800,
                        color: '#0F172A',
                        lineHeight: 1.12,
                      }}
                    >
                      {truncateText(headline, 58)}
                    </span>
                    <span style={{ fontSize: 16, color: '#475569' }}>
                      Developed by {game.creatorName}
                    </span>
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-end',
                    backgroundColor: '#F0FDF4',
                    border: '1px solid #BBF7D0',
                    borderRadius: 18,
                    padding: '20px 28px',
                    minWidth: 240,
                  }}
                >
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#15803D' }}>
                    24h Player Surge
                  </span>
                  <span style={{ fontSize: 50, fontWeight: 900, color: '#16A34A', marginTop: 4 }}>
                    {pct !== null ? formatPercent(pct) : 'Rising'}
                  </span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#166534', marginTop: 4 }}>
                    {netGain && netGain > 0
                      ? `+${formatCompactNumber(netGain)} players added`
                      : `${formatCompactNumber(game.currentCcu)} live now`}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 14 }}>
                {[
                  { label: 'Live Players (CCU)', value: formatExactNumber(game.currentCcu) },
                  { label: 'Observed Peak', value: formatCompactNumber(peak) },
                  { label: 'Lifetime Visits', value: formatCompactNumber(game.totalVisits) },
                  {
                    label: showRevenue ? 'Est. Monthly DevEx' : 'Player Rating',
                    value: showRevenue
                      ? formatCurrencyCompact(rev.monthlyUsd)
                      : game.likeRatio !== null && game.likeRatio !== undefined
                        ? `${game.likeRatio.toFixed(1)}%`
                        : 'N/A',
                  },
                ].map((kpi) => (
                  <div
                    key={kpi.label}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      flex: 1,
                      backgroundColor: '#F8FAFC',
                      border: '1px solid #E2E8F0',
                      borderRadius: 12,
                      padding: '16px 18px',
                    }}
                  >
                    <span style={{ fontSize: 13, color: '#64748B', fontWeight: 600 }}>
                      {kpi.label}
                    </span>
                    <span style={{ fontSize: 26, fontWeight: 800, color: '#0F172A', marginTop: 6 }}>
                      {kpi.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <OgFooter
              left="Tap to open live player history & benchmarks on RoMetric"
              right={`rometrics.vercel.app/games/${game.universeId}`}
            />
          </div>
        ),
        {
          width: 1200,
          height: 630,
          headers: {
            'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300',
          },
        }
      );
    }
  }

  // 4. MILESTONE ALERT
  if (template === 'milestone') {
    const game = primaryGame || getTopLeaderboardGames(games, 5)[0] || games[0];
    if (game) {
      const ms = detectGameMilestone(game);
      const thumb = await fetchImageDataUri(game.iconUrl || game.thumbnailUrl);
      const rev = estimateGameRevenue(game);
      const peak = Math.max(game.currentCcu, game.peakCcuObserved || 0);
      const headline = customHeadline || ms.headline;

      return new ImageResponse(
        (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              width: 1200,
              height: 630,
              backgroundColor: '#FFFFFF',
              color: '#0F172A',
              padding: '34px 48px',
              fontFamily: 'sans-serif',
            }}
          >
            <OgHeader kicker={ms.categoryLabel} />

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 22,
                flex: 1,
                justifyContent: 'center',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
                <OgThumb dataUri={thumb} name={game.name} size={110} radius={18} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: '#D97706' }}>
                    Milestone Reached · {game.creatorName}
                  </span>
                  <span style={{ fontSize: 33, fontWeight: 800, color: '#0F172A', lineHeight: 1.12 }}>
                    {truncateText(headline, 62)}
                  </span>
                  <span style={{ fontSize: 15, color: '#475569' }}>{ms.subDetail}</span>
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 14,
                  backgroundColor: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  borderRadius: 16,
                  padding: '20px 26px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
                    <span style={{ fontSize: 60, fontWeight: 900, color: '#0F172A', lineHeight: 1 }}>
                      {ms.heroValue}
                    </span>
                    <span style={{ fontSize: 20, fontWeight: 600, color: '#475569' }}>
                      {ms.heroUnit}
                    </span>
                  </div>
                  <span style={{ fontSize: 18, fontWeight: 800, color: '#D97706' }}>
                    {ms.progressPct}%
                  </span>
                </div>

                <div style={{ display: 'flex', width: '100%', height: 12, backgroundColor: '#E2E8F0', borderRadius: 999 }}>
                  <div
                    style={{
                      width: `${Math.max(8, ms.progressPct)}%`,
                      height: 12,
                      backgroundColor: '#D97706',
                      borderRadius: 999,
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 14 }}>
                {[
                  { label: 'Live CCU', value: formatExactNumber(game.currentCcu) },
                  { label: 'Observed Peak', value: formatExactNumber(peak) },
                  {
                    label: showRevenue ? 'Est. Monthly DevEx' : 'Player Rating',
                    value: showRevenue
                      ? formatCurrencyCompact(rev.monthlyUsd)
                      : game.likeRatio !== null && game.likeRatio !== undefined
                        ? `${game.likeRatio.toFixed(1)}%`
                        : 'N/A',
                  },
                ].map((m) => (
                  <div
                    key={m.label}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      flex: 1,
                      border: '1px solid #E2E8F0',
                      borderRadius: 12,
                      padding: '14px 18px',
                    }}
                  >
                    <span style={{ fontSize: 13, color: '#64748B', fontWeight: 600 }}>{m.label}</span>
                    <span style={{ fontSize: 24, fontWeight: 800, color: '#0F172A', marginTop: 4 }}>{m.value}</span>
                  </div>
                ))}
              </div>
            </div>

            <OgFooter
              left="Tap to inspect full historical milestones on RoMetric"
              right={`rometrics.vercel.app/games/${game.universeId}`}
            />
          </div>
        ),
        {
          width: 1200,
          height: 630,
          headers: {
            'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300',
          },
        }
      );
    }
  }

  // 5. ACTIVE GAME CODE DROP
  if (template === 'codes') {
    const detail = codeSlug
      ? await fetchGameCodesBySlugOrId(codeSlug).catch(() => null)
      : null;
    const g = detail?.game || primaryGame;
    const activeCodes = (detail?.codes || [])
      .filter((c) => c.status === 'active')
      .slice(0, 6);
    const thumb = await fetchImageDataUri(g?.iconUrl || g?.thumbnailUrl);
    const gameName = g?.name || 'Roblox Game';
    const slug = g?.slug || codeSlug || '';
    const headline = customHeadline || `${gameName} — Working Active Codes`;

    return new ImageResponse(
      (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            width: 1200,
            height: 630,
            backgroundColor: '#FFFFFF',
            color: '#0F172A',
            padding: '34px 48px',
            fontFamily: 'sans-serif',
          }}
        >
          <OgHeader kicker="Verified Active Codes" />

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 20,
              flex: 1,
              justifyContent: 'center',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 18, flex: 1 }}>
                <OgThumb dataUri={thumb} name={gameName} size={78} radius={14} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: '#16A34A' }}>
                    {activeCodes.length} Verified Active{' '}
                    {activeCodes.length === 1 ? 'Code' : 'Codes'}
                  </span>
                  <span style={{ fontSize: 30, fontWeight: 800, color: '#0F172A' }}>
                    {truncateText(headline, 48)}
                  </span>
                  <span style={{ fontSize: 14, color: '#64748B' }}>
                    {g?.creatorName || 'Roblox'} · {formatCompactNumber(g?.currentCcu ?? 0)} live players
                  </span>
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-end',
                  backgroundColor: '#F0FDF4',
                  border: '1px solid #BBF7D0',
                  borderRadius: 12,
                  padding: '12px 20px',
                }}
              >
                <span style={{ fontSize: 12, fontWeight: 600, color: '#15803D' }}>
                  Tap Card to Copy
                </span>
                <span style={{ fontSize: 18, fontWeight: 800, color: '#16A34A' }}>
                  1-Click Redeem
                </span>
              </div>
            </div>

            {activeCodes.length === 0 ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  borderRadius: 16,
                  padding: 40,
                  fontSize: 18,
                  color: '#475569',
                }}
              >
                Tap to view the latest checked promo codes for {gameName} on RoMetric
              </div>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                {activeCodes.map((c) => (
                  <div
                    key={c.id}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      width: 544,
                      backgroundColor: '#F8FAFC',
                      border: '1px solid #E2E8F0',
                      borderRadius: 12,
                      padding: '14px 18px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 21, fontWeight: 900, color: '#0F172A' }}>
                        {truncateText(c.code, 26)}
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#16A34A' }}>
                        Active
                      </span>
                    </div>
                    <span style={{ fontSize: 14, color: '#475569', marginTop: 4 }}>
                      {truncateText(c.rewardDescription || 'In-game rewards & boosts', 52)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <OgFooter
            left="Tap anywhere on this card to copy active codes on RoMetric"
            right={slug ? `rometrics.vercel.app/codes/${slug}` : 'rometrics.vercel.app/codes'}
          />
        </div>
      ),
      {
        width: 1200,
        height: 630,
        headers: {
          'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300',
        },
      }
    );
  }

  // 6. HEAD-TO-HEAD VS COMPARISON
  const sorted = getTopLeaderboardGames(games, 10);
  const gameA = primaryGame || sorted[0] || null;
  const gameB =
    (secondaryId
      ? games.find((g) => g.universeId === secondaryId) ||
        (await fetchSupabaseGameById(secondaryId).catch(() => null))
      : null) ||
    (gameA ? findRivalGame(gameA, games) : null) ||
    sorted[1] ||
    null;

  if (gameA && gameB) {
    const [thumbA, thumbB] = await Promise.all([
      fetchImageDataUri(gameA.iconUrl || gameA.thumbnailUrl, 1300),
      fetchImageDataUri(gameB.iconUrl || gameB.thumbnailUrl, 1300),
    ]);
    const revA = estimateGameRevenue(gameA);
    const revB = estimateGameRevenue(gameB);
    const peakA = Math.max(gameA.currentCcu, gameA.peakCcuObserved || 0);
    const peakB = Math.max(gameB.currentCcu, gameB.peakCcuObserved || 0);
    const headline = customHeadline || `${gameA.name} vs ${gameB.name}`;

    const metricRows = [
      {
        label: 'Live Players',
        aText: formatExactNumber(gameA.currentCcu),
        bText: formatExactNumber(gameB.currentCcu),
        aNum: gameA.currentCcu,
        bNum: gameB.currentCcu,
      },
      {
        label: 'Observed Peak',
        aText: formatCompactNumber(peakA),
        bText: formatCompactNumber(peakB),
        aNum: peakA,
        bNum: peakB,
      },
      {
        label: 'Lifetime Visits',
        aText: formatCompactNumber(gameA.totalVisits),
        bText: formatCompactNumber(gameB.totalVisits),
        aNum: gameA.totalVisits,
        bNum: gameB.totalVisits,
      },
      {
        label: showRevenue ? 'Est. Monthly DevEx' : 'Player Rating',
        aText: showRevenue
          ? formatCurrencyCompact(revA.monthlyUsd)
          : gameA.likeRatio !== null && gameA.likeRatio !== undefined
            ? `${gameA.likeRatio.toFixed(1)}%`
            : 'N/A',
        bText: showRevenue
          ? formatCurrencyCompact(revB.monthlyUsd)
          : gameB.likeRatio !== null && gameB.likeRatio !== undefined
            ? `${gameB.likeRatio.toFixed(1)}%`
            : 'N/A',
        aNum: showRevenue ? revA.monthlyUsd : gameA.likeRatio ?? 0,
        bNum: showRevenue ? revB.monthlyUsd : gameB.likeRatio ?? 0,
      },
    ];

    return new ImageResponse(
      (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            width: 1200,
            height: 630,
            backgroundColor: '#FFFFFF',
            color: '#0F172A',
            padding: '32px 46px',
            fontFamily: 'sans-serif',
          }}
        >
          <OgHeader kicker="Head-to-Head Comparison" />

          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 10 }}>
            <span style={{ fontSize: 28, fontWeight: 800, color: '#0F172A' }}>
              {truncateText(headline, 54)}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                flex: 1,
                backgroundColor: '#F8FAFC',
                border: '1px solid #CBD5E1',
                borderRadius: 12,
                padding: '10px 14px',
              }}
            >
              <OgThumb dataUri={thumbA} name={gameA.name} size={48} radius={10} />
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: 17, fontWeight: 800, color: '#0F172A' }}>
                  {truncateText(gameA.name, 24)}
                </span>
                <span style={{ fontSize: 13, color: '#64748B' }}>
                  {truncateText(gameA.creatorName, 26)}
                </span>
              </div>
            </div>

            <span style={{ fontSize: 15, fontWeight: 800, color: '#64748B' }}>VS</span>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: 14,
                flex: 1,
                backgroundColor: '#EFF6FF',
                border: '1px solid #BFDBFE',
                borderRadius: 12,
                padding: '10px 14px',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                <span style={{ fontSize: 17, fontWeight: 800, color: '#1E3A8A' }}>
                  {truncateText(gameB.name, 24)}
                </span>
                <span style={{ fontSize: 13, color: '#3B82F6' }}>
                  {truncateText(gameB.creatorName, 26)}
                </span>
              </div>
              <OgThumb dataUri={thumbB} name={gameB.name} size={48} radius={10} />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {metricRows.map((row) => {
              const maxV = Math.max(1, row.aNum, row.bNum);
              const shareA = Math.max(8, Math.round((row.aNum / maxV) * 100));
              const shareB = Math.max(8, Math.round((row.bNum / maxV) * 100));
              const aWins = row.aNum > row.bNum;
              const bWins = row.bNum > row.aNum;

              return (
                <div
                  key={row.label}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    paddingBottom: 10,
                    borderBottom: '1px solid #F1F5F9',
                  }}
                >
                  <span
                    style={{
                      width: 145,
                      fontSize: 17,
                      fontWeight: 800,
                      color: aWins ? '#0F172A' : '#64748B',
                    }}
                  >
                    {row.aText}
                  </span>

                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'flex-end',
                      flex: 1,
                      height: 11,
                      backgroundColor: '#F1F5F9',
                      borderRadius: 999,
                    }}
                  >
                    <div
                      style={{
                        width: `${shareA}%`,
                        height: 11,
                        backgroundColor: aWins ? '#0F172A' : '#94A3B8',
                        borderRadius: 999,
                      }}
                    />
                  </div>

                  <span
                    style={{
                      width: 165,
                      textAlign: 'center',
                      fontSize: 14,
                      fontWeight: 700,
                      color: '#475569',
                    }}
                  >
                    {row.label}
                  </span>

                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'flex-start',
                      flex: 1,
                      height: 11,
                      backgroundColor: '#F1F5F9',
                      borderRadius: 999,
                    }}
                  >
                    <div
                      style={{
                        width: `${shareB}%`,
                        height: 11,
                        backgroundColor: bWins ? '#2563EB' : '#93C5FD',
                        borderRadius: 999,
                      }}
                    />
                  </div>

                  <span
                    style={{
                      width: 145,
                      textAlign: 'right',
                      fontSize: 17,
                      fontWeight: 800,
                      color: bWins ? '#1D4ED8' : '#64748B',
                    }}
                  >
                    {row.bText}
                  </span>
                </div>
              );
            })}
          </div>

          <OgFooter
            left="Tap to open live side-by-side comparison on RoMetric"
            right="rometrics.vercel.app/compare"
          />
        </div>
      ),
      {
        width: 1200,
        height: 630,
        headers: {
          'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300',
        },
      }
    );
  }

  // Fallback Branded Card
  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          width: 1200,
          height: 630,
          backgroundColor: '#FFFFFF',
          color: '#0F172A',
          padding: '44px 56px',
          fontFamily: 'sans-serif',
        }}
      >
        <OgHeader kicker="Live Roblox Analytics" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <span style={{ fontSize: 48, fontWeight: 900, color: '#0F172A' }}>
            Live Roblox Player Counts, Revenue & Active Codes
          </span>
          <span style={{ fontSize: 22, color: '#475569' }}>
            Real-time CCU rankings, 24h surges, DevEx estimates, and verified codes.
          </span>
        </div>
        <OgFooter
          left="Free real-time Roblox analytics platform"
          right="rometrics.vercel.app"
        />
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
