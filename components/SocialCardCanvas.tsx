'use client';

import React, { useState } from 'react';
import type { GameRecordData } from '@/lib/types';
import type { GameCodeDirectoryItem, GameCodeRecord } from '@/lib/codes-types';
import {
  formatCompactNumber,
  formatExactNumber,
  formatPercent,
} from '@/lib/format';
import { estimateGameRevenue, formatCurrencyCompact } from '@/lib/revenue';
import {
  computeGameRevenueSurge,
  computeNet24hGain,
  formatSnapshotDate,
  formatSnapshotTimeUtc,
  getProxiedArtworkUrl,
  SOCIAL_STAGE_DIMENSIONS,
  type MilestoneSummary,
  type RevenueSurgeSummary,
  type SocialAspectRatio,
  type SocialTemplateId,
} from '@/lib/social-studio';

export interface SocialCardCanvasProps {
  template: SocialTemplateId;
  aspect: SocialAspectRatio;
  customHeadline: string;
  showRevenue: boolean;
  showTimestamp: boolean;
  showFooterUrl: boolean;
  leaderboardGames: GameRecordData[];
  topEarningGames: GameRecordData[];
  surgeRunnersUp: GameRecordData[];
  revenueRunnersUp: GameRecordData[];
  primaryGame: GameRecordData | null;
  secondaryGame: GameRecordData | null;
  milestone: MilestoneSummary | null;
  revenueSurge: RevenueSurgeSummary | null;
  codeGame: GameCodeDirectoryItem | null;
  selectedCodes: GameCodeRecord[];
  snapshotDate: Date;
}

function CardThumb({
  src,
  alt,
  size,
  radius = 10,
}: {
  src?: string | null;
  alt: string;
  size: number;
  radius?: number;
}) {
  const [failed, setFailed] = useState(false);
  const proxied = getProxiedArtworkUrl(src);
  const initials = alt
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || '')
    .join('');

  if (!proxied || failed) {
    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: radius,
          backgroundColor: '#F1F5F9',
          border: '1px solid #E2E8F0',
          color: '#334155',
          fontSize: Math.max(12, Math.round(size * 0.34)),
        }}
        className="shrink-0 flex items-center justify-center font-bold select-none"
      >
        {initials || 'R'}
      </div>
    );
  }

  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={proxied}
      alt={alt}
      width={size}
      height={size}
      crossOrigin="anonymous"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        border: '1px solid #E2E8F0',
        objectFit: 'cover',
        backgroundColor: '#F8FAFC',
      }}
      className="shrink-0 block"
    />
  );
}

function CardHeader({
  kicker,
  showTimestamp,
  snapshotDate,
}: {
  kicker: string;
  showTimestamp: boolean;
  snapshotDate: Date;
}) {
  return (
    <div
      style={{ borderBottom: '1px solid #E2E8F0' }}
      className="flex items-center justify-between pb-4 shrink-0"
    >
      <div className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/assets/aistudio/logoofrometric_7c92ca67.png"
          alt="RoMetric"
          width={30}
          height={30}
          referrerPolicy="no-referrer"
          style={{
            width: 30,
            height: 30,
            borderRadius: 8,
            objectFit: 'cover',
            backgroundColor: '#091318',
            border: '1px solid #CBD5E1',
          }}
        />
        <div className="flex items-baseline gap-2.5">
          <span
            style={{ color: '#0F172A', letterSpacing: '-0.025em' }}
            className="text-[20px] font-extrabold leading-none"
          >
            RoMetric
          </span>
          <span style={{ color: '#CBD5E1' }} aria-hidden="true">
            ·
          </span>
          <span
            style={{ color: '#475569' }}
            className="text-[14px] font-semibold leading-none"
          >
            {kicker}
          </span>
        </div>
      </div>

      {showTimestamp && (
        <div
          style={{ color: '#64748B' }}
          className="flex items-center gap-2 text-[13px] font-medium tabular-nums"
        >
          <span>Live Snapshot</span>
          <span aria-hidden="true">·</span>
          <span>{formatSnapshotDate(snapshotDate)}</span>
          <span aria-hidden="true">·</span>
          <span>{formatSnapshotTimeUtc(snapshotDate)}</span>
        </div>
      )}
    </div>
  );
}

function CardFooter({
  leftNote,
  rightLink,
  showFooterUrl,
}: {
  leftNote: string;
  rightLink: string;
  showFooterUrl: boolean;
}) {
  return (
    <div
      style={{ borderTop: '1px solid #E2E8F0' }}
      className="flex items-center justify-between pt-3.5 mt-auto shrink-0"
    >
      <span style={{ color: '#64748B' }} className="text-[13px] font-medium">
        {leftNote}
      </span>
      {showFooterUrl && (
        <span
          style={{ color: '#0F172A' }}
          className="text-[13px] font-mono font-semibold tabular-nums"
        >
          {rightLink}
        </span>
      )}
    </div>
  );
}

function formatSignedDelta(pct: number | null | undefined): {
  text: string;
  color: string;
} {
  if (pct === null || pct === undefined || Number.isNaN(pct)) {
    return { text: '—', color: '#94A3B8' };
  }
  if (pct > 0.05) {
    return { text: `▲ ${formatPercent(pct)}`, color: '#16A34A' };
  }
  if (pct < -0.05) {
    return { text: `▼ ${formatPercent(pct)}`, color: '#DC2626' };
  }
  return { text: '0.0%', color: '#64748B' };
}

