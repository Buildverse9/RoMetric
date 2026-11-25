'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import {
  Activity,
  ArrowUpRight,
  BarChart2,
  BookOpen,
  Calendar,
  ChevronDown,
  Compass,
  Flame,
  GitCompare,
  Hash,
  History,
  Home,
  Layers,
  Lightbulb,
  Moon,
  Newspaper,
  Search,
  Sparkles,
  Sun,
  Ticket,
  Users,
  X,
} from 'lucide-react';
import { useApp } from './AppProvider';
import { formatCompactNumber } from '@/lib/format';
import { estimateGameRevenue, formatCurrencyCompact } from '@/lib/revenue';
import { buildGameUrlPath } from '@/lib/seo';
import { GameArtwork } from './GameArtwork';
import { APPLE_EASE, APPLE_SPRING } from './MotionPrimitives';

const NAV_LINKS = [
  { href: '/rankings', label: 'Rankings' },
  { href: '/trending', label: 'Trending' },
  { href: '/codes', label: 'Codes' },
  { href: '/updates', label: 'Updates' },
];

const EXPLORE_ITEMS = [
  {
    href: '/genres',
    label: 'Genres & Niches',
    desc: '14 categories ranked by CCU',
    icon: Layers,
  },
  {
    href: '/trends',
    label: 'Keyword Trends',
    desc: 'Theme demand & niche saturation',
    icon: Hash,
  },
  {
    href: '/similar',
    label: 'Similar Games',
    desc: 'Find games like any Roblox hit',
    icon: Sparkles,
  },
  {
    href: '/developers',
    label: 'Developers & Studios',
    desc: 'Top groups & creator portfolios',
    icon: Users,
  },
  {
    href: '/weekly',
    label: 'Weekly Recaps',
    desc: 'Market digests & genre leaders',
    icon: Calendar,
  },
  {
    href: '/articles',
    label: 'Articles & Stories',
    desc: 'Viral Roblox games & deep dives',
    icon: Newspaper,
  },
  {
    href: '/insights',
    label: 'Market Insights',
    desc: 'Revenue Q&A & platform research',
    icon: Lightbulb,
  },
  {
    href: '/compare',
    label: 'Compare Games',
    desc: 'Side-by-side CCU & revenue charts',
    icon: GitCompare,
  },
  {
    href: '/status',
    label: 'Roblox Status',
    desc: 'Live API & platform probe',
    icon: Activity,
  },
  {
    href: '/guide',
    label: 'Methodology Guide',
    desc: 'How metrics & estimates work',
    icon: BookOpen,
  },
];

const EXPLORE_PREFIXES = EXPLORE_ITEMS.map((item) => item.href);

