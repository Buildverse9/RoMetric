'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { MotionConfig } from 'motion/react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db, googleProvider, testConnection } from '@/lib/firebase';
import {
  fetchAllStoredGames,
  fetchLiveFallbackGames,
} from '@/lib/analytics-store';
import { DEFAULT_ADMIN_EMAIL } from '@/lib/seed-universes';
import type { DeveloperSummary, GameRecordData } from '@/lib/types';

export type DataMode = 'persisted' | 'live_preview';
export type ThemeMode = 'dark' | 'light';

interface AppContextValue {
  theme: ThemeMode;
  setTheme: (next: ThemeMode) => void;
  toggleTheme: () => void;
  user: User | null;
  authReady: boolean;
  isAdmin: boolean;
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
  games: GameRecordData[];
  developers: DeveloperSummary[];
  loadingGames: boolean;
  gamesError: string | null;
  dataMode: DataMode;
  lastUpdatedAt: string | null;
  refreshCatalog: (forceLive?: boolean) => Promise<void>;
  searchOpen: boolean;
  setSearchOpen: (open: boolean) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

class RoMetricErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error) {
    return {
      hasError: true,
      message: error?.message || 'An unexpected error occurred.',
    };
  }

  componentDidCatch(error: Error) {
    console.error('RoMetric UI ErrorBoundary:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6">
          <div className="max-w-md w-full liquid-glass rounded-3xl p-6 space-y-4">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-[#F1F7FA]">
              Something went wrong
            </h2>
            <p className="text-sm text-slate-600 dark:text-[#9CB3C0] leading-relaxed">
              Unable to render this view right now. Please reload the page.
            </p>
            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false, message: '' });
                if (typeof window !== 'undefined') window.location.reload();
              }}
              className="px-4 py-2 text-sm font-semibold bg-emerald-600 dark:bg-[#10E89A] text-white dark:text-[#04130D] rounded-full hover:opacity-90 transition-opacity cursor-pointer"
            >
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>('dark');
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const [games, setGames] = useState<GameRecordData[]>([]);
  const [loadingGames, setLoadingGames] = useState(true);
  const [gamesError, setGamesError] = useState<string | null>(null);
  const [dataMode, setDataMode] = useState<DataMode>('live_preview');
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);

  // Hydrate theme preference from localStorage
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem('rometric-theme');
      const initial: ThemeMode =
        stored === 'light' || stored === 'dark' ? stored : 'dark';
      setThemeState(initial);
      document.documentElement.classList.toggle('dark', initial === 'dark');
    } catch {
      document.documentElement.classList.add('dark');
    }
  }, []);

  const setTheme = useCallback((next: ThemeMode) => {
    setThemeState(next);
    try {
      window.localStorage.setItem('rometric-theme', next);
    } catch {
      // Ignore storage failures
    }
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('dark', next === 'dark');
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next: ThemeMode = prev === 'dark' ? 'light' : 'dark';
      try {
        window.localStorage.setItem('rometric-theme', next);
      } catch {
        // Ignore storage failures
      }
      if (typeof document !== 'undefined') {
        document.documentElement.classList.toggle('dark', next === 'dark');
      }
      return next;
    });
  }, []);

  // Startup connection check
  useEffect(() => {
    void testConnection();
  }, []);

  // Auth listener & admin check
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      if (!nextUser) {
        setIsAdmin(false);
        setAuthReady(true);
        return;
      }

      const emailMatches =
        nextUser.emailVerified &&
        nextUser.email?.toLowerCase() === DEFAULT_ADMIN_EMAIL.toLowerCase();

      if (emailMatches) {
        setIsAdmin(true);
        setAuthReady(true);
        return;
      }

      try {
        const adminSnap = await getDoc(doc(db, 'admins', nextUser.uid));
        setIsAdmin(adminSnap.exists());
      } catch {
        setIsAdmin(false);
      } finally {
        setAuthReady(true);
      }
    });
    return () => unsub();
  }, []);

  const refreshCatalog = useCallback(async (forceLive = false) => {
    setLoadingGames(true);
    setGamesError(null);
    try {
      if (!forceLive) {
        const stored = await fetchAllStoredGames();
        if (stored.length > 0) {
          setGames(stored);
          setDataMode('persisted');
          const latest = stored.reduce<string | null>((acc, g) => {
            if (!acc) return g.lastCollectedAt;
            return g.lastCollectedAt > acc ? g.lastCollectedAt : acc;
          }, null);
          setLastUpdatedAt(latest);
          setLoadingGames(false);
          return;
        }
      }

      const live = await fetchLiveFallbackGames();
      setGames(live.games);
      setDataMode('live_preview');
      setLastUpdatedAt(live.capturedAt);
    } catch (err) {
      setGamesError(
        err instanceof Error
          ? err.message
          : 'Unable to load Roblox analytics data. Please try again.'
      );
    } finally {
      setLoadingGames(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function initCatalog() {
      try {
        const stored = await fetchAllStoredGames();
        if (stored.length > 0) {
          if (cancelled) return;
          setGames(stored);
          setDataMode('persisted');
          const latest = stored.reduce<string | null>((acc, g) => {
            if (!acc) return g.lastCollectedAt;
            return g.lastCollectedAt > acc ? g.lastCollectedAt : acc;
          }, null);
          setLastUpdatedAt(latest);
          return;
        }
        const live = await fetchLiveFallbackGames();
        if (cancelled) return;
        setGames(live.games);
        setDataMode('live_preview');
        setLastUpdatedAt(live.capturedAt);
      } catch (err) {
        if (!cancelled) {
          setGamesError(
            err instanceof Error
              ? err.message
              : 'Unable to load Roblox analytics data. Please try again.'
          );
        }
      } finally {
        if (!cancelled) setLoadingGames(false);
      }
    }
    void initCatalog();
    return () => {
      cancelled = true;
    };
  }, []);

  // Global keyboard shortcut Cmd/Ctrl + K for instant search
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const signInWithGoogle = useCallback(async () => {
    await signInWithPopup(auth, googleProvider);
  }, []);

  const signOutUser = useCallback(async () => {
    await signOut(auth);
  }, []);

  const developers = useMemo<DeveloperSummary[]>(() => {
    const map = new Map<string, GameRecordData[]>();
    for (const g of games) {
      if (!g.active) continue;
      const key = `${g.creatorType}_${g.creatorId}`;
      const list = map.get(key) ?? [];
      list.push(g);
      map.set(key, list);
    }

    const result: DeveloperSummary[] = [];
    for (const list of map.values()) {
      const sorted = [...list].sort((a, b) => b.currentCcu - a.currentCcu);
      const top = sorted[0];
      const combinedCcu = sorted.reduce((sum, item) => sum + item.currentCcu, 0);
      const totalVisits = sorted.reduce((sum, item) => sum + item.totalVisits, 0);
      const totalFavorites = sorted.reduce((sum, item) => sum + item.favorites, 0);
      const validRatios = sorted
        .map((item) => item.likeRatio)
        .filter((r): r is number => r !== null && r !== undefined);
      const avgLikeRatio =
        validRatios.length > 0
          ? Number(
              (
                validRatios.reduce((a, b) => a + b, 0) / validRatios.length
              ).toFixed(1)
            )
          : null;

      result.push({
        creatorId: top.creatorId,
        creatorName: top.creatorName,
        creatorType: top.creatorType,
        creatorVerified: Boolean(top.creatorVerified),
        gameCount: sorted.length,
        combinedCcu,
        totalVisits,
        totalFavorites,
        avgLikeRatio,
        topGame: top,
        games: sorted,
      });
    }

    return result.sort((a, b) => b.combinedCcu - a.combinedCcu);
  }, [games]);

  const value = useMemo<AppContextValue>(
    () => ({
      theme,
      setTheme,
      toggleTheme,
      user,
      authReady,
      isAdmin,
      signInWithGoogle,
      signOutUser,
      games,
      developers,
      loadingGames,
      gamesError,
      dataMode,
      lastUpdatedAt,
      refreshCatalog,
      searchOpen,
      setSearchOpen,
    }),
    [
      theme,
      setTheme,
      toggleTheme,
      user,
      authReady,
      isAdmin,
      signInWithGoogle,
      signOutUser,
      games,
      developers,
      loadingGames,
      gamesError,
      dataMode,
      lastUpdatedAt,
      refreshCatalog,
      searchOpen,
    ]
  );

  return (
    <MotionConfig reducedMotion="user">
      <RoMetricErrorBoundary>
        <AppContext.Provider value={value}>{children}</AppContext.Provider>
      </RoMetricErrorBoundary>
    </MotionConfig>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error('useApp must be used inside AppProvider');
  }
  return ctx;
}
