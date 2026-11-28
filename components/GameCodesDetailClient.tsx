'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BarChart2,
  CheckCircle2,
  ChevronDown,
  Clock,
  ExternalLink,
  Info,
  Plus,
  ShieldCheck,
  Ticket,
} from 'lucide-react';
import {
  formatCompactNumber,
  formatRelativeTime,
  formatUtcTimestamp,
} from '@/lib/format';
import type {
  GameCodeRecord,
  GameCodesDetailPayload,
} from '@/lib/codes-types';
import { useApp } from './AppProvider';
import {
  AdminAddCodeModal,
  type AdminCodeAddedPayload,
} from './AdminAddCodeModal';
import { GameArtwork } from './GameArtwork';
import { CodeCard } from './CodeCard';
import {
  APPLE_EASE,
  APPLE_SPRING,
  FadeInSection,
  LiquidGlassCard,
} from './MotionPrimitives';
import {
  buildCodeFaqItems,
  buildGameUrlPath,
  cleanSeoGameName,
  getCurrentMonthYear,
} from '@/lib/seo';

export function GameCodesDetailClient({
  initialPayload,
  monthYear,
}: {
  initialPayload: GameCodesDetailPayload;
  monthYear?: string;
}) {
  const router = useRouter();
  const { user, isAdmin } = useApp();
  const canAdminManage = Boolean(isAdmin && user);

  const [payload, setPayload] = useState<GameCodesDetailPayload>(initialPayload);
  const [showExpired, setShowExpired] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [busyCodeKey, setBusyCodeKey] = useState<string | null>(null);
  const [adminBanner, setAdminBanner] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const effectiveMonthYear = monthYear || getCurrentMonthYear();
  const initialUniverseId = initialPayload.game?.universeId ?? '';

  useEffect(() => {
    setPayload(initialPayload);
  }, [initialUniverseId, initialPayload]);

  const game = payload.game;

  const refreshFromServer = useCallback(
    async (slugOrId: string) => {
      if (!user) return;
      try {
        const token = await user.getIdToken();
        const res = await fetch(
          `/api/codes/${encodeURIComponent(slugOrId)}?fresh=1`,
          {
            method: 'GET',
            headers: { Authorization: `Bearer ${token}` },
            cache: 'no-store',
          }
        );
        if (res.ok) {
          const fresh = (await res.json()) as GameCodesDetailPayload;
          if (fresh.game) {
            setPayload(fresh);
          }
        }
      } catch {
        // Keep optimistic state if refresh fails
      } finally {
        router.refresh();
      }
    },
    [user, router]
  );

  const handleCodeAdded = useCallback(
    (result: AdminCodeAddedPayload) => {
      if (result.code) {
        const added = result.code;
        setPayload((prev) => ({
          ...prev,
          codes: [
            added,
            ...prev.codes.filter(
              (c) => c.normalizedCode !== added.normalizedCode
            ),
          ],
        }));
      }
      setAdminBanner({
        type: 'success',
        text: result.message || 'Code added successfully.',
      });
      if (game) {
        void refreshFromServer(game.slug || game.universeId);
      }
    },
    [game, refreshFromServer]
  );

  const handleAdminDeleteCode = useCallback(
    async (item: GameCodeRecord) => {
      if (!user || !isAdmin || !game) return;
      const key = `${item.id}:${item.normalizedCode}`;
      if (busyCodeKey) return;
      setBusyCodeKey(key);
      setAdminBanner(null);
      try {
        const token = await user.getIdToken();
        const res = await fetch('/api/codes/admin', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'admin_delete_code',
            codeId: item.id,
            universeId: game.universeId,
            code: item.code,
          }),
        });
        const data = (await res.json()) as {
          ok?: boolean;
          message?: string;
          error?: string;
        };
        if (!res.ok || !data.ok) {
          throw new Error(data.error || data.message || 'Failed to delete code.');
        }

        setPayload((prev) => ({
          ...prev,
          codes: prev.codes.filter(
            (c) => c.normalizedCode !== item.normalizedCode
          ),
        }));
        setAdminBanner({
          type: 'success',
          text: `Deleted code "${item.code}".`,
        });
        void refreshFromServer(game.slug || game.universeId);
      } catch (err) {
        setAdminBanner({
          type: 'error',
          text: err instanceof Error ? err.message : 'Failed to delete code.',
        });
      } finally {
        setBusyCodeKey(null);
      }
    },
    [user, isAdmin, game, busyCodeKey, refreshFromServer]
  );

  const handleAdminToggleStatus = useCallback(
    async (item: GameCodeRecord, nextStatus: 'active' | 'expired') => {
      if (!user || !isAdmin || !game) return;
      const key = `${item.id}:${item.normalizedCode}`;
      if (busyCodeKey) return;
      setBusyCodeKey(key);
      setAdminBanner(null);
      try {
        const token = await user.getIdToken();
        const res = await fetch('/api/codes/admin', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'moderate_code',
            codeId: item.id,
            universeId: game.universeId,
            code: item.code,
            modAction: nextStatus === 'active' ? 'approve_active' : 'mark_expired',
          }),
        });
        const data = (await res.json()) as {
          ok?: boolean;
          message?: string;
          error?: string;
        };
        if (!res.ok || !data.ok) {
          throw new Error(
            data.error || data.message || 'Failed to update code status.'
          );
        }

        const nowIso = new Date().toISOString();
        setPayload((prev) => ({
          ...prev,
          codes: prev.codes.map((c) =>
            c.normalizedCode === item.normalizedCode
              ? { ...c, status: nextStatus, updatedAt: nowIso, lastVerifiedAt: nowIso }
              : c
          ),
        }));
        setAdminBanner({
          type: 'success',
          text: `Marked "${item.code}" as ${nextStatus}.`,
        });
        void refreshFromServer(game.slug || game.universeId);
      } catch (err) {
        setAdminBanner({
          type: 'error',
          text:
            err instanceof Error ? err.message : 'Failed to update code status.',
        });
      } finally {
        setBusyCodeKey(null);
      }
    },
    [user, isAdmin, game, busyCodeKey, refreshFromServer]
  );

  const { activeCodes, pendingAndUnverified, expiredCodes, usedSources } =
    useMemo(() => {
      const active = payload.codes.filter((c) => c.status === 'active');
      const other = payload.codes.filter(
        (c) => c.status === 'pending_verification' || c.status === 'unverified'
      );
      const expired = payload.codes.filter((c) => c.status === 'expired');

      const sourceIds = new Set(payload.codes.map((c) => c.sourceId));
      const sources = payload.sources.filter((s) => sourceIds.has(s.id));

      return {
        activeCodes: active,
        pendingAndUnverified: other,
        expiredCodes: expired,
        usedSources: sources,
      };
    }, [payload]);

  if (!game) {
    return (
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-16">
        <LiquidGlassCard className="max-w-md mx-auto rounded-3xl p-8 text-center space-y-4">
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-[#F1F7FA]">
            Game Codes Not Found
          </h1>
          <p className="text-sm text-slate-600 dark:text-[#9CB3C0]">
            We could not find this Roblox experience in our codes directory yet.
            Our automated tracker continuously adds every active game and scans
            official sources for promo codes.
          </p>
          <div className="flex items-center justify-center gap-3 pt-1">
            <Link
              href="/codes"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-emerald-600 dark:bg-[#10E89A] text-white dark:text-[#04130D] rounded-full"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Browse All Codes
            </Link>
          </div>
        </LiquidGlassCard>
      </div>
    );
  }

  const latestCheck =
    payload.codes[0]?.lastVerifiedAt ||
    payload.codes[0]?.updatedAt ||
    game.codesLastCheckedAt;
  const cleanName = cleanSeoGameName(game.name);
  const hasDifferentRawTitle = cleanName !== game.name.trim();

  return (
    <div className="max-w-[1280px] mx-auto px-4 sm:px-6 pt-6 sm:pt-8 pb-10 space-y-7">
      {/* Breadcrumb */}
      <div className="flex items-center justify-between gap-4 text-xs text-slate-500 dark:text-[#6F8796]">
        <div className="flex items-center gap-2 min-w-0">
          <Link
            href="/codes"
            className="hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            Codes
          </Link>
          <span>/</span>
          <span className="text-slate-700 dark:text-[#9CB3C0] truncate">
            {cleanName}
          </span>
        </div>
        {latestCheck && (
          <div className="flex items-center gap-1.5 tabular-nums shrink-0">
            <Clock className="w-3.5 h-3.5 text-emerald-600 dark:text-[#10E89A]" />
            <span>Verified {formatRelativeTime(latestCheck)}</span>
          </div>
        )}
      </div>

      {/* Admin Feedback Banner (Visible only to Admin after mutations) */}
      {canAdminManage && adminBanner && (
        <div
          className={`liquid-glass rounded-2xl px-4 py-3 text-xs flex items-center justify-between gap-3 ${
            adminBanner.type === 'success'
              ? 'border-emerald-500/40 text-slate-900 dark:text-[#F1F7FA]'
              : 'border-rose-500/40 text-rose-700 dark:text-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {adminBanner.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-[#10E89A] shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
            )}
            <span>{adminBanner.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setAdminBanner(null)}
            className="text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Hero Header */}
      <LiquidGlassCard
        variant="hero"
        exportTitle={`${cleanName} — Roblox Codes`}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.36, ease: APPLE_EASE }}
        className="rounded-[28px] p-5 sm:p-7"
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          <div className="lg:col-span-4">
            <GameArtwork
              src={game.thumbnailUrl || game.iconUrl}
              alt={`${cleanName} Roblox codes`}
              variant="banner"
            />
          </div>

          <div className="lg:col-span-8 space-y-4 pr-0 lg:pr-8">
            <div className="flex items-start gap-3.5">
              <div className="shrink-0 hidden sm:block">
                <GameArtwork src={game.iconUrl} alt={cleanName} size="md" />
              </div>
              <div className="min-w-0 space-y-1">
                <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-slate-950 dark:text-white tracking-tight text-balance">
                  {cleanName} Codes ({effectiveMonthYear})
                </h1>
                {hasDifferentRawTitle && (
                  <p className="text-xs text-slate-500 dark:text-[#7893A3] truncate">
                    Official Roblox title: {game.name}
                  </p>
                )}
                <p className="text-sm text-slate-600 dark:text-[#9CB3C0] flex flex-wrap items-center gap-x-2 gap-y-1">
                  <Link
                    href={`/developers/${game.creatorId}`}
                    className="font-medium text-slate-900 dark:text-[#F1F7FA] hover:text-emerald-600 dark:hover:text-[#10E89A] transition-colors"
                  >
                    {game.creatorName}
                  </Link>
                  {game.creatorVerified && (
                    <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-[#10E89A]" />
                  )}
                  <span aria-hidden="true">·</span>
                  <span>{game.genre}</span>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums">
                    {formatCompactNumber(game.currentCcu)} live players
                  </span>
                </p>
              </div>
            </div>

            {/* Clean Unboxed Stats Summary */}
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-1 text-xs tabular-nums">
              <div>
                <span className="text-slate-500 dark:text-[#7893A3]">
                  Active:{' '}
                </span>
                <strong className="text-emerald-600 dark:text-[#10E89A]">
                  {activeCodes.length}
                </strong>
              </div>
              <div>
                <span className="text-slate-500 dark:text-[#7893A3]">
                  Pending / Unverified:{' '}
                </span>
                <strong className="text-amber-600 dark:text-amber-400">
                  {pendingAndUnverified.length}
                </strong>
              </div>
              <div>
                <span className="text-slate-500 dark:text-[#7893A3]">
                  Expired Archive:{' '}
                </span>
                <strong className="text-slate-700 dark:text-[#C8D9E2]">
                  {expiredCodes.length}
                </strong>
              </div>
              {latestCheck && (
                <div>
                  <span className="text-slate-500 dark:text-[#7893A3]">
                    Last Verified (UTC):{' '}
                  </span>
                  <strong className="text-slate-700 dark:text-[#C8D9E2]">
                    {formatUtcTimestamp(latestCheck)}
                  </strong>
                </div>
              )}
            </div>

            {/* Primary Actions */}
            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <motion.a
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.96 }}
                transition={APPLE_SPRING}
                href={`https://www.roblox.com/games/${game.rootPlaceId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full text-xs font-semibold bg-emerald-600 dark:bg-[#10E89A] text-white dark:text-[#04130D] hover:opacity-90 transition-opacity whitespace-nowrap"
              >
                <span>Play on Roblox</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </motion.a>

              <Link
                href={buildGameUrlPath(game)}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full text-xs font-semibold liquid-glass-pill text-slate-800 dark:text-[#F1F7FA] hover:border-emerald-500/45 transition-colors whitespace-nowrap"
              >
                <BarChart2 className="w-3.5 h-3.5" />
                <span>Live Analytics</span>
              </Link>

              {canAdminManage && (
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.96 }}
                  transition={APPLE_SPRING}
                  onClick={() => setAddModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full text-xs font-semibold border border-emerald-500/45 bg-emerald-500/15 text-emerald-700 dark:text-[#10E89A] hover:bg-emerald-500/25 transition-colors whitespace-nowrap cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add New Code</span>
                </motion.button>
              )}
            </div>
          </div>
        </div>
      </LiquidGlassCard>

      {/* Active Codes Section */}
      <FadeInSection>
        <LiquidGlassCard
          exportTitle={`${cleanName} — Active Codes`}
          className="rounded-[28px] p-5 sm:p-6 space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 pr-9">
            <div className="flex items-center gap-2">
              <Ticket className="w-5 h-5 text-emerald-600 dark:text-[#10E89A]" />
              <h2 className="font-display text-lg font-bold text-slate-950 dark:text-white">
                Active {cleanName} Codes ({activeCodes.length})
              </h2>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium text-emerald-700 dark:text-[#10E89A]">
                Checked for {effectiveMonthYear}
              </span>
              {canAdminManage && (
                <button
                  type="button"
                  onClick={() => setAddModalOpen(true)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-600 dark:bg-[#10E89A] text-white dark:text-[#04130D] hover:opacity-90 transition-opacity cursor-pointer whitespace-nowrap"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Code</span>
                </button>
              )}
            </div>
          </div>

          {activeCodes.length > 0 ? (
            <div className="space-y-3">
              {activeCodes.map((c) => {
                const key = `${c.id}:${c.normalizedCode}`;
                return (
                  <CodeCard
                    key={key}
                    item={c}
                    isAdmin={canAdminManage}
                    busy={busyCodeKey === key}
                    onDelete={handleAdminDeleteCode}
                    onToggleStatus={handleAdminToggleStatus}
                  />
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-900/15 dark:border-white/15 p-6 space-y-3">
              <div className="space-y-2">
                <p className="text-sm font-semibold text-slate-900 dark:text-[#F1F7FA]">
                  {payload.codes.length === 0
                    ? 'No active codes detected yet'
                    : 'No active codes currently reported'}
                </p>
                <p className="text-xs text-slate-600 dark:text-[#9CB3C0] leading-relaxed max-w-2xl">
                  {payload.codes.length === 0
                    ? `RoMetric's automated discovery engine continuously checks ${cleanName}'s official Roblox description, developer group announcements, official Trello boards, Fandom & Wiki.gg databases, and partner feeds. New codes will appear here automatically as soon as they drop.`
                    : `All previously tracked codes for ${cleanName} are listed below in the Expired archive, and our automated engine keeps checking for new drops.`}
                </p>
              </div>
              {canAdminManage && (
                <button
                  type="button"
                  onClick={() => setAddModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold bg-emerald-600 dark:bg-[#10E89A] text-white dark:text-[#04130D] hover:opacity-90 transition-opacity cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Code to {cleanName}</span>
                </button>
              )}
            </div>
          )}
        </LiquidGlassCard>
      </FadeInSection>

      {/* Pending Verification & Unverified Codes (Honest Transparency) */}
      {pendingAndUnverified.length > 0 && (
        <FadeInSection>
          <LiquidGlassCard
            exportTitle={`${game.name} — Pending & Unverified Codes`}
            className="rounded-[28px] p-5 sm:p-6 space-y-4"
          >
            <div className="space-y-1 pr-9">
              <h2 className="font-display text-lg font-bold text-slate-950 dark:text-white">
                Pending Verification & Unverified ({pendingAndUnverified.length})
              </h2>
              <p className="text-xs text-slate-500 dark:text-[#8BA3B2]">
                These codes were recently submitted or discovered without
                independent confirmation. They are not marked Active until
                verified.
              </p>
            </div>
            <div className="space-y-3">
              {pendingAndUnverified.map((c) => {
                const key = `${c.id}:${c.normalizedCode}`;
                return (
                  <CodeCard
                    key={key}
                    item={c}
                    compact
                    isAdmin={canAdminManage}
                    busy={busyCodeKey === key}
                    onDelete={handleAdminDeleteCode}
                    onToggleStatus={handleAdminToggleStatus}
                  />
                );
              })}
            </div>
          </LiquidGlassCard>
        </FadeInSection>
      )}

      {/* Historical Expired Codes Archive */}
      {expiredCodes.length > 0 && (
        <FadeInSection>
          <LiquidGlassCard
            exportTitle={`${game.name} — Expired Codes`}
            className="rounded-[28px] p-5 sm:p-6 space-y-4"
          >
            <button
              type="button"
              onClick={() => setShowExpired((prev) => !prev)}
              className="w-full flex items-center justify-between gap-3 pr-9 text-left cursor-pointer"
            >
              <div>
                <h2 className="font-display text-lg font-bold text-slate-950 dark:text-white">
                  Expired Codes ({expiredCodes.length})
                </h2>
                <p className="text-xs text-slate-500 dark:text-[#8BA3B2]">
                  Preserved for historical reference so you do not waste time
                  re-testing old codes
                </p>
              </div>
              <ChevronDown
                className={`w-5 h-5 text-slate-500 dark:text-[#9CB3C0] transition-transform duration-200 ${
                  showExpired ? 'rotate-180' : ''
                }`}
              />
            </button>

            {showExpired && (
              <div className="space-y-2.5 pt-2">
                {expiredCodes.map((c) => {
                  const key = `${c.id}:${c.normalizedCode}`;
                  return (
                    <CodeCard
                      key={key}
                      item={c}
                      compact
                      isAdmin={canAdminManage}
                      busy={busyCodeKey === key}
                      onDelete={handleAdminDeleteCode}
                      onToggleStatus={handleAdminToggleStatus}
                    />
                  );
                })}
              </div>
            )}
          </LiquidGlassCard>
        </FadeInSection>
      )}

      {/* How to Redeem & Frequently Asked Questions (SEO + Player Guide) */}
      <FadeInSection>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <LiquidGlassCard
            hideCardActions
            className="lg:col-span-5 rounded-[24px] p-5 sm:p-6 space-y-3.5"
          >
            <h2 className="font-display text-base sm:text-lg font-bold text-slate-950 dark:text-white">
              How to Redeem {cleanSeoGameName(game.name)} Codes
            </h2>
            <ol className="space-y-2.5 text-xs sm:text-sm text-slate-600 dark:text-[#9CB3C0] leading-relaxed list-decimal list-inside">
              <li>
                Launch{' '}
                <strong className="text-slate-900 dark:text-[#F1F7FA]">
                  {cleanSeoGameName(game.name)}
                </strong>{' '}
                on Roblox (PC, mobile, or console).
              </li>
              <li>
                Open the in-game{' '}
                <strong className="text-slate-900 dark:text-[#F1F7FA]">
                  Codes
                </strong>{' '}
                menu (usually found on the side HUD, shop icon, gift box, or
                settings gear).
              </li>
              <li>
                Copy an active code above using the one-tap copy button and
                paste it into the text field.
              </li>
              <li>
                Press{' '}
                <strong className="text-slate-900 dark:text-[#F1F7FA]">
                  Redeem
                </strong>{' '}
                or{' '}
                <strong className="text-slate-900 dark:text-[#F1F7FA]">
                  Confirm
                </strong>{' '}
                to claim your in-game reward immediately.
              </li>
            </ol>
          </LiquidGlassCard>

          <LiquidGlassCard
            hideCardActions
            className="lg:col-span-7 rounded-[24px] p-5 sm:p-6 space-y-4"
          >
            <h2 className="font-display text-base sm:text-lg font-bold text-slate-950 dark:text-white">
              {cleanSeoGameName(game.name)} Codes FAQ ({effectiveMonthYear})
            </h2>
            <div className="divide-y divide-slate-900/6 dark:divide-white/8 space-y-3">
              {buildCodeFaqItems({
                gameName: game.name,
                activeCount: activeCodes.length,
                expiredCount: expiredCodes.length,
                monthYear: effectiveMonthYear,
                newestCode: activeCodes[0]?.code ?? null,
              }).map((faq, idx) => (
                <div key={faq.question} className={idx > 0 ? 'pt-3' : ''}>
                  <h3 className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-[#F1F7FA]">
                    {faq.question}
                  </h3>
                  <p className="mt-1 text-xs sm:text-sm text-slate-600 dark:text-[#8BA3B2] leading-relaxed">
                    {faq.answer}
                  </p>
                </div>
              ))}
            </div>
          </LiquidGlassCard>
        </div>
      </FadeInSection>

      {/* Mandatory Source Attribution & Licensing Box */}
      <FadeInSection>
        <LiquidGlassCard
          hideCardActions
          className="rounded-[24px] p-5 space-y-3"
        >
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-[#C8D9E2]">
            <Info className="w-4 h-4 text-emerald-600 dark:text-[#10E89A]" />
            <span>Source Attribution & Verification Policy</span>
          </div>
          <p className="text-xs text-slate-600 dark:text-[#8BA3B2] leading-relaxed">
            RoMetric never automates player accounts to redeem codes and never
            invents rewards or expiry dates. Status labels reflect what the
            listed provider or a verified RoMetric administrator last confirmed.
          </p>
          {usedSources.length > 0 && (
            <div className="pt-2 border-t border-slate-900/6 dark:border-white/8 flex flex-wrap gap-x-5 gap-y-2 text-xs">
              {usedSources.map((src) => (
                <div key={src.id} className="space-y-0.5">
                  {src.attributionUrl ? (
                    <a
                      href={src.attributionUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-emerald-700 dark:text-[#10E89A] hover:underline inline-flex items-center gap-1"
                    >
                      <span>{src.attributionLabel}</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  ) : (
                    <span className="font-semibold text-slate-800 dark:text-[#F1F7FA]">
                      {src.attributionLabel}
                    </span>
                  )}
                  {src.licenseNotice && (
                    <p className="text-[11px] text-slate-500 dark:text-[#7893A3]">
                      {src.licenseNotice}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </LiquidGlassCard>
      </FadeInSection>

      {/* Internal Links to Related Roblox Games With Active Codes */}
      {payload.relatedGames.length > 0 && (
        <FadeInSection className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-slate-950 dark:text-white">
              Related Roblox Games With Codes
            </h2>
            <Link
              href="/codes"
              className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-[#10E89A] hover:opacity-80 group"
            >
              <span>All Codes</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {payload.relatedGames.map((rel) => (
              <Link
                key={rel.universeId}
                href={`/codes/${encodeURIComponent(rel.slug)}`}
                className="group"
              >
                <LiquidGlassCard
                  interactive
                  hideCardActions
                  className="rounded-2xl p-3.5 flex items-center justify-between gap-3 hover:border-emerald-500/35 dark:hover:border-[#10E89A]/35"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <GameArtwork
                      src={rel.iconUrl}
                      alt={cleanSeoGameName(rel.name)}
                      size="sm"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 dark:text-[#F1F7FA] group-hover:text-emerald-600 dark:group-hover:text-[#10E89A] transition-colors truncate">
                        {cleanSeoGameName(rel.name)}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-[#7893A3] truncate tabular-nums">
                        {rel.genre} · {formatCompactNumber(rel.currentCcu)} CCU
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-emerald-600 dark:text-[#10E89A] tabular-nums shrink-0">
                    {rel.activeCodeCount} Active
                  </span>
                </LiquidGlassCard>
              </Link>
            ))}
          </div>
        </FadeInSection>
      )}

      {canAdminManage && (
        <AdminAddCodeModal
          open={addModalOpen}
          onClose={() => setAddModalOpen(false)}
          targetGame={{
            universeId: game.universeId,
            name: game.name,
            slug: game.slug,
            iconUrl: game.iconUrl,
          }}
          onCodeAdded={handleCodeAdded}
        />
      )}
    </div>
  );
}