const MOBILE_DOCK_LINKS = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/rankings', label: 'Rankings', icon: BarChart2 },
  { href: '/codes', label: 'Codes', icon: Ticket },
  { href: '/updates', label: 'Updates', icon: History },
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
  const [exploreOpen, setExploreOpen] = useState(false);
  const [mobileExploreOpen, setMobileExploreOpen] = useState(false);
  const exploreRef = useRef<HTMLDivElement>(null);

  const isExploreRoute = useMemo(
    () =>
      Boolean(
        pathname &&
          EXPLORE_PREFIXES.some(
            (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
          )
      ),
    [pathname]
  );

  useEffect(() => {
    if (!exploreOpen) return;
    const handlePointerDown = (e: MouseEvent) => {
      if (
        exploreRef.current &&
        !exploreRef.current.contains(e.target as Node)
      ) {
        setExploreOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setExploreOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [exploreOpen]);

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
      router.push(buildGameUrlPath(data.game));
    } catch {
      setLookupError('Unable to reach search service.');
    } finally {
      setLookupLoading(false);
    }
  };

  return (
    <>
      <motion.header
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: APPLE_EASE }}
        className="sticky top-0 z-40 w-full px-3 sm:px-6 pt-3"
      >
        <div className="max-w-[1280px] mx-auto liquid-glass rounded-full px-4 sm:px-5 h-14 flex items-center justify-between gap-6">
          {/* Zone 1: Brand Wordmark */}
          <Link
            href="/"
            className="flex items-center gap-2.5 whitespace-nowrap shrink-0 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded-full"
          >
            <motion.span
              whileHover={{ scale: 1.07, rotate: -3 }}
              whileTap={{ scale: 0.93 }}
              transition={APPLE_SPRING}
              className="relative w-9 h-9 rounded-xl overflow-hidden bg-[#091318] ring-1 ring-emerald-500/30 shadow-sm shrink-0 flex items-center justify-center"
            >
              <Image
                src="/assets/aistudio/logoofrometric_7c92ca67.png"
                alt="RoMetric Logo"
                fill
                sizes="36px"
                referrerPolicy="no-referrer"
                className="object-cover"
              />
            </motion.span>
            <span className="font-display text-lg font-extrabold tracking-tight text-slate-900 dark:text-[#F1F7FA] group-hover:text-emerald-600 dark:group-hover:text-[#10E89A] transition-colors">
              Ro<span className="text-emerald-600 dark:text-[#10E89A]">Metric</span>
            </span>
          </Link>

          {/* Zone 2: Clean Single-Line Nav Links + Explore Menu */}
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
                  onClick={() => setExploreOpen(false)}
                  className={`relative px-4 py-1.5 text-sm font-medium rounded-full whitespace-nowrap shrink-0 transition-colors duration-150 ${
                    active
                      ? 'text-emerald-700 dark:text-[#10E89A]'
                      : 'text-slate-600 dark:text-[#9CB3C0] hover:text-slate-950 dark:hover:text-white'
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="desktop-nav-pill"
                      transition={APPLE_SPRING}
                      className="absolute inset-0 rounded-full bg-emerald-500/15 dark:bg-[#10E89A]/18 shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] dark:shadow-[inset_0_1px_0_rgba(16,232,154,0.35)] -z-10"
                    />
                  )}
                  {item.label}
                </Link>
              );
            })}

            {/* Explore Dropdown */}
            <div ref={exploreRef} className="relative">
              <button
                type="button"
                aria-expanded={exploreOpen}
                aria-haspopup="true"
                onClick={() => setExploreOpen((prev) => !prev)}
                className={`relative inline-flex items-center gap-1 px-4 py-1.5 text-sm font-medium rounded-full whitespace-nowrap shrink-0 transition-colors duration-150 cursor-pointer ${
                  isExploreRoute || exploreOpen
                    ? 'text-emerald-700 dark:text-[#10E89A]'
                    : 'text-slate-600 dark:text-[#9CB3C0] hover:text-slate-950 dark:hover:text-white'
                }`}
              >
                {isExploreRoute && (
                  <motion.span
                    layoutId="desktop-nav-pill"
                    transition={APPLE_SPRING}
                    className="absolute inset-0 rounded-full bg-emerald-500/15 dark:bg-[#10E89A]/18 shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] dark:shadow-[inset_0_1px_0_rgba(16,232,154,0.35)] -z-10"
                  />
                )}
                <span>Explore</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform duration-200 ${
                    exploreOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              <AnimatePresence>
                {exploreOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.97 }}
                    transition={APPLE_SPRING}
                    className="absolute right-0 mt-3 w-[540px] liquid-glass-strong rounded-3xl p-3 shadow-2xl border border-slate-900/10 dark:border-white/12 z-50"
                  >
                    <div className="grid grid-cols-2 gap-1.5">
                      {EXPLORE_ITEMS.map((item) => {
                        const Icon = item.icon;
                        const active =
                          pathname === item.href ||
                          pathname?.startsWith(`${item.href}/`);
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setExploreOpen(false)}
                            className={`flex items-start gap-3 p-3 rounded-2xl transition-colors group ${
                              active
                                ? 'bg-emerald-500/12 dark:bg-[#10E89A]/14'
                                : 'hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
                            }`}
                          >
                            <span
                              className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                                active
                                  ? 'bg-emerald-600 dark:bg-[#10E89A] text-white dark:text-[#04130D]'
                                  : 'bg-emerald-500/10 dark:bg-[#10E89A]/12 text-emerald-600 dark:text-[#10E89A]'
                              }`}
                            >
                              <Icon className="w-4 h-4" />
                            </span>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-slate-900 dark:text-[#F1F7FA] group-hover:text-emerald-600 dark:group-hover:text-[#10E89A] transition-colors truncate">
                                {item.label}
                              </p>
                              <p className="text-[11px] text-slate-500 dark:text-[#86A1B0] line-clamp-1">
                                {item.desc}
                              </p>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </nav>

          {/* Zone 3: Search + Animated Light/Dark Mode Toggle */}
          <div className="flex items-center gap-2 shrink-0">
            <motion.button
              type="button"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.95 }}
              transition={APPLE_SPRING}
              onClick={() => {
                setExploreOpen(false);
                setSearchOpen(true);
              }}
              aria-label="Search games"
              className="flex items-center gap-2 px-3 sm:px-3.5 h-9 text-sm text-slate-600 dark:text-[#9CB3C0] bg-black/[0.04] dark:bg-white/[0.06] border border-slate-900/10 dark:border-white/10 rounded-full hover:border-emerald-500/50 hover:text-slate-950 dark:hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Search className="w-4 h-4 text-emerald-600 dark:text-[#10E89A]" />
              <span className="hidden sm:inline">Search</span>
            </motion.button>

            <motion.button
              type="button"
              whileHover={{ scale: 1.06 }}
              whileTap={{ scale: 0.9 }}
              transition={APPLE_SPRING}
              onClick={toggleTheme}
              aria-label={
                theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'
              }
              title={
                theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'
              }
              className="w-9 h-9 rounded-full flex items-center justify-center text-slate-700 dark:text-[#C5D8E2] bg-black/[0.04] dark:bg-white/[0.06] border border-slate-900/10 dark:border-white/10 hover:border-emerald-500/50 hover:text-emerald-600 dark:hover:text-[#10E89A] transition-colors cursor-pointer shrink-0 overflow-hidden"
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={theme}
                  initial={{ rotate: -65, scale: 0.5, opacity: 0 }}
                  animate={{ rotate: 0, scale: 1, opacity: 1 }}
                  exit={{ rotate: 65, scale: 0.5, opacity: 0 }}
                  transition={{ duration: 0.2, ease: APPLE_EASE }}
                  className="flex items-center justify-center"
                >
                  {theme === 'dark' ? (
                    <Sun className="w-4 h-4" />
                  ) : (
                    <Moon className="w-4 h-4" />
                  )}
                </motion.span>
              </AnimatePresence>
            </motion.button>
          </div>
        </div>
      </motion.header>

      {/* Mobile Floating Liquid Glass Bottom Dock */}
      <nav
        aria-label="Mobile navigation"
        className="md:hidden fixed bottom-3 left-3 right-3 z-40"
      >
        <div className="max-w-md mx-auto liquid-glass-strong rounded-full p-1.5 grid grid-cols-5 gap-1">
          {MOBILE_DOCK_LINKS.map((item) => {
            const Icon = item.icon;
            const active =
              !mobileExploreOpen &&
              (item.href === '/'
                ? pathname === '/'
                : pathname === item.href || pathname?.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileExploreOpen(false)}
                className={`relative flex flex-col items-center justify-center py-1.5 rounded-full text-[11px] font-medium transition-colors ${
                  active
                    ? 'text-emerald-700 dark:text-[#10E89A]'
                    : 'text-slate-600 dark:text-[#9CB3C0] hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="mobile-dock-pill"
                    transition={APPLE_SPRING}
                    className="absolute inset-0 rounded-full bg-emerald-500/18 dark:bg-[#10E89A]/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.45)] dark:shadow-[inset_0_1px_0_rgba(16,232,154,0.45)] -z-10"
                  />
                )}
                <Icon className="w-4 h-4 mb-0.5" />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}

          <button
            type="button"
            onClick={() => setMobileExploreOpen((prev) => !prev)}
            className={`relative flex flex-col items-center justify-center py-1.5 rounded-full text-[11px] font-medium transition-colors cursor-pointer ${
              mobileExploreOpen || isExploreRoute
                ? 'text-emerald-700 dark:text-[#10E89A]'
                : 'text-slate-600 dark:text-[#9CB3C0] hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {(mobileExploreOpen || isExploreRoute) && (
              <motion.span
                layoutId="mobile-dock-pill"
                transition={APPLE_SPRING}
                className="absolute inset-0 rounded-full bg-emerald-500/18 dark:bg-[#10E89A]/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.45)] dark:shadow-[inset_0_1px_0_rgba(16,232,154,0.45)] -z-10"
              />
            )}
            <Compass className="w-4 h-4 mb-0.5" />
            <span className="truncate">Explore</span>
          </button>
        </div>
      </nav>

      {/* Mobile Explore Sheet */}
      <AnimatePresence>
        {mobileExploreOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="md:hidden fixed inset-0 z-50 bg-slate-950/50 dark:bg-black/75 backdrop-blur-md flex items-end justify-center p-3 pb-20"
            onClick={() => setMobileExploreOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={APPLE_SPRING}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md liquid-glass-strong rounded-3xl p-4 space-y-3 max-h-[75vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between px-1">
                <p className="font-display text-base font-bold text-slate-900 dark:text-[#F1F7FA]">
                  Explore RoMetric
                </p>
                <button
                  type="button"
                  aria-label="Close explore menu"
                  onClick={() => setMobileExploreOpen(false)}
                  className="p-1.5 rounded-full text-slate-500 dark:text-[#9CB3C0] hover:bg-black/5 dark:hover:bg-white/10"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Link
                  href="/trending"
                  onClick={() => setMobileExploreOpen(false)}
                  className="flex items-center gap-2.5 p-3 rounded-2xl bg-black/[0.03] dark:bg-white/[0.04]"
                >
                  <Flame className="w-4 h-4 text-emerald-600 dark:text-[#10E89A] shrink-0" />
                  <span className="text-xs font-semibold text-slate-900 dark:text-[#F1F7FA] truncate">
                    Trending
                  </span>
                </Link>
                {EXPLORE_ITEMS.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileExploreOpen(false)}
                      className="flex items-center gap-2.5 p-3 rounded-2xl bg-black/[0.03] dark:bg-white/[0.04]"
                    >
                      <Icon className="w-4 h-4 text-emerald-600 dark:text-[#10E89A] shrink-0" />
                      <span className="text-xs font-semibold text-slate-900 dark:text-[#F1F7FA] truncate">
                        {item.label}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Spring-Animated Instant Search Modal */}
      <AnimatePresence>
        {searchOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-50 bg-slate-950/45 dark:bg-black/70 backdrop-blur-md flex items-start justify-center pt-16 sm:pt-24 px-4"
            onClick={() => setSearchOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -14 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: -10 }}
              transition={APPLE_SPRING}
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
                      router.push(buildGameUrlPath(matchedGames[0]));
                    } else if (e.key === 'Enter' && canLookupLive) {
                      void handleDirectLookup();
                    }
                  }}
                  placeholder="Search games, developers, or ID..."
                  className="w-full bg-transparent text-sm text-slate-900 dark:text-[#F1F7FA] placeholder:text-slate-500 dark:placeholder:text-[#6F8796] focus:outline-none"
                />
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.88 }}
                  aria-label="Close search"
                  onClick={() => setSearchOpen(false)}
                  className="p-1.5 rounded-full text-slate-500 dark:text-[#6F8796] hover:text-slate-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </motion.button>
              </div>

              <div className="max-h-[420px] overflow-y-auto divide-y divide-slate-900/6 dark:divide-white/8">
                {canLookupLive && (
                  <div className="p-3">
                    <motion.button
                      type="button"
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.985 }}
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
                    </motion.button>
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
                      No matches for &ldquo;{queryText}&rdquo;. Press Enter to
                      look it up live.
                    </p>
                  ) : (
                    matchedGames.map((game) => {
                      const rev = estimateGameRevenue(game);
                      return (
                        <button
                          key={game.universeId}
                          type="button"
                          onClick={() => {
                            setSearchOpen(false);
                            setQueryText('');
                            router.push(buildGameUrlPath(game));
                          }}
                          className="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-2xl hover:bg-black/[0.04] dark:hover:bg-white/[0.07] transition-colors text-left cursor-pointer group"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="group-hover:scale-105 transition-transform duration-200">
                              <GameArtwork
                                src={game.iconUrl}
                                alt={game.name}
                                size="sm"
                              />
                            </div>
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
                              {formatCompactNumber(game.currentCcu)} CCU
                            </p>
                            <p className="text-[11px] text-slate-500 dark:text-[#6F8796] tabular-nums">
                              ~{formatCurrencyCompact(rev.monthlyUsd)}/mo
                            </p>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
