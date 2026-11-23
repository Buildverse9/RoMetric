'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  ArrowUpRight,
  BarChart2,
  Menu,
  Search,
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
  { href: '/methodology', label: 'Methodology' },
];

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { games, developers, searchOpen, setSearchOpen } = useApp();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
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
        setLookupError(data.error || 'Experience not found on Roblox.');
        return;
      }
      setSearchOpen(false);
      setQueryText('');
      router.push(`/games/${data.game.universeId}`);
    } catch {
      setLookupError('Unable to reach Roblox lookup service.');
    } finally {
      setLookupLoading(false);
    }
  };

  return (
    <>
      <header className="sticky top-0 z-40 w-full bg-[#101820]/95 backdrop-blur-md border-b border-[#263844]">
        <div className="max-w-[1360px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Geometric Brand Wordmark (single line, zero badges) */}
          <Link
            href="/"
            className="flex items-center gap-2.5 whitespace-nowrap shrink-0 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#48D597] rounded-md"
          >
            <span className="w-7 h-7 rounded-md bg-[#48D597] flex items-center justify-center text-[#101820]">
              <BarChart2 className="w-4 h-4 stroke-[2.5]" />
            </span>
            <span className="font-display text-lg font-bold tracking-tight text-[#E8EEF2] group-hover:text-[#48D597] transition-colors">
              RoMetric
            </span>
          </Link>

          {/* Zone 2: 5 Clean Single-Line Nav Links */}
          <nav
            aria-label="Primary"
            className="hidden md:flex items-center gap-7"
          >
            {NAV_LINKS.map((item) => {
              const active =
                pathname === item.href ||
                (item.href !== '/' && pathname?.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`text-sm font-medium whitespace-nowrap shrink-0 transition-colors py-1 border-b-2 ${
                    active
                      ? 'text-[#E8EEF2] border-[#48D597]'
                      : 'text-[#9BB0BD] border-transparent hover:text-[#E8EEF2]'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Zone 3: Single Primary Action (Search Trigger) + Mobile Menu Button */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="flex items-center gap-2 px-3.5 py-2 text-sm text-[#9BB0BD] bg-[#1C2A32] border border-[#263844] rounded-lg hover:border-[#48D597]/60 hover:text-[#E8EEF2] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Search className="w-4 h-4 text-[#48D597]" />
              <span className="hidden sm:inline">Search games</span>
              <span className="hidden lg:inline text-xs text-[#6E8492] ml-1 tabular-nums">
                Ctrl K
              </span>
            </button>

            <button
              type="button"
              aria-label="Toggle navigation menu"
              onClick={() => setMobileMenuOpen((v) => !v)}
              className="md:hidden p-2 rounded-lg text-[#9BB0BD] hover:text-[#E8EEF2] hover:bg-[#1C2A32] transition-colors"
            >
              {mobileMenuOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-[#263844] bg-[#101820] px-4 py-3 space-y-1">
            {NAV_LINKS.map((item) => {
              const active =
                pathname === item.href || pathname?.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`block px-3 py-2.5 rounded-lg text-sm font-medium ${
                    active
                      ? 'bg-[#1C2A32] text-[#48D597]'
                      : 'text-[#9BB0BD] hover:bg-[#1C2A32] hover:text-[#E8EEF2]'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        )}
      </header>

      {/* Instant Search Modal */}
      {searchOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-start justify-center pt-16 sm:pt-24 px-4"
          onClick={() => setSearchOpen(false)}
        >
          <div
            className="w-full max-w-xl bg-[#1C2A32] border border-[#263844] rounded-xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[#263844]">
              <Search className="w-4 h-4 text-[#48D597] shrink-0" />
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
                  if (e.key === 'Enter' && matchedGames.length > 0 && !/^[0-9]{4,20}$/.test(queryText.trim())) {
                    setSearchOpen(false);
                    setQueryText('');
                    router.push(`/games/${matchedGames[0].universeId}`);
                  } else if (e.key === 'Enter' && canLookupLive) {
                    void handleDirectLookup();
                  }
                }}
                placeholder="Search any Roblox game by name (e.g. Steal An Egg), creator, or ID..."
                className="w-full bg-transparent text-sm text-[#E8EEF2] placeholder:text-[#6E8492] focus:outline-none"
              />
              <button
                type="button"
                aria-label="Close search"
                onClick={() => setSearchOpen(false)}
                className="p-1 text-[#6E8492] hover:text-[#E8EEF2]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-[420px] overflow-y-auto divide-y divide-[#263844]/70">
              {canLookupLive && (
                <div className="p-3 bg-[#101820]/60">
                  <button
                    type="button"
                    disabled={lookupLoading}
                    onClick={() => void handleDirectLookup()}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg bg-[#48D597]/15 border border-[#48D597]/40 text-left hover:bg-[#48D597]/25 transition-colors cursor-pointer"
                  >
                    <div>
                      <p className="text-sm font-medium text-[#E8EEF2]">
                        {lookupLoading
                          ? 'Searching live Roblox catalog...'
                          : `Search Roblox live for "${queryText.trim()}"`}
                      </p>
                      <p className="text-xs text-[#9BB0BD]">
                        Fetches real live CCU, visits, and votes directly from Roblox public APIs
                      </p>
                    </div>
                    <ArrowUpRight className="w-4 h-4 text-[#48D597] shrink-0" />
                  </button>
                  {lookupError && (
                    <p className="mt-2 text-xs text-rose-400 px-1">{lookupError}</p>
                  )}
                </div>
              )}

              {matchedDevs.length > 0 && (
                <div className="p-2">
                  <p className="px-2.5 py-1.5 text-xs font-medium text-[#6E8492]">
                    Developers & Groups
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
                      className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg hover:bg-[#22333D] transition-colors text-left cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Users className="w-4 h-4 text-[#48D597] shrink-0" />
                        <span className="text-sm font-medium text-[#E8EEF2] truncate">
                          {dev.creatorName}
                        </span>
                        <span className="text-xs text-[#6E8492]">
                          {dev.creatorType} · {dev.gameCount}{' '}
                          {dev.gameCount === 1 ? 'game' : 'games'}
                        </span>
                      </div>
                      <span className="text-xs text-[#48D597] tabular-nums shrink-0">
                        {formatCompactNumber(dev.combinedCcu)} CCU
                      </span>
                    </button>
                  ))}
                </div>
              )}

              <div className="p-2">
                <p className="px-2.5 py-1.5 text-xs font-medium text-[#6E8492]">
                  {queryText.trim() ? 'Matching Experiences' : 'Top Live Experiences'}
                </p>
                {matchedGames.length === 0 ? (
                  <p className="px-3 py-6 text-center text-sm text-[#6E8492]">
                    No tracked games match &ldquo;{queryText}&rdquo;. Paste a Roblox Universe ID,
                    Place ID, or game URL to look it up live.
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
                      className="w-full flex items-center justify-between gap-3 px-2.5 py-2 rounded-lg hover:bg-[#22333D] transition-colors text-left cursor-pointer"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <GameArtwork
                          src={game.iconUrl}
                          alt={game.name}
                          size="sm"
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-[#E8EEF2] truncate">
                            {game.name}
                          </p>
                          <p className="text-xs text-[#6E8492] truncate">
                            {game.creatorName} · {game.genre} · ID {game.universeId}
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold text-[#48D597] tabular-nums">
                          {formatCompactNumber(game.currentCcu)}
                        </p>
                        <p className="text-[11px] text-[#6E8492]">live CCU</p>
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
