'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  ArrowUpRight,
  BarChart2,
  Compass,
  Flame,
  GitCompare,
  Home,
  Moon,
  Search,
  Sun,
  Users,
  X,
} from 'lucide-react';
import { useApp } from './AppProvider';
import { formatCompactNumber } from '@/lib/format';
import { GameArtwork } from './GameArtwork';

const NAV_LINKS = [
  { href: '/rankings', label: 'Rankings' },
  { href: '/trending', label: 'Trending' },
  { href: '/compare', label: 'Compare' },
  { href: '/developers', label: 'Developers' },
];

const MOBILE_DOCK_ITEMS = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/rankings', label: 'Rankings', icon: BarChart2 },
  { href: '/trending', label: 'Trending', icon: Flame },
  { href: '/compare', label: 'Compare', icon: GitCompare },
  { href: '/developers', label: 'Explore', icon: Compass },
];

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const {
    theme,
    toggleTheme,
    games,
    developers,
    searchOpen,
    setSearchOpen,
  } = useApp();
  const [queryText, setQueryText] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);

  const matchedGames = useMemo(() => {
    const q = queryText.trim().toLowerCase();
    if (!q) return games.slice(0, 6);
    return games
      .filter(
        (g) =>
          g.name.toLowerCase().includes(q) ||
          g.creatorName.toLowerCase().includes(q) ||
          g.universeId.includes(q) ||
          g.rootPlaceId.includes(q) ||
          g.genre.toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [games, queryText]);

  const matchedDevs = useMemo(() => {
    const q = queryText.trim().toLowerCase();
    if (!q) return [];
    return developers
      .filter((d) => d.creatorName.toLowerCase().includes(q))
      .slice(0, 3);
  }, [developers, queryText]);

  const canLookupLive = queryText.trim().length >= 2;

  const handleDirectLookup = async () => {
    if (!queryText.trim()) return;
    setLookupLoading(true);
    setLookupError(null);
    try {
      const res = await fetch(
        `/api/roblox/resolve?q=${encodeURIComponent(queryText.trim())}`
      );
      const data = await res.json();
      if (!res.ok || !data.game?.universeId) {
        setLookupError(data.error || 'Game not found.');
        return;
      }
      setSearchOpen(false);
      setQueryText('');
      router.push(`/games/${data.game.universeId}`);
    } catch {
      setLookupError('Unable to reach search service.');
    } finally {
      setLookupLoading(false);
    }
  };

  return (
    <>
      <header className="sticky top-0 z-40 w-full px-3 sm:px-6 pt-3">
        <div className="max-w-[1280px] mx-auto liquid-glass rounded-full px-4 sm:px-5 h-14 flex items-center justify-between gap-6">
          {/* Zone 1: Brand Wordmark */}
          <Link
            href="/"
            className="flex items-center gap-2.5 whitespace-nowrap shrink-0 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded-full"
          >
            <span className="w-8 h-8 rounded-full bg-emerald-600 dark:bg-[#10E89A] flex items-center justify-center text-white dark:text-[#04130D] shadow-sm">
              <BarChart2 className="w-4 h-4 stroke-[2.5]" />
            </span>
            <span className="font-display text-lg font-bold tracking-tight text-slate-900 dark:text-[#F1F7FA] group-hover:text-emerald-600 dark:group-hover:text-[#10E89A] transition-colors">
              RoMetric
            </span>
          </Link>

          {/* Zone 2: Clean Single-Line Nav Links */}
          <nav
            aria-label="Primary"
            className="hidden md:flex items-center gap-1"
          >
            {NAV_LINKS.map((item) => {
              const active =
                pathname === item.href ||
                (item.href !== '/' && pathname?.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-4 py-1.5 text-sm font-medium rounded-full whitespace-nowrap shrink-0 transition-all duration-150 ${
                    active
                      ? 'bg-emerald-500/15 dark:bg-[#10E89A]/18 text-emerald-700 dark:text-[#10E89A] shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] dark:shadow-[inset_0_1px_0_rgba(16,232,154,0.35)]'
                      : 'text-slate-600 dark:text-[#9CB3C0] hover:text-slate-950 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/6'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Zone 3: Search + Light/Dark Mode Toggle */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              aria-label="Search games"
              className="flex items-center gap-2 px-3 sm:px-3.5 h-9 text-sm text-slate-600 dark:text-[#9CB3C0] bg-black/[0.04] dark:bg-white/[0.06] border border-slate-900/10 dark:border-white/10 rounded-full hover:border-emerald-500/50 hover:text-slate-950 dark:hover:text-white transition-all whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Search className="w-4 h-4 text-emerald-600 dark:text-[#10E89A]" />
              <span className="hidden sm:inline">Search</span>
            </button>

            <button
              type="button"
              onClick={toggleTheme}
              aria-label={
                theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'
              }
              title={
                theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'
              }
              className="w-9 h-9 rounded-full flex items-center justify-center text-slate-700 dark:text-[#C5D8E2] bg-black/[0.04] dark:bg-white/[0.06] border border-slate-900/10 dark:border-white/10 hover:border-emerald-500/50 hover:text-emerald-600 dark:hover:text-[#10E89A] transition-all cursor-pointer shrink-0"
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Floating Liquid Glass Bottom Dock */}
      <nav
        aria-label="Mobile navigation"
        className="md:hidden fixed bottom-3 left-3 right-3 z-40"
      >
        <div className="max-w-md mx-auto liquid-glass-strong rounded-full p-1.5 grid grid-cols-5 gap-1">
          {MOBILE_DOCK_ITEMS.map((item) => {
            const Icon = item.icon;
            const active =
              item.href === '/'
                ? pathname === '/'
                : pathname === item.href || pathname?.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center justify-center py-1.5 rounded-full text-[11px] font-medium transition-all ${
                  active
                    ? 'bg-emerald-500/18 dark:bg-[#10E89A]/20 text-emerald-700 dark:text-[#10E89A] shadow-[inset_0_1px_0_rgba(255,255,255,0.45)] dark:shadow-[inset_0_1px_0_rgba(16,232,154,0.45)]'
                    : 'text-slate-600 dark:text-[#9CB3C0] hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4 mb-0.5" />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Instant Search Modal */}
      {searchOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/45 dark:bg-black/70 backdrop-blur-md flex items-start justify-center pt-16 sm:pt-24 px-4"
          onClick={() => setSearchOpen(false)}
        >
          <div
            className="w-full max-w-xl liquid-glass-strong rounded-3xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-900/8 dark:border-white/10">
              <Search className="w-4 h-4 text-emerald-600 dark:text-[#10E89A] shrink-0" />
              <input
                type="text"
                autoFocus
                value={queryText}
                onChange={(e) => {
                  setQueryText(e.target.value);
                  setLookupError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setSearchOpen(false);
                  if (
                    e.key === 'Enter' &&
                    matchedGames.length > 0 &&
                    !/^[0-9]{4,20}$/.test(queryText.trim())
                  ) {
                    setSearchOpen(false);
                    setQueryText('');
                    router.push(`/games/${matchedGames[0].universeId}`);
                  } else if (e.key === 'Enter' && canLookupLive) {
                    void handleDirectLookup();
                  }
                }}
                placeholder="Search games, developers, or ID..."
                className="w-full bg-transparent text-sm text-slate-900 dark:text-[#F1F7FA] placeholder:text-slate-500 dark:placeholder:text-[#6F8796] focus:outline-none"
              />
              <button
                type="button"
                aria-label="Close search"
                onClick={() => setSearchOpen(false)}
                className="p-1.5 rounded-full text-slate-500 dark:text-[#6F8796] hover:text-slate-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-[420px] overflow-y-auto divide-y divide-slate-900/6 dark:divide-white/8">
              {canLookupLive && (
                <div className="p-3">
                  <button
                    type="button"
                    disabled={lookupLoading}
                    onClick={() => void handleDirectLookup()}
                    className="w-full flex items-center justify-between px-4 py-3 rounded-2xl bg-emerald-500/12 dark:bg-[#10E89A]/14 border border-emerald-500/30 dark:border-[#10E89A]/35 text-left hover:bg-emerald-500/18 dark:hover:bg-[#10E89A]/22 transition-colors cursor-pointer"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-900 dark:text-[#F1F7FA]">
                        {lookupLoading
                          ? 'Searching Roblox...'
                          : `Find "${queryText.trim()}" on Roblox`}
                      </p>
                      <p className="text-xs text-slate-600 dark:text-[#9CB3C0]">
                        Look up any game by name, link, or ID
                      </p>
                    </div>
                    <ArrowUpRight className="w-4 h-4 text-emerald-600 dark:text-[#10E89A] shrink-0" />
                  </button>
                  {lookupError && (
                    <p className="mt-2 text-xs text-rose-600 dark:text-rose-400 px-1">
                      {lookupError}
                    </p>
                  )}
                </div>
              )}

              {matchedDevs.length > 0 && (
                <div className="p-2.5">
                  <p className="px-3 py-1.5 text-xs font-medium text-slate-500 dark:text-[#6F8796]">
                    Developers
                  </p>
                  {matchedDevs.map((dev) => (
                    <button
                      key={`${dev.creatorType}_${dev.creatorId}`}
                      type="button"
                      onClick={() => {
                        setSearchOpen(false);
                        setQueryText('');
                        router.push(`/developers/${dev.creatorId}`);
                      }}
                      className="w-full flex items-center justify-between px-3 py-2.5 rounded-2xl hover:bg-black/[0.04] dark:hover:bg-white/[0.07] transition-colors text-left cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Users className="w-4 h-4 text-emerald-600 dark:text-[#10E89A] shrink-0" />
                        <span className="text-sm font-medium text-slate-900 dark:text-[#F1F7FA] truncate">
                          {dev.creatorName}
                        </span>
                        <span className="text-xs text-slate-500 dark:text-[#6F8796]">
                          {dev.gameCount}{' '}
                          {dev.gameCount === 1 ? 'game' : 'games'}
                        </span>
                      </div>
                      <span className="text-xs font-semibold text-emerald-600 dark:text-[#10E89A] tabular-nums shrink-0">
                        {formatCompactNumber(dev.combinedCcu)} CCU
                      </span>
                    </button>
                  ))}
                </div>
              )}

              <div className="p-2.5">
                <p className="px-3 py-1.5 text-xs font-medium text-slate-500 dark:text-[#6F8796]">
                  {queryText.trim() ? 'Games' : 'Top Live Games'}
                </p>
                {matchedGames.length === 0 ? (
                  <p className="px-3 py-6 text-center text-sm text-slate-500 dark:text-[#6F8796]">
                    No matches for &ldquo;{queryText}&rdquo;. Press Enter to look
                    it up live.
                  </p>
                ) : (
                  matchedGames.map((game) => (
                    <button
                      key={game.universeId}
                      type="button"
                      onClick={() => {
                        setSearchOpen(false);
                        setQueryText('');
                        router.push(`/games/${game.universeId}`);
                      }}
                      className="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-2xl hover:bg-black/[0.04] dark:hover:bg-white/[0.07] transition-colors text-left cursor-pointer"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <GameArtwork
                          src={game.iconUrl}
                          alt={game.name}
                          size="sm"
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-900 dark:text-[#F1F7FA] truncate">
                            {game.name}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-[#6F8796] truncate">
                            {game.creatorName} · {game.genre}
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold text-emerald-600 dark:text-[#10E89A] tabular-nums">
                          {formatCompactNumber(game.currentCcu)}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-[#6F8796]">
                          CCU
                        </p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
