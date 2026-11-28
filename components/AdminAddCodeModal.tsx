'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  CheckCircle2,
  Loader2,
  Plus,
  Search,
  ShieldAlert,
  ShieldCheck,
  X,
} from 'lucide-react';
import type { CodeStatus, GameCodeRecord } from '@/lib/codes-types';
import { cleanSeoGameName } from '@/lib/seo';
import { useApp } from './AppProvider';
import { APPLE_SPRING } from './MotionPrimitives';

export interface AdminCodeTargetGame {
  universeId: string;
  name: string;
  slug?: string;
  iconUrl?: string | null;
}

export interface AdminCodeAddedPayload {
  code?: GameCodeRecord;
  universeId?: string;
  gameSlug?: string;
  gameName?: string;
  message?: string;
}

export function AdminAddCodeModal({
  open,
  onClose,
  targetGame = null,
  directoryGames = [],
  onCodeAdded,
}: {
  open: boolean;
  onClose: () => void;
  targetGame?: AdminCodeTargetGame | null;
  directoryGames?: AdminCodeTargetGame[];
  onCodeAdded?: (result: AdminCodeAddedPayload) => void;
}) {
  const { user, isAdmin } = useApp();

  if (!isAdmin || !user) return null;

  return (
    <AnimatePresence>
      {open && (
        <AdminAddCodeDialog
          key={targetGame?.universeId || 'global-admin-add-code'}
          onClose={onClose}
          targetGame={targetGame}
          directoryGames={directoryGames}
          onCodeAdded={onCodeAdded}
        />
      )}
    </AnimatePresence>
  );
}

