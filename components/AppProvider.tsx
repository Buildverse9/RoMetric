'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
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

interface AppContextValue {
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
        <div className="min-h-screen bg-[#101820] text-[#E8EEF2] flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-[#1C2A32] border border-[#263844] rounded-xl p-6 space-y-4">
            <h2 className="text-xl font-semibold text-[#E8EEF2]">
              Something went wrong loading this view
            </h2>
            <p className="text-sm text-[#9BB0BD] leading-relaxed">
              RoMetric encountered a runtime error while rendering data. Your saved
              database records remain intact.
            </p>
            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false, message: '' });
                if (typeof window !== 'undefined') window.location.reload();
              }}
              className="px-4 py-2 text-sm font-medium bg-[#48D597] text-[#101820] rounded-lg hover:bg-[#3BC286] transition-colors"
            >
              Reload RoMetric
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const [games, setGames] = useState<GameRecordData[]>([]);
  const [loadingGames, setLoadingGames] = useState(true);
  const [gamesError, setGamesError] = useState<string | null>(null);
  const [dataMode, setDataMode] = useState<DataMode>('live_preview');
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);

  // Startup Firestore connection check
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

      // Live real-time fallback from official Roblox APIs (never simulated)
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
    <RoMetricErrorBoundary>
      <AppContext.Provider value={value}>{children}</AppContext.Provider>
    </RoMetricErrorBoundary>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error('useApp must be used inside AppProvider');
  }
  return ctx;
}