export function SocialCardCanvas({
  template,
  aspect,
  customHeadline,
  showRevenue,
  showTimestamp,
  showFooterUrl,
  leaderboardGames,
  topEarningGames,
  surgeRunnersUp,
  revenueRunnersUp,
  primaryGame,
  secondaryGame,
  milestone,
  revenueSurge,
  codeGame,
  selectedCodes,
  snapshotDate,
}: SocialCardCanvasProps) {
  const dims = SOCIAL_STAGE_DIMENSIONS[aspect];
  const isSquare = aspect === '1:1';
  const padX = isSquare ? 48 : 52;
  const padY = isSquare ? 44 : 38;

  return (
    <div
      style={{
        width: dims.width,
        height: dims.height,
        backgroundColor: '#FFFFFF',
        color: '#0F172A',
        paddingLeft: padX,
        paddingRight: padX,
        paddingTop: padY,
        paddingBottom: padY,
        fontFamily:
          "'DM Sans', 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, ui-sans-serif, sans-serif",
        boxSizing: 'border-box',
      }}
      className="flex flex-col justify-between overflow-hidden select-none"
    >
      {/* NEW: TOP EARNING ROBLOX GAMES */}
      {template === 'top_earning' && (() => {
        const rows = topEarningGames;
        const maxRev = Math.max(
          1,
          rows[0] ? estimateGameRevenue(rows[0]).monthlyUsd : 1
        );
        const totalMonthly = rows.reduce(
          (sum, g) => sum + estimateGameRevenue(g).monthlyUsd,
          0
        );
        const isTen = rows.length > 5;
        const headline =
          customHeadline.trim() ||
          `Top ${rows.length} Earning Roblox Games (Est. Monthly)`;

        return (
          <>
            <CardHeader
              kicker="Top Earning Leaderboard"
              showTimestamp={showTimestamp}
              snapshotDate={snapshotDate}
            />

            <div className="flex items-end justify-between pt-4 pb-3 shrink-0">
              <div>
                <h2
                  style={{
                    color: '#0F172A',
                    letterSpacing: '-0.03em',
                    textWrap: 'balance',
                  }}
                  className={`${isSquare ? 'text-[34px]' : 'text-[30px]'} font-bold leading-tight`}
                >
                  {headline}
                </h2>
              </div>
              <div className="text-right shrink-0 pl-4">
                <div
                  style={{ color: '#64748B' }}
                  className="text-[12px] font-medium"
                >
                  Combined Top {rows.length} Est.
                </div>
                <div
                  style={{ color: '#16A34A' }}
                  className="text-[22px] font-bold font-mono tabular-nums leading-tight"
                >
                  {formatCurrencyCompact(totalMonthly)}/mo
                </div>
              </div>
            </div>

            <div className="flex-1 flex flex-col justify-between py-1">
              {rows.length === 0 ? (
                <div
                  style={{ color: '#64748B' }}
                  className="flex-1 flex items-center justify-center text-[16px]"
                >
                  No tracked games loaded yet.
                </div>
              ) : (
                rows.map((game, idx) => {
                  const rev = estimateGameRevenue(game);
                  const pctWidth = Math.max(
                    5,
                    Math.round((rev.monthlyUsd / maxRev) * 100)
                  );
                  const rowBg = idx % 2 === 0 ? '#F8FAFC' : '#FFFFFF';
                  const thumbSize = isTen
                    ? isSquare
                      ? 44
                      : 30
                    : isSquare
                      ? 64
                      : 48;

                  return (
                    <div
                      key={game.universeId}
                      style={{
                        backgroundColor: rowBg,
                        borderBottom: '1px solid #F1F5F9',
                        paddingTop: isTen ? (isSquare ? 10 : 5) : isSquare ? 16 : 11,
                        paddingBottom: isTen ? (isSquare ? 10 : 5) : isSquare ? 16 : 11,
                      }}
                      className="flex items-center gap-3.5 px-3 rounded-lg"
                    >
                      <span
                        style={{
                          color: idx < 3 ? '#0F172A' : '#64748B',
                          width: 28,
                        }}
                        className="font-mono text-[14px] font-bold tabular-nums shrink-0"
                      >
                        {String(idx + 1).padStart(2, '0')}
                      </span>

                      <CardThumb
                        src={game.iconUrl || game.thumbnailUrl}
                        alt={game.name}
                        size={thumbSize}
                        radius={isTen && !isSquare ? 7 : 10}
                      />

                      <div className="min-w-0 w-[290px] shrink-0">
                        <div
                          style={{ color: '#0F172A' }}
                          className={`${isTen && !isSquare ? 'text-[14px]' : 'text-[16px]'} font-bold truncate leading-snug`}
                        >
                          {game.name}
                        </div>
                        {(!isTen || isSquare) && (
                          <div
                            style={{ color: '#64748B' }}
                            className="text-[12px] font-medium truncate"
                          >
                            {game.creatorName} · {formatCompactNumber(game.currentCcu)} CCU
                          </div>
                        )}
                      </div>

                      {/* Proportional Monthly Revenue bar */}
                      <div className="flex-1 px-2">
                        <div
                          style={{
                            height: isTen && !isSquare ? 8 : 11,
                            backgroundColor: '#E2E8F0',
                            borderRadius: 999,
                            overflow: 'hidden',
                          }}
                        >
                          <div
                            style={{
                              width: `${pctWidth}%`,
                              height: '100%',
                              backgroundColor: idx === 0 ? '#16A34A' : '#0F172A',
                              borderRadius: 999,
                            }}
                          />
                        </div>
                      </div>

                      {/* Tabular Monthly USD */}
                      <div className="text-right shrink-0 w-[124px]">
                        <div
                          style={{ color: '#0F172A' }}
                          className={`${isTen && !isSquare ? 'text-[14px]' : 'text-[16px]'} font-mono font-bold tabular-nums`}
                        >
                          {formatCurrencyCompact(rev.monthlyUsd)}/mo
                        </div>
                      </div>

                      {/* Daily USD */}
                      <div className="text-right shrink-0 w-[94px]">
                        <span
                          style={{ color: '#16A34A' }}
                          className="font-mono text-[13px] font-bold tabular-nums"
                        >
                          {formatCurrencyCompact(rev.dailyUsd)}/d
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <CardFooter
              leftNote="Estimated DevEx monthly revenue from live CCU, genre & rating telemetry"
              rightLink="rometrics.vercel.app/rankings"
              showFooterUrl={showFooterUrl}
            />
          </>
        );
      })()}

      {/* NEW: 24H REVENUE INCREASE / JUMP ALERT */}
      {template === 'revenue_surge' && (() => {
        const game = primaryGame;
        const stats = revenueSurge || (game ? computeGameRevenueSurge(game) : null);
        if (!game || !stats) {
          return (
            <div className="flex-1 flex items-center justify-center text-slate-500">
              Select a game to preview the Revenue Jump card.
            </div>
          );
        }

        const isGain = stats.deltaMonthlyUsd > 0;
        const maxBar = Math.max(
          1,
          stats.currentMonthlyUsd,
          stats.previousMonthlyUsd
        );
        const prevW = Math.max(
          8,
          Math.round((stats.previousMonthlyUsd / maxBar) * 100)
        );
        const currW = Math.max(
          8,
          Math.round((stats.currentMonthlyUsd / maxBar) * 100)
        );
        const headline =
          customHeadline.trim() ||
          (isGain
            ? `${game.name} est. monthly revenue jumps ${formatCurrencyCompact(stats.deltaMonthlyUsd)}`
            : `${game.name} — Estimated Roblox DevEx Earnings`);

        return (
          <>
            <CardHeader
              kicker="24h Revenue Jump Alert"
              showTimestamp={showTimestamp}
              snapshotDate={snapshotDate}
            />

            <div className="flex-1 flex flex-col justify-center gap-5 py-4">
              {/* Top hero split */}
              <div className="flex items-center justify-between gap-7">
                <div className="flex items-center gap-5 min-w-0 flex-1">
                  <CardThumb
                    src={game.iconUrl || game.thumbnailUrl}
                    alt={game.name}
                    size={isSquare ? 128 : 110}
                    radius={18}
                  />
                  <div className="min-w-0 space-y-2">
                    <div
                      style={{ color: '#16A34A' }}
                      className="text-[14px] font-bold tracking-tight"
                    >
                      Estimated DevEx Revenue · {game.genre || 'Experience'}
                    </div>
                    <h2
                      style={{
                        color: '#0F172A',
                        letterSpacing: '-0.03em',
                        textWrap: 'balance',
                      }}
                      className={`${isSquare ? 'text-[36px]' : 'text-[32px]'} font-bold leading-[1.12]`}
                    >
                      {headline}
                    </h2>
                    <div
                      style={{ color: '#475569' }}
                      className="text-[15px] font-medium"
                    >
                      Developed by {game.creatorName}
                    </div>
                  </div>
                </div>

                {/* Giant semantic revenue jump readout */}
                <div
                  style={{
                    backgroundColor: isGain ? '#F0FDF4' : '#F8FAFC',
                    border: isGain ? '1px solid #BBF7D0' : '1px solid #E2E8F0',
                  }}
                  className="shrink-0 rounded-2xl px-7 py-5 text-right min-w-[260px]"
                >
                  <div
                    style={{ color: isGain ? '#15803D' : '#475569' }}
                    className="text-[13px] font-semibold"
                  >
                    {isGain ? '24h Monthly Run-Rate Jump' : 'Est. Monthly DevEx'}
                  </div>
                  <div
                    style={{
                      color: isGain ? '#16A34A' : '#0F172A',
                      letterSpacing: '-0.03em',
                    }}
                    className={`${isSquare ? 'text-[50px]' : 'text-[46px]'} font-mono font-extrabold tabular-nums leading-none mt-1.5`}
                  >
                    {isGain
                      ? `+${formatCurrencyCompact(stats.deltaMonthlyUsd)}`
                      : formatCurrencyCompact(stats.currentMonthlyUsd)}
                  </div>
                  <div
                    style={{ color: isGain ? '#166534' : '#64748B' }}
                    className="text-[14px] font-mono font-semibold tabular-nums mt-2"
                  >
                    {isGain
                      ? `▲ ${formatPercent(stats.revenueGrowthPct)} · +${formatCurrencyCompact(stats.deltaDailyUsd)}/day`
                      : `${formatCurrencyCompact(stats.currentDailyUsd)}/day pacing`}
                  </div>
                </div>
              </div>

              {/* 24h Baseline vs Current Run-Rate Bar */}
              <div
                style={{
                  backgroundColor: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                }}
                className="rounded-xl px-6 py-4 space-y-3"
              >
                <div className="flex items-center gap-4">
                  <span
                    style={{ color: '#64748B' }}
                    className="w-[140px] text-[13px] font-semibold shrink-0"
                  >
                    24h Baseline Est.
                  </span>
                  <div
                    style={{
                      height: 11,
                      backgroundColor: '#E2E8F0',
                      borderRadius: 999,
                      overflow: 'hidden',
                    }}
                    className="flex-1"
                  >
                    <div
                      style={{
                        width: `${prevW}%`,
                        height: '100%',
                        backgroundColor: '#94A3B8',
                        borderRadius: 999,
                      }}
                    />
                  </div>
                  <span
                    style={{ color: '#475569' }}
                    className="w-[120px] text-right font-mono text-[14px] font-bold tabular-nums shrink-0"
                  >
                    {formatCurrencyCompact(stats.previousMonthlyUsd)}/mo
                  </span>
                </div>

                <div className="flex items-center gap-4">
                  <span
                    style={{ color: '#0F172A' }}
                    className="w-[140px] text-[13px] font-bold shrink-0"
                  >
                    Current Pace
                  </span>
                  <div
                    style={{
                      height: 11,
                      backgroundColor: '#E2E8F0',
                      borderRadius: 999,
                      overflow: 'hidden',
                    }}
                    className="flex-1"
                  >
                    <div
                      style={{
                        width: `${currW}%`,
                        height: '100%',
                        backgroundColor: '#16A34A',
                        borderRadius: 999,
                      }}
                    />
                  </div>
                  <span
                    style={{ color: '#0F172A' }}
                    className="w-[120px] text-right font-mono text-[15px] font-extrabold tabular-nums shrink-0"
                  >
                    {formatCurrencyCompact(stats.currentMonthlyUsd)}/mo
                  </span>
                </div>
              </div>

              {/* 4-column structured revenue KPI strip */}
              <div
                style={{
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #E2E8F0',
                }}
                className="grid grid-cols-4 divide-x divide-[#E2E8F0] rounded-xl"
              >
                <div className="px-5 py-3.5">
                  <div style={{ color: '#64748B' }} className="text-[12px] font-medium">
                    Est. Monthly USD
                  </div>
                  <div
                    style={{ color: '#0F172A' }}
                    className="text-[25px] font-mono font-bold tabular-nums mt-1"
                  >
                    {formatCurrencyCompact(stats.currentMonthlyUsd)}
                  </div>
                  <div style={{ color: '#64748B' }} className="text-[11px] font-mono tabular-nums mt-0.5">
                    {formatCurrencyCompact(stats.yearlyUsd)}/yr pace
                  </div>
                </div>

                <div className="px-5 py-3.5">
                  <div style={{ color: '#64748B' }} className="text-[12px] font-medium">
                    Est. Daily USD
                  </div>
                  <div
                    style={{ color: '#0F172A' }}
                    className="text-[25px] font-mono font-bold tabular-nums mt-1"
                  >
                    {formatCurrencyCompact(stats.currentDailyUsd)}
                  </div>
                  <div style={{ color: '#16A34A' }} className="text-[11px] font-mono font-semibold tabular-nums mt-0.5">
                    {stats.deltaDailyUsd > 0
                      ? `+${formatCurrencyCompact(stats.deltaDailyUsd)}/d`
                      : 'DevEx equivalent'}
                  </div>
                </div>

                <div className="px-5 py-3.5">
                  <div style={{ color: '#64748B' }} className="text-[12px] font-medium">
                    Est. Monthly Robux
                  </div>
                  <div
                    style={{ color: '#0F172A' }}
                    className="text-[25px] font-mono font-bold tabular-nums mt-1"
                  >
                    {formatCompactNumber(stats.currentMonthlyRobux)}
                  </div>
                  <div style={{ color: '#64748B' }} className="text-[11px] font-mono tabular-nums mt-0.5">
                    R$ at DevEx rate
                  </div>
                </div>

                <div className="px-5 py-3.5">
                  <div style={{ color: '#64748B' }} className="text-[12px] font-medium">
                    Live Players (CCU)
                  </div>
                  <div
                    style={{ color: '#0F172A' }}
                    className="text-[25px] font-mono font-bold tabular-nums mt-1"
                  >
                    {formatCompactNumber(game.currentCcu)}
                  </div>
                  <div style={{ color: '#64748B' }} className="text-[11px] font-mono tabular-nums mt-0.5">
                    {formatExactNumber(game.currentCcu)} active
                  </div>
                </div>
              </div>

              {/* Also Rising in Revenue strip */}
              {revenueRunnersUp.length > 0 && (
                <div className="space-y-2">
                  <div
                    style={{ color: '#64748B' }}
                    className="text-[12px] font-semibold"
                  >
                    Other Fast-Rising Earners (24h)
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {revenueRunnersUp.slice(0, 3).map((r) => {
                      const rs = computeGameRevenueSurge(r);
                      return (
                        <div
                          key={r.universeId}
                          style={{
                            border: '1px solid #E2E8F0',
                            backgroundColor: '#FFFFFF',
                          }}
                          className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl"
                        >
                          <CardThumb
                            src={r.iconUrl || r.thumbnailUrl}
                            alt={r.name}
                            size={36}
                            radius={8}
                          />
                          <div className="min-w-0 flex-1">
                            <div
                              style={{ color: '#0F172A' }}
                              className="text-[13px] font-bold truncate"
                            >
                              {r.name}
                            </div>
                            <div className="flex items-center gap-2 text-[12px] font-mono tabular-nums">
                              <span style={{ color: '#475569' }}>
                                {formatCurrencyCompact(rs.currentMonthlyUsd)}/mo
                              </span>
                              {rs.deltaMonthlyUsd > 0 && (
                                <span style={{ color: '#16A34A' }} className="font-bold">
                                  +{formatCurrencyCompact(rs.deltaMonthlyUsd)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <CardFooter
              leftNote="Estimated DevEx revenue calculated from live CCU, genre & rating telemetry"
              rightLink={`rometrics.vercel.app/games/${game.universeId}`}
              showFooterUrl={showFooterUrl}
            />
          </>
        );
      })()}

      {/* 1. DAILY TOP 10 LIVE CCU LEADERBOARD */}
      {template === 'leaderboard' && (() => {
        const rows = leaderboardGames;
        const maxCcu = Math.max(1, rows[0]?.currentCcu || 1);
        const totalCcu = rows.reduce((sum, g) => sum + g.currentCcu, 0);
        const isTen = rows.length > 5;
        const headline =
          customHeadline.trim() ||
          `Top ${rows.length} Roblox Games by Live Players`;

        return (
          <>
            <CardHeader
              kicker="Live CCU Leaderboard"
              showTimestamp={showTimestamp}
              snapshotDate={snapshotDate}
            />

            <div className="flex items-end justify-between pt-4 pb-3 shrink-0">
              <div>
                <h2
                  style={{
                    color: '#0F172A',
                    letterSpacing: '-0.03em',
                    textWrap: 'balance',
                  }}
                  className={`${isSquare ? 'text-[34px]' : 'text-[30px]'} font-bold leading-tight`}
                >
                  {headline}
                </h2>
              </div>
              <div className="text-right shrink-0 pl-4">
                <div
                  style={{ color: '#64748B' }}
                  className="text-[12px] font-medium"
                >
                  Combined Top {rows.length}
                </div>
                <div
                  style={{ color: '#0F172A' }}
                  className="text-[22px] font-bold font-mono tabular-nums leading-tight"
                >
                  {formatCompactNumber(totalCcu)} CCU
                </div>
              </div>
            </div>

            <div className="flex-1 flex flex-col justify-between py-1">
              {rows.length === 0 ? (
                <div
                  style={{ color: '#64748B' }}
                  className="flex-1 flex items-center justify-center text-[16px]"
                >
                  No tracked games loaded yet.
                </div>
              ) : (
                rows.map((game, idx) => {
                  const pctWidth = Math.max(
                    4,
                    Math.round((game.currentCcu / maxCcu) * 100)
                  );
                  const delta = formatSignedDelta(
                    game.growth24h ?? game.growth1h
                  );
                  const rowBg = idx % 2 === 0 ? '#F8FAFC' : '#FFFFFF';
                  const thumbSize = isTen
                    ? isSquare
                      ? 44
                      : 30
                    : isSquare
                      ? 64
                      : 48;

                  return (
                    <div
                      key={game.universeId}
                      style={{
                        backgroundColor: rowBg,
                        borderBottom: '1px solid #F1F5F9',
                        paddingTop: isTen ? (isSquare ? 10 : 5) : isSquare ? 16 : 11,
                        paddingBottom: isTen ? (isSquare ? 10 : 5) : isSquare ? 16 : 11,
                      }}
                      className="flex items-center gap-3.5 px-3 rounded-lg"
                    >
                      <span
                        style={{
                          color: idx < 3 ? '#0F172A' : '#64748B',
                          width: 28,
                        }}
                        className="font-mono text-[14px] font-bold tabular-nums shrink-0"
                      >
                        {String(idx + 1).padStart(2, '0')}
                      </span>

                      <CardThumb
                        src={game.iconUrl || game.thumbnailUrl}
                        alt={game.name}
                        size={thumbSize}
                        radius={isTen && !isSquare ? 7 : 10}
                      />

                      <div className="min-w-0 w-[300px] shrink-0">
                        <div
                          style={{ color: '#0F172A' }}
                          className={`${isTen && !isSquare ? 'text-[14px]' : 'text-[16px]'} font-bold truncate leading-snug`}
                        >
                          {game.name}
                        </div>
                        {(!isTen || isSquare) && (
                          <div
                            style={{ color: '#64748B' }}
                            className="text-[12px] font-medium truncate"
                          >
                            {game.creatorName} · {game.genre || 'Experience'}
                          </div>
                        )}
                      </div>

                      {/* Proportional CCU bar */}
                      <div className="flex-1 px-2">
                        <div
                          style={{
                            height: isTen && !isSquare ? 8 : 11,
                            backgroundColor: '#E2E8F0',
                            borderRadius: 999,
                            overflow: 'hidden',
                          }}
                        >
                          <div
                            style={{
                              width: `${pctWidth}%`,
                              height: '100%',
                              backgroundColor: idx === 0 ? '#16A34A' : '#0F172A',
                              borderRadius: 999,
                            }}
                          />
                        </div>
                      </div>

                      {/* Tabular CCU */}
                      <div className="text-right shrink-0 w-[112px]">
                        <div
                          style={{ color: '#0F172A' }}
                          className={`${isTen && !isSquare ? 'text-[14px]' : 'text-[16px]'} font-mono font-bold tabular-nums`}
                        >
                          {formatExactNumber(game.currentCcu)}
                        </div>
                      </div>

                      {/* Signed 24h delta */}
                      <div className="text-right shrink-0 w-[86px]">
                        <span
                          style={{ color: delta.color }}
                          className="font-mono text-[13px] font-bold tabular-nums"
                        >
                          {delta.text}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <CardFooter
              leftNote="Live concurrent player counts tracked across Roblox"
              rightLink="rometrics.vercel.app/rankings"
              showFooterUrl={showFooterUrl}
            />
          </>
        );
      })()}

      {/* 2. BREAKOUT 24H TRENDING SURGE ALERT */}
      {template === 'surge' && (() => {
        const game = primaryGame;
        if (!game) {
          return (
            <div className="flex-1 flex items-center justify-center text-slate-500">
              Select a game to preview the 24h Surge card.
            </div>
          );
        }
        const pct = game.growth24h ?? game.growth1h ?? null;
        const delta = formatSignedDelta(pct);
        const netGain = computeNet24hGain(game);
        const peak = Math.max(game.currentCcu, game.peakCcuObserved || 0);
        const rev = estimateGameRevenue(game);
        const headline =
          customHeadline.trim() || `${game.name} surges in 24-hour player activity`;

        return (
          <>
            <CardHeader
              kicker="24h Breakout Surge Alert"
              showTimestamp={showTimestamp}
              snapshotDate={snapshotDate}
            />

            <div className="flex-1 flex flex-col justify-center gap-6 py-4">
              {/* Top hero split */}
              <div className="flex items-center justify-between gap-8">
                <div className="flex items-center gap-5 min-w-0 flex-1">
                  <CardThumb
                    src={game.iconUrl || game.thumbnailUrl}
                    alt={game.name}
                    size={isSquare ? 132 : 114}
                    radius={18}
                  />
                  <div className="min-w-0 space-y-2">
                    <div
                      style={{ color: '#16A34A' }}
                      className="text-[14px] font-bold tracking-tight"
                    >
                      Breakout Momentum · {game.genre || 'Roblox Experience'}
                    </div>
                    <h2
                      style={{
                        color: '#0F172A',
                        letterSpacing: '-0.03em',
                        textWrap: 'balance',
                      }}
                      className={`${isSquare ? 'text-[38px]' : 'text-[34px]'} font-bold leading-[1.12]`}
                    >
                      {headline}
                    </h2>
                    <div
                      style={{ color: '#475569' }}
                      className="text-[15px] font-medium"
                    >
                      Developed by {game.creatorName}
                    </div>
                  </div>
                </div>

                {/* Giant tabular surge metric */}
                <div
                  style={{
                    backgroundColor: '#F0FDF4',
                    border: '1px solid #BBF7D0',
                  }}
                  className="shrink-0 rounded-2xl px-7 py-5 text-right min-w-[240px]"
                >
                  <div
                    style={{ color: '#15803D' }}
                    className="text-[13px] font-semibold"
                  >
                    24h Player Surge
                  </div>
                  <div
                    style={{ color: delta.color, letterSpacing: '-0.03em' }}
                    className={`${isSquare ? 'text-[54px]' : 'text-[52px]'} font-mono font-extrabold tabular-nums leading-none mt-1.5`}
                  >
                    {pct !== null ? formatPercent(pct) : 'Rising'}
                  </div>
                  <div
                    style={{ color: '#166534' }}
                    className="text-[14px] font-mono font-semibold tabular-nums mt-2"
                  >
                    {netGain !== null && netGain > 0
                      ? `+${formatExactNumber(netGain)} players added`
                      : `${formatExactNumber(game.currentCcu)} live now`}
                  </div>
                </div>
              </div>

              {/* 4-column structured KPI strip */}
              <div
                style={{
                  backgroundColor: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                }}
                className="grid grid-cols-4 divide-x divide-[#E2E8F0] rounded-xl"
              >
                <div className="px-5 py-4">
                  <div style={{ color: '#64748B' }} className="text-[13px] font-medium">
                    Live Players (CCU)
                  </div>
                  <div
                    style={{ color: '#0F172A' }}
                    className="text-[28px] font-mono font-bold tabular-nums mt-1"
                  >
                    {formatCompactNumber(game.currentCcu)}
                  </div>
                  <div style={{ color: '#64748B' }} className="text-[12px] font-mono tabular-nums mt-0.5">
                    {formatExactNumber(game.currentCcu)} exact
                  </div>
                </div>

                <div className="px-5 py-4">
                  <div style={{ color: '#64748B' }} className="text-[13px] font-medium">
                    Observed Peak
                  </div>
                  <div
                    style={{ color: '#0F172A' }}
                    className="text-[28px] font-mono font-bold tabular-nums mt-1"
                  >
                    {formatCompactNumber(peak)}
                  </div>
                  <div style={{ color: '#64748B' }} className="text-[12px] font-mono tabular-nums mt-0.5">
                    {peak > 0 ? `${Math.round((game.currentCcu / peak) * 100)}% of peak` : 'Measured live'}
                  </div>
                </div>

                <div className="px-5 py-4">
                  <div style={{ color: '#64748B' }} className="text-[13px] font-medium">
                    Lifetime Visits
                  </div>
                  <div
                    style={{ color: '#0F172A' }}
                    className="text-[28px] font-mono font-bold tabular-nums mt-1"
                  >
                    {formatCompactNumber(game.totalVisits)}
                  </div>
                  <div style={{ color: '#64748B' }} className="text-[12px] font-mono tabular-nums mt-0.5">
                    {formatCompactNumber(game.favorites)} favorites
                  </div>
                </div>

                <div className="px-5 py-4">
                  <div style={{ color: '#64748B' }} className="text-[13px] font-medium">
                    {showRevenue ? 'Est. Monthly DevEx' : 'Player Rating'}
                  </div>
                  <div
                    style={{ color: '#0F172A' }}
                    className="text-[28px] font-mono font-bold tabular-nums mt-1"
                  >
                    {showRevenue
                      ? formatCurrencyCompact(rev.monthlyUsd)
                      : game.likeRatio !== null && game.likeRatio !== undefined
                        ? `${game.likeRatio.toFixed(1)}%`
                        : 'N/A'}
                  </div>
                  <div style={{ color: '#64748B' }} className="text-[12px] font-mono tabular-nums mt-0.5">
                    {showRevenue
                      ? `${formatCompactNumber(rev.monthlyRobux)} R$/mo est.`
                      : 'Positive vote ratio'}
                  </div>
                </div>
              </div>

              {/* Runner-up surging strip */}
              {surgeRunnersUp.length > 0 && (
                <div className="space-y-2.5">
                  <div
                    style={{ color: '#64748B' }}
                    className="text-[13px] font-semibold"
                  >
                    Also Surging Right Now
                  </div>
                  <div className="grid grid-cols-3 gap-3.5">
                    {surgeRunnersUp.slice(0, 3).map((r) => {
                      const rDelta = formatSignedDelta(r.growth24h ?? r.growth1h);
                      return (
                        <div
                          key={r.universeId}
                          style={{
                            border: '1px solid #E2E8F0',
                            backgroundColor: '#FFFFFF',
                          }}
                          className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl"
                        >
                          <CardThumb
                            src={r.iconUrl || r.thumbnailUrl}
                            alt={r.name}
                            size={38}
                            radius={8}
                          />
                          <div className="min-w-0 flex-1">
                            <div
                              style={{ color: '#0F172A' }}
                              className="text-[14px] font-bold truncate"
                            >
                              {r.name}
                            </div>
                            <div className="flex items-center gap-2 text-[12px] font-mono tabular-nums">
                              <span style={{ color: '#475569' }}>
                                {formatCompactNumber(r.currentCcu)} CCU
                              </span>
                              <span style={{ color: rDelta.color }} className="font-bold">
                                {rDelta.text}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <CardFooter
              leftNote="24h breakout velocity measured across tracked Roblox games"
              rightLink={`rometrics.vercel.app/games/${game.universeId}`}
              showFooterUrl={showFooterUrl}
            />
          </>
        );
      })()}

      {/* 3. MILESTONE ALERT (CCU PEAK / VISITS) */}
      {template === 'milestone' && (() => {
        const game = primaryGame;
        if (!game || !milestone) {
          return (
            <div className="flex-1 flex items-center justify-center text-slate-500">
              Select a game to preview the Milestone card.
            </div>
          );
        }
        const headline = customHeadline.trim() || milestone.headline;
        const rev = estimateGameRevenue(game);
        const peak = Math.max(game.currentCcu, game.peakCcuObserved || 0);

        return (
          <>
            <CardHeader
              kicker={milestone.categoryLabel}
              showTimestamp={showTimestamp}
              snapshotDate={snapshotDate}
            />

            <div className="flex-1 flex flex-col justify-center gap-7 py-4">
              {/* Top identity + monumental figure */}
              <div className="flex items-center justify-between gap-8">
                <div className="flex items-center gap-5 min-w-0 flex-1">
                  <CardThumb
                    src={game.iconUrl || game.thumbnailUrl}
                    alt={game.name}
                    size={isSquare ? 140 : 120}
                    radius={20}
                  />
                  <div className="min-w-0 space-y-2">
                    <div
                      style={{ color: '#D97706' }}
                      className="text-[14px] font-bold"
                    >
                      Milestone Reached · {game.creatorName}
                    </div>
                    <h2
                      style={{
                        color: '#0F172A',
                        letterSpacing: '-0.03em',
                        textWrap: 'balance',
                      }}
                      className={`${isSquare ? 'text-[38px]' : 'text-[34px]'} font-bold leading-[1.12]`}
                    >
                      {headline}
                    </h2>
                    <div
                      style={{ color: '#475569' }}
                      className="text-[15px] font-medium"
                    >
                      {milestone.subDetail}
                    </div>
                  </div>
                </div>
              </div>

              {/* Monumental readout + progress bar */}
              <div
                style={{
                  backgroundColor: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                }}
                className="rounded-2xl px-7 py-6 space-y-4"
              >
                <div className="flex items-baseline justify-between gap-4">
                  <div className="flex items-baseline gap-4">
                    <span
                      style={{ color: '#0F172A', letterSpacing: '-0.04em' }}
                      className={`${isSquare ? 'text-[76px]' : 'text-[68px]'} font-mono font-extrabold tabular-nums leading-none`}
                    >
                      {milestone.heroValue}
                    </span>
                    <span
                      style={{ color: '#475569' }}
                      className="text-[20px] font-semibold"
                    >
                      {milestone.heroUnit}
                    </span>
                  </div>
                  <span
                    style={{ color: '#D97706' }}
                    className="font-mono text-[16px] font-bold tabular-nums"
                  >
                    {milestone.progressPct}%
                  </span>
                </div>

                <div className="space-y-1.5">
                  <div
                    style={{
                      height: 12,
                      backgroundColor: '#E2E8F0',
                      borderRadius: 999,
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        width: `${Math.max(6, milestone.progressPct)}%`,
                        height: '100%',
                        backgroundColor: '#D97706',
                        borderRadius: 999,
                      }}
                    />
                  </div>
                  <div
                    style={{ color: '#64748B' }}
                    className="flex items-center justify-between text-[13px] font-medium"
                  >
                    <span>{milestone.progressLabel}</span>
                    <span className="font-mono tabular-nums">
                      Verified via Roblox Games API
                    </span>
                  </div>
                </div>
              </div>

              {/* 3-column supporting data strip */}
              <div className="grid grid-cols-3 gap-4">
                <div
                  style={{ border: '1px solid #E2E8F0' }}
                  className="rounded-xl px-5 py-4"
                >
                  <div style={{ color: '#64748B' }} className="text-[13px] font-medium">
                    Live Concurrent Players
                  </div>
                  <div
                    style={{ color: '#0F172A' }}
                    className="text-[26px] font-mono font-bold tabular-nums mt-1"
                  >
                    {formatExactNumber(game.currentCcu)}
                  </div>
                </div>

                <div
                  style={{ border: '1px solid #E2E8F0' }}
                  className="rounded-xl px-5 py-4"
                >
                  <div style={{ color: '#64748B' }} className="text-[13px] font-medium">
                    Observed Peak CCU
                  </div>
                  <div
                    style={{ color: '#0F172A' }}
                    className="text-[26px] font-mono font-bold tabular-nums mt-1"
                  >
                    {formatExactNumber(peak)}
                  </div>
                </div>

                <div
                  style={{ border: '1px solid #E2E8F0' }}
                  className="rounded-xl px-5 py-4"
                >
                  <div style={{ color: '#64748B' }} className="text-[13px] font-medium">
                    {showRevenue ? 'Est. Monthly DevEx' : 'Player Rating'}
                  </div>
                  <div
                    style={{ color: '#0F172A' }}
                    className="text-[26px] font-mono font-bold tabular-nums mt-1"
                  >
                    {showRevenue
                      ? formatCurrencyCompact(rev.monthlyUsd)
                      : game.likeRatio !== null && game.likeRatio !== undefined
                        ? `${game.likeRatio.toFixed(1)}%`
                        : 'N/A'}
                  </div>
                </div>
              </div>
            </div>

            <CardFooter
              leftNote="Historical peaks & milestone telemetry tracked continuously"
              rightLink={`rometrics.vercel.app/games/${game.universeId}`}
              showFooterUrl={showFooterUrl}
            />
          </>
        );
      })()}

      {/* 4. NEW ACTIVE GAME CODE DROP CARD */}
      {template === 'codes' && (() => {
        const displayCodes = selectedCodes.slice(0, 6);
        const gameName = codeGame?.name || primaryGame?.name || 'Roblox Game';
        const creatorName =
          codeGame?.creatorName || primaryGame?.creatorName || 'Roblox Creator';
        const liveCcu = codeGame?.currentCcu ?? primaryGame?.currentCcu ?? 0;
        const slug = codeGame?.slug || primaryGame?.slug || '';
        const iconUrl =
          codeGame?.iconUrl ||
          codeGame?.thumbnailUrl ||
          primaryGame?.iconUrl ||
          primaryGame?.thumbnailUrl;
        const headline =
          customHeadline.trim() || `${gameName} — Working Active Codes`;

        return (
          <>
            <CardHeader
              kicker="Verified Game Codes"
              showTimestamp={showTimestamp}
              snapshotDate={snapshotDate}
            />

            <div className="flex-1 flex flex-col justify-between py-4 gap-5">
              {/* Game identity header */}
              <div className="flex items-center justify-between gap-6">
                <div className="flex items-center gap-4 min-w-0">
                  <CardThumb
                    src={iconUrl}
                    alt={gameName}
                    size={isSquare ? 88 : 74}
                    radius={14}
                  />
                  <div className="min-w-0 space-y-1">
                    <div
                      style={{ color: '#16A34A' }}
                      className="text-[14px] font-bold"
                    >
                      Verified Active · {displayCodes.length}{' '}
                      {displayCodes.length === 1 ? 'Code' : 'Codes'} Listed
                    </div>
                    <h2
                      style={{
                        color: '#0F172A',
                        letterSpacing: '-0.03em',
                        textWrap: 'balance',
                      }}
                      className={`${isSquare ? 'text-[34px]' : 'text-[30px]'} font-bold leading-tight truncate`}
                    >
                      {headline}
                    </h2>
                    <div
                      style={{ color: '#64748B' }}
                      className="text-[14px] font-medium"
                    >
                      {creatorName} · {formatCompactNumber(liveCcu)} live players
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    backgroundColor: '#F0FDF4',
                    border: '1px solid #BBF7D0',
                  }}
                  className="shrink-0 rounded-xl px-5 py-3 text-right"
                >
                  <div style={{ color: '#15803D' }} className="text-[12px] font-semibold">
                    Status
                  </div>
                  <div
                    style={{ color: '#16A34A' }}
                    className="text-[20px] font-bold leading-tight mt-0.5"
                  >
                    Active Now
                  </div>
                </div>
              </div>

              {/* Clean 2-column structured codes grid */}
              {displayCodes.length === 0 ? (
                <div
                  style={{
                    backgroundColor: '#F8FAFC',
                    border: '1px solid #E2E8F0',
                    color: '#475569',
                  }}
                  className="flex-1 rounded-2xl flex flex-col items-center justify-center p-8 text-center gap-2"
                >
                  <div style={{ color: '#0F172A' }} className="text-[18px] font-bold">
                    No active codes selected for this game
                  </div>
                  <div className="text-[14px] max-w-md">
                    Pick a game with verified codes in the left panel or run a collection sync from the Game Codes tab.
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3.5 flex-1 content-center">
                  {displayCodes.map((codeItem) => (
                    <div
                      key={codeItem.id}
                      style={{
                        backgroundColor: '#F8FAFC',
                        border: '1px solid #E2E8F0',
                      }}
                      className="rounded-xl px-5 py-4 flex flex-col justify-between gap-1.5"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span
                          style={{ color: '#0F172A', letterSpacing: '0.01em' }}
                          className={`${isSquare ? 'text-[22px]' : 'text-[20px]'} font-mono font-extrabold tabular-nums truncate`}
                        >
                          {codeItem.code}
                        </span>
                        <span
                          style={{ color: '#16A34A' }}
                          className="text-[12px] font-bold shrink-0"
                        >
                          Active
                        </span>
                      </div>
                      <div
                        style={{ color: '#475569' }}
                        className="text-[13px] font-medium truncate"
                      >
                        {codeItem.rewardDescription || 'In-game rewards & boosts'}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Copy hint strip */}
              <div
                style={{
                  backgroundColor: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  color: '#475569',
                }}
                className="rounded-xl px-5 py-3 flex items-center justify-between text-[13px] font-medium"
              >
                <span>
                  Redeem in-game before codes expire · Case-sensitive on Roblox
                </span>
                <span style={{ color: '#0F172A' }} className="font-semibold">
                  1-Click Copy on RoMetric
                </span>
              </div>
            </div>

            <CardFooter
              leftNote="Verified active Roblox codes updated continuously"
              rightLink={
                slug
                  ? `rometrics.vercel.app/codes/${slug}`
                  : 'rometrics.vercel.app/codes'
              }
              showFooterUrl={showFooterUrl}
            />
          </>
        );
      })()}

      {/* 5. GAME VS GAME HEAD-TO-HEAD COMPARISON */}
      {template === 'vs' && (() => {
        const a = primaryGame;
        const b = secondaryGame;
        if (!a || !b) {
          return (
            <div className="flex-1 flex items-center justify-center text-slate-500">
              Select two games to preview the Head-to-Head comparison.
            </div>
          );
        }

        const revA = estimateGameRevenue(a);
        const revB = estimateGameRevenue(b);
        const peakA = Math.max(a.currentCcu, a.peakCcuObserved || 0);
        const peakB = Math.max(b.currentCcu, b.peakCcuObserved || 0);
        const growthA = a.growth24h ?? a.growth1h ?? 0;
        const growthB = b.growth24h ?? b.growth1h ?? 0;
        const headline =
          customHeadline.trim() || `${a.name} vs ${b.name}`;

        const rows: Array<{
          label: string;
          valA: string;
          valB: string;
          numA: number;
          numB: number;
          allowNegative?: boolean;
        }> = [
          {
            label: 'Live Players (CCU)',
            valA: formatExactNumber(a.currentCcu),
            valB: formatExactNumber(b.currentCcu),
            numA: a.currentCcu,
            numB: b.currentCcu,
          },
          {
            label: '24h Momentum',
            valA:
              a.growth24h !== null && a.growth24h !== undefined
                ? formatPercent(a.growth24h)
                : a.growth1h !== null && a.growth1h !== undefined
                  ? formatPercent(a.growth1h)
                  : 'N/A',
            valB:
              b.growth24h !== null && b.growth24h !== undefined
                ? formatPercent(b.growth24h)
                : b.growth1h !== null && b.growth1h !== undefined
                  ? formatPercent(b.growth1h)
                  : 'N/A',
            numA: growthA,
            numB: growthB,
            allowNegative: true,
          },
          {
            label: 'Observed Peak CCU',
            valA: formatCompactNumber(peakA),
            valB: formatCompactNumber(peakB),
            numA: peakA,
            numB: peakB,
          },
          {
            label: 'Lifetime Visits',
            valA: formatCompactNumber(a.totalVisits),
            valB: formatCompactNumber(b.totalVisits),
            numA: a.totalVisits,
            numB: b.totalVisits,
          },
          showRevenue
            ? {
                label: 'Est. Monthly DevEx',
                valA: formatCurrencyCompact(revA.monthlyUsd),
                valB: formatCurrencyCompact(revB.monthlyUsd),
                numA: revA.monthlyUsd,
                numB: revB.monthlyUsd,
              }
            : {
                label: 'Player Rating',
                valA:
                  a.likeRatio !== null && a.likeRatio !== undefined
                    ? `${a.likeRatio.toFixed(1)}%`
                    : 'N/A',
                valB:
                  b.likeRatio !== null && b.likeRatio !== undefined
                    ? `${b.likeRatio.toFixed(1)}%`
                    : 'N/A',
                numA: a.likeRatio ?? 0,
                numB: b.likeRatio ?? 0,
              },
        ];

        return (
          <>
            <CardHeader
              kicker="Head-to-Head Comparison"
              showTimestamp={showTimestamp}
              snapshotDate={snapshotDate}
            />

            <div className="pt-3.5 pb-3 shrink-0">
              <h2
                style={{
                  color: '#0F172A',
                  letterSpacing: '-0.03em',
                  textWrap: 'balance',
                }}
                className={`${isSquare ? 'text-[32px]' : 'text-[27px]'} font-bold leading-tight text-center`}
              >
                {headline}
              </h2>
            </div>

            {/* Competitor Identity Strip */}
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 pb-4 shrink-0">
              <div
                style={{
                  backgroundColor: '#F8FAFC',
                  border: '1px solid #CBD5E1',
                }}
                className="flex items-center gap-3.5 px-4 py-3 rounded-xl min-w-0"
              >
                <CardThumb
                  src={a.iconUrl || a.thumbnailUrl}
                  alt={a.name}
                  size={isSquare ? 60 : 50}
                  radius={10}
                />
                <div className="min-w-0 flex-1">
                  <div
                    style={{ color: '#0F172A' }}
                    className="text-[17px] font-bold truncate"
                  >
                    {a.name}
                  </div>
                  <div
                    style={{ color: '#64748B' }}
                    className="text-[13px] font-medium truncate"
                  >
                    {a.creatorName} · {a.genre || 'Experience'}
                  </div>
                </div>
              </div>

              <div
                style={{ color: '#64748B' }}
                className="font-mono text-[14px] font-bold px-2"
              >
                VS
              </div>

              <div
                style={{
                  backgroundColor: '#EFF6FF',
                  border: '1px solid #BFDBFE',
                }}
                className="flex items-center justify-end gap-3.5 px-4 py-3 rounded-xl min-w-0 text-right"
              >
                <div className="min-w-0 flex-1">
                  <div
                    style={{ color: '#1E3A8A' }}
                    className="text-[17px] font-bold truncate"
                  >
                    {b.name}
                  </div>
                  <div
                    style={{ color: '#3B82F6' }}
                    className="text-[13px] font-medium truncate"
                  >
                    {b.creatorName} · {b.genre || 'Experience'}
                  </div>
                </div>
                <CardThumb
                  src={b.iconUrl || b.thumbnailUrl}
                  alt={b.name}
                  size={isSquare ? 60 : 50}
                  radius={10}
                />
              </div>
            </div>

            {/* 5 Aligned Metric Comparison Rows */}
            <div className="flex-1 flex flex-col justify-between py-1">
              {rows.map((row) => {
                const aWins = row.numA > row.numB;
                const bWins = row.numB > row.numA;

                let shareA = 50;
                let shareB = 50;
                if (row.allowNegative) {
                  const maxAbs = Math.max(
                    1,
                    Math.abs(row.numA),
                    Math.abs(row.numB)
                  );
                  shareA = Math.max(8, Math.round((Math.abs(row.numA) / maxAbs) * 100));
                  shareB = Math.max(8, Math.round((Math.abs(row.numB) / maxAbs) * 100));
                } else {
                  const maxVal = Math.max(1, row.numA, row.numB);
                  shareA = Math.max(6, Math.round((row.numA / maxVal) * 100));
                  shareB = Math.max(6, Math.round((row.numB / maxVal) * 100));
                }

                return (
                  <div
                    key={row.label}
                    style={{ borderBottom: '1px solid #F1F5F9' }}
                    className={`grid grid-cols-[150px_1fr_170px_1fr_150px] items-center gap-3 ${isSquare ? 'py-4' : 'py-2.5'}`}
                  >
                    {/* Value A */}
                    <div
                      style={{
                        color: aWins ? '#0F172A' : '#64748B',
                      }}
                      className="font-mono text-[16px] font-bold tabular-nums text-left"
                    >
                      {row.valA}
                      {aWins && (
                        <span
                          style={{ color: '#16A34A' }}
                          className="ml-1.5 text-[12px]"
                        >
                          ▲
                        </span>
                      )}
                    </div>

                    {/* Bar A (right-aligned toward center) */}
                    <div
                      style={{
                        height: 10,
                        backgroundColor: '#F1F5F9',
                        borderRadius: 999,
                        overflow: 'hidden',
                      }}
                      className="flex justify-end"
                    >
                      <div
                        style={{
                          width: `${shareA}%`,
                          height: '100%',
                          backgroundColor: aWins ? '#0F172A' : '#94A3B8',
                          borderRadius: 999,
                        }}
                      />
                    </div>

                    {/* Center Label */}
                    <div
                      style={{ color: '#475569' }}
                      className="text-[13px] font-semibold text-center whitespace-nowrap"
                    >
                      {row.label}
                    </div>

                    {/* Bar B (left-aligned from center) */}
                    <div
                      style={{
                        height: 10,
                        backgroundColor: '#F1F5F9',
                        borderRadius: 999,
                        overflow: 'hidden',
                      }}
                      className="flex justify-start"
                    >
                      <div
                        style={{
                          width: `${shareB}%`,
                          height: '100%',
                          backgroundColor: bWins ? '#2563EB' : '#93C5FD',
                          borderRadius: 999,
                        }}
                      />
                    </div>

                    {/* Value B */}
                    <div
                      style={{
                        color: bWins ? '#1D4ED8' : '#64748B',
                      }}
                      className="font-mono text-[16px] font-bold tabular-nums text-right"
                    >
                      {bWins && (
                        <span
                          style={{ color: '#16A34A' }}
                          className="mr-1.5 text-[12px]"
                        >
                          ▲
                        </span>
                      )}
                      {row.valB}
                    </div>
                  </div>
                );
              })}
            </div>

            <CardFooter
              leftNote="Side-by-side live Roblox telemetry"
              rightLink={`rometrics.vercel.app/compare`}
              showFooterUrl={showFooterUrl}
            />
          </>
        );
      })()}
    </div>
  );
}