function AdminAddCodeDialog({
  onClose,
  targetGame,
  directoryGames,
  onCodeAdded,
}: {
  onClose: () => void;
  targetGame: AdminCodeTargetGame | null;
  directoryGames: AdminCodeTargetGame[];
  onCodeAdded?: (result: AdminCodeAddedPayload) => void;
}) {
  const { user, games: catalogGames } = useApp();

  const [gameInput, setGameInput] = useState(targetGame?.universeId || '');
  const [gameSearchText, setGameSearchText] = useState(
    targetGame ? cleanSeoGameName(targetGame.name) : ''
  );
  const [selectedGameLabel, setSelectedGameLabel] = useState<string | null>(
    targetGame ? cleanSeoGameName(targetGame.name) : null
  );
  const [showSuggestions, setShowSuggestions] = useState(false);

  const [code, setCode] = useState('');
  const [rewardDescription, setRewardDescription] = useState('');
  const [status, setStatus] = useState<CodeStatus>('active');
  const [sourceUrl, setSourceUrl] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const searchableGames = useMemo(() => {
    const map = new Map<string, AdminCodeTargetGame>();
    for (const g of directoryGames) {
      if (!map.has(g.universeId)) {
        map.set(g.universeId, g);
      }
    }
    for (const g of catalogGames) {
      if (!map.has(g.universeId)) {
        map.set(g.universeId, {
          universeId: g.universeId,
          name: g.name,
          slug: g.slug,
          iconUrl: g.iconUrl,
        });
      }
    }
    return Array.from(map.values());
  }, [directoryGames, catalogGames]);

  const matchedGames = useMemo(() => {
    if (targetGame) return [];
    const q = gameSearchText.trim().toLowerCase();
    if (!q) return searchableGames.slice(0, 6);
    return searchableGames
      .filter(
        (g) =>
          g.name.toLowerCase().includes(q) ||
          g.universeId.includes(q) ||
          (g.slug || '').toLowerCase().includes(q)
      )
      .slice(0, 6);
  }, [targetGame, gameSearchText, searchableGames]);

  const saveCode = async (keepOpen: boolean) => {
    setErrorMsg(null);
    setSuccessMsg(null);

    const effectiveGameInput = (
      targetGame?.universeId ||
      gameInput ||
      gameSearchText
    ).trim();

    if (!effectiveGameInput) {
      setErrorMsg('Choose a game or paste a Roblox Game URL / Universe ID.');
      return;
    }

    const trimmedCode = code.trim();
    if (trimmedCode.length < 3 || /\s/.test(trimmedCode)) {
      setErrorMsg(
        'Enter a valid promo code (3–42 characters, no spaces).'
      );
      return;
    }

    setSubmitting(true);
    try {
      const token = await user?.getIdToken();
      if (!token) {
        setErrorMsg('Admin session expired. Please sign in again.');
        return;
      }

      const res = await fetch('/api/codes/admin', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'admin_add_code',
          gameInput: effectiveGameInput,
          code: trimmedCode,
          rewardDescription: rewardDescription.trim() || null,
          status,
          sourceUrl: sourceUrl.trim() || null,
        }),
      });

      const data = (await res.json()) as {
        ok?: boolean;
        message?: string;
        error?: string;
        code?: GameCodeRecord;
        gameSlug?: string;
        universeId?: string;
        gameName?: string;
      };

      if (!res.ok || !data.ok) {
        setErrorMsg(
          data.message || data.error || 'Unable to save this code right now.'
        );
        return;
      }

      onCodeAdded?.({
        code: data.code,
        universeId: data.universeId,
        gameSlug: data.gameSlug,
        gameName: data.gameName,
        message: data.message,
      });

      if (keepOpen) {
        setSuccessMsg(data.message || `Added "${trimmedCode}" successfully.`);
        setCode('');
        setRewardDescription('');
      } else {
        onClose();
      }
    } catch {
      setErrorMsg('Network error saving code. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void saveCode(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.16 }}
      className="fixed inset-0 z-[85] bg-slate-950/65 backdrop-blur-md flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 10 }}
        transition={APPLE_SPRING}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg liquid-glass-strong rounded-[28px] overflow-hidden shadow-2xl border border-emerald-500/25"
      >
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-slate-900/8 dark:border-white/10">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-emerald-600 dark:text-[#10E89A]">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Admin Tool</span>
            </div>
            <h2 className="font-display text-lg font-bold text-slate-950 dark:text-white truncate">
              {targetGame
                ? `Add Code — ${cleanSeoGameName(targetGame.name)}`
                : 'Add New Game Code'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close add code dialog"
            className="p-2 rounded-full text-slate-500 dark:text-[#9CB3C0] hover:text-slate-950 dark:hover:text-white hover:bg-black/[0.05] dark:hover:bg-white/[0.08] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Target Game Selector (Locked when opened on a specific game page) */}
          {targetGame ? (
            <div className="px-4 py-3 rounded-2xl bg-emerald-500/[0.08] dark:bg-[#10E89A]/[0.08] border border-emerald-500/25 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-medium text-emerald-700 dark:text-[#10E89A]">
                  Target Experience
                </p>
                <p className="text-sm font-bold text-slate-950 dark:text-white truncate">
                  {cleanSeoGameName(targetGame.name)}
                </p>
              </div>
              <span className="text-xs font-mono text-slate-500 dark:text-[#9CB3C0] shrink-0">
                ID {targetGame.universeId}
              </span>
            </div>
          ) : (
            <div className="space-y-1.5 relative">
              <label
                htmlFor="admin-game-search"
                className="block text-xs font-semibold text-slate-700 dark:text-[#C8D9E2]"
              >
                Game (Search, Universe ID, or Roblox URL) *
              </label>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 dark:text-[#7B95A5] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="admin-game-search"
                  type="text"
                  required
                  value={gameSearchText}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => {
                    window.setTimeout(() => setShowSuggestions(false), 160);
                  }}
                  onChange={(e) => {
                    const val = e.target.value;
                    setGameSearchText(val);
                    setGameInput(val);
                    setSelectedGameLabel(null);
                    setShowSuggestions(true);
                  }}
                  placeholder="Type game name (e.g. Blox Fruits), Universe ID, or Roblox link..."
                  className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl bg-black/[0.03] dark:bg-white/[0.05] border border-slate-900/12 dark:border-white/12 text-slate-900 dark:text-[#F1F7FA] placeholder:text-slate-400 dark:placeholder:text-[#6F8796] focus:outline-none focus:ring-2 focus:ring-emerald-500/40 dark:focus:ring-[#10E89A]/40"
                />
              </div>

              {selectedGameLabel && (
                <p className="text-[11px] text-emerald-700 dark:text-[#10E89A] font-medium">
                  Selected: {selectedGameLabel} (Universe ID {gameInput})
                </p>
              )}

              {showSuggestions && matchedGames.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1.5 z-20 rounded-2xl liquid-glass-strong border border-slate-900/12 dark:border-white/15 shadow-xl overflow-hidden max-h-52 overflow-y-auto divide-y divide-slate-900/6 dark:divide-white/8">
                  {matchedGames.map((g) => (
                    <button
                      key={g.universeId}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        const clean = cleanSeoGameName(g.name);
                        setGameInput(g.universeId);
                        setGameSearchText(clean);
                        setSelectedGameLabel(clean);
                        setShowSuggestions(false);
                      }}
                      className="w-full px-3.5 py-2.5 text-left flex items-center justify-between gap-3 hover:bg-emerald-500/10 dark:hover:bg-[#10E89A]/12 transition-colors cursor-pointer"
                    >
                      <span className="text-xs font-semibold text-slate-900 dark:text-[#F1F7FA] truncate">
                        {cleanSeoGameName(g.name)}
                      </span>
                      <span className="text-[11px] font-mono text-slate-500 dark:text-[#7893A3] shrink-0">
                        {g.universeId}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Promo Code + Status Row */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            <div className="sm:col-span-7 space-y-1.5">
              <label
                htmlFor="admin-code-string"
                className="block text-xs font-semibold text-slate-700 dark:text-[#C8D9E2]"
              >
                Promo Code *
              </label>
              <input
                id="admin-code-string"
                type="text"
                required
                autoFocus={Boolean(targetGame)}
                maxLength={42}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g. UPDATE26FREE"
                className="w-full px-4 py-2.5 text-sm font-mono font-bold rounded-xl bg-black/[0.03] dark:bg-white/[0.05] border border-slate-900/12 dark:border-white/12 text-slate-900 dark:text-[#F1F7FA] placeholder:text-slate-400 dark:placeholder:text-[#6F8796] focus:outline-none focus:ring-2 focus:ring-emerald-500/40 dark:focus:ring-[#10E89A]/40"
              />
            </div>

            <div className="sm:col-span-5 space-y-1.5">
              <label
                htmlFor="admin-code-status"
                className="block text-xs font-semibold text-slate-700 dark:text-[#C8D9E2]"
              >
                Status
              </label>
              <select
                id="admin-code-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as CodeStatus)}
                className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-black/[0.03] dark:bg-white/[0.05] border border-slate-900/12 dark:border-white/12 text-slate-900 dark:text-[#F1F7FA] focus:outline-none focus:ring-2 focus:ring-emerald-500/40 cursor-pointer"
              >
                <option
                  value="active"
                  className="bg-white dark:bg-[#0D1A22] text-slate-900 dark:text-white"
                >
                  Active (Live)
                </option>
                <option
                  value="pending_verification"
                  className="bg-white dark:bg-[#0D1A22] text-slate-900 dark:text-white"
                >
                  Pending Verification
                </option>
                <option
                  value="expired"
                  className="bg-white dark:bg-[#0D1A22] text-slate-900 dark:text-white"
                >
                  Expired
                </option>
                <option
                  value="unverified"
                  className="bg-white dark:bg-[#0D1A22] text-slate-900 dark:text-white"
                >
                  Unverified
                </option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="admin-code-reward"
              className="block text-xs font-semibold text-slate-700 dark:text-[#C8D9E2]"
            >
              Reward Description
            </label>
            <input
              id="admin-code-reward"
              type="text"
              maxLength={180}
              value={rewardDescription}
              onChange={(e) => setRewardDescription(e.target.value)}
              placeholder="e.g. 2x XP for 20 minutes or 500 Gems"
              className="w-full px-4 py-2.5 text-sm rounded-xl bg-black/[0.03] dark:bg-white/[0.05] border border-slate-900/12 dark:border-white/12 text-slate-900 dark:text-[#F1F7FA] placeholder:text-slate-400 dark:placeholder:text-[#6F8796] focus:outline-none focus:ring-2 focus:ring-emerald-500/40 dark:focus:ring-[#10E89A]/40"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="admin-code-source"
              className="block text-xs font-semibold text-slate-700 dark:text-[#C8D9E2]"
            >
              Source URL (optional)
            </label>
            <input
              id="admin-code-source"
              type="url"
              maxLength={400}
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              placeholder="https://..."
              className="w-full px-4 py-2.5 text-sm rounded-xl bg-black/[0.03] dark:bg-white/[0.05] border border-slate-900/12 dark:border-white/12 text-slate-900 dark:text-[#F1F7FA] placeholder:text-slate-400 dark:placeholder:text-[#6F8796] focus:outline-none focus:ring-2 focus:ring-emerald-500/40 dark:focus:ring-[#10E89A]/40"
            />
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-xs text-emerald-700 dark:text-[#10E89A] flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          <div className="pt-2 flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-full text-xs font-semibold text-slate-600 dark:text-[#9CB3C0] hover:text-slate-950 dark:hover:text-white transition-colors cursor-pointer"
            >
              Close
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={() => void saveCode(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full text-xs font-semibold liquid-glass-pill text-slate-800 dark:text-[#F1F7FA] hover:border-emerald-500/45 transition-colors cursor-pointer disabled:opacity-50"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Save &amp; Add Another</span>
            </button>
            <motion.button
              type="submit"
              disabled={submitting}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.96 }}
              transition={APPLE_SPRING}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-semibold bg-emerald-600 dark:bg-[#10E89A] text-white dark:text-[#04130D] hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50"
            >
              {submitting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Plus className="w-3.5 h-3.5" />
              )}
              <span>{submitting ? 'Saving...' : 'Add Code'}</span>
            </motion.button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}
