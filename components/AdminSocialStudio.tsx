'use client';

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ArrowLeftRight,
  Award,
  BarChart3,
  BookOpen,
  Check,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  ExternalLink,
  Flame,
  Image as ImageIcon,
  Loader2,
  RefreshCw,
  RotateCcw,
  Search,
  Square,
  Swords,
  Ticket,
  TrendingUp,
} from 'lucide-react';
import { useApp } from './AppProvider';
import { SocialCardCanvas } from './SocialCardCanvas';
import type { GameRecordData } from '@/lib/types';
import type {
  GameCodeDirectoryItem,
  GameCodeRecord,
  GameCodesDetailPayload,
} from '@/lib/codes-types';
import { formatCompactNumber, formatPercent } from '@/lib/format';
import {
  copyCardImageToClipboard,
  downloadPngDataUrl,
} from '@/lib/card-export';
import {
  DAILY_CADENCE_TASKS,
  detectGameMilestone,
  detectSocialStories,
  exportSocialCanvasToPng,
  findRivalGame,
  generateSocialCaptions,
  getTodayUtcKey,
  getTopLeaderboardGames,
  getTopSurgeGames,
  SOCIAL_STAGE_DIMENSIONS,
  type CaptionTone,
  type DailyChecklistState,
  type DetectedStory,
  type SocialAspectRatio,
  type SocialTemplateId,
} from '@/lib/social-studio';

const CHECKLIST_STORAGE_KEY = 'rometric-social-studio-checklist-v1';

const TEMPLATE_TABS: Array<{
  id: SocialTemplateId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'leaderboard', label: 'Top 10 CCU', icon: BarChart3 },
  { id: 'surge', label: '24h Surge', icon: TrendingUp },
  { id: 'milestone', label: 'Milestone', icon: Award },
  { id: 'codes', label: 'Code Drop', icon: Ticket },
  { id: 'vs', label: 'Head-to-Head', icon: Swords },
];

const TONE_OPTIONS: Array<{ id: CaptionTone; label: string }> = [
  { id: 'news', label: 'News Flash' },
  { id: 'analyst', label: 'Data Analyst' },
  { id: 'debate', label: 'Debate Prompt' },
];

const RECOMMENDED_X_BIO =
  'Live Roblox player counts, 24h breakout surges, milestones & verified game codes. Free real-time tracker → rometrics.vercel.app';

const RECOMMENDED_PINNED_POST =
  'Welcome to RoMetric.\n\nWe track 800+ live Roblox experiences in real time:\n• Live concurrent players (CCU) & 24h surges\n• Peak milestones & head-to-head matchups\n• Verified active game codes with 1-click copy\n\nBookmark & check any game free:\nhttps://rometrics.vercel.app?utm_source=x&utm_medium=social&utm_campaign=pinned_profile';

function readInitialChecklist(): DailyChecklistState {
  const today = getTodayUtcKey();
  if (typeof window === 'undefined') {
    return { dateKey: today, completedIds: [] };
  }
  try {
    const raw = window.localStorage.getItem(CHECKLIST_STORAGE_KEY);
    if (!raw) return { dateKey: today, completedIds: [] };
    const parsed = JSON.parse(raw) as DailyChecklistState;
    if (parsed && parsed.dateKey === today && Array.isArray(parsed.completedIds)) {
      return parsed;
    }
  } catch {
    // ignore storage errors
  }
  return { dateKey: today, completedIds: [] };
}

function GameSearchDropdown({
  label,
  games,
  selectedId,
  onSelect,
  accentLabel,
}: {
  label: string;
  games: GameRecordData[];
  selectedId: string;
  onSelect: (universeId: string) => void;
  accentLabel?: string;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  const selectedGame = useMemo(
    () => games.find((g) => g.universeId === selectedId) || null,
    [games, selectedId]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? games.filter(
          (g) =>
            g.name.toLowerCase().includes(q) ||
            g.creatorName.toLowerCase().includes(q) ||
            g.universeId.includes(q)
        )
      : games;
    return list.slice(0, 30);
  }, [games, query]);

  return (
    <div className="space-y-1.5 relative">
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-slate-700 dark:text-[#CBE0EA]">
          {label}
        </span>
        {accentLabel && (
          <span className="text-[11px] font-medium text-slate-500 dark:text-[#7E98A6]">
            {accentLabel}
          </span>
        )}
      </div>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-xs rounded-xl border border-slate-900/12 dark:border-white/12 bg-white dark:bg-[#0D1A21] text-slate-900 dark:text-[#F1F7FA] hover:border-emerald-500/50 transition-colors cursor-pointer"
      >
        <span className="truncate font-medium">
          {selectedGame
            ? `${selectedGame.name} · ${formatCompactNumber(selectedGame.currentCcu)} CCU`
            : 'Select a Roblox experience...'}
        </span>
        <ChevronDown className="w-3.5 h-3.5 shrink-0 text-slate-400" />
      </button>

      {open && (
        <div className="absolute z-30 left-0 right-0 mt-1 rounded-xl border border-slate-900/15 dark:border-white/15 bg-white dark:bg-[#0A151B] shadow-xl overflow-hidden">
          <div className="p-2 border-b border-slate-900/8 dark:border-white/10">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by game, creator, or ID..."
                autoFocus
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg bg-slate-100 dark:bg-[#102029] text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none"
              />
            </div>
          </div>

          <div className="max-h-56 overflow-y-auto divide-y divide-slate-900/5 dark:divide-white/5">
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-xs text-slate-500 text-center">
                No matching games found.
              </div>
            ) : (
              filtered.map((g) => {
                const isSelected = g.universeId === selectedId;
                return (
                  <button
                    key={g.universeId}
                    type="button"
                    onClick={() => {
                      onSelect(g.universeId);
                      setOpen(false);
                      setQuery('');
                    }}
                    className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-xs transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-500/12 text-emerald-700 dark:text-[#10E89A] font-semibold'
                        : 'text-slate-800 dark:text-[#D5E6EE] hover:bg-slate-100 dark:hover:bg-white/5'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="truncate font-medium">{g.name}</div>
                      <div className="truncate text-[11px] text-slate-500 dark:text-[#7E98A6]">
                        {g.creatorName}
                      </div>
                    </div>
                    <div className="text-right shrink-0 font-mono tabular-nums text-[11px]">
                      <div>{formatCompactNumber(g.currentCcu)}</div>
                      {g.growth24h !== null && g.growth24h !== undefined && (
                        <div
                          className={
                            g.growth24h >= 0
                              ? 'text-emerald-600 dark:text-[#10E89A]'
                              : 'text-rose-600 dark:text-rose-400'
                          }
                        >
                          {formatPercent(g.growth24h)}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function AdminSocialStudio() {
  const { games } = useApp();

  const sortedByCcu = useMemo(() => {
    return [...games]
      .filter((g) => g.active)
      .sort((a, b) => b.currentCcu - a.currentCcu);
  }, [games]);

  const surgeCandidates = useMemo(
    () => getTopSurgeGames(games, 20),
    [games]
  );

  // Core studio controls
  const [template, setTemplate] = useState<SocialTemplateId>('leaderboard');
  const [aspect, setAspect] = useState<SocialAspectRatio>('16:9');
  const [leaderboardCount, setLeaderboardCount] = useState<5 | 10>(10);
  const [primaryGameId, setPrimaryGameId] = useState<string>('');
  const [secondaryGameId, setSecondaryGameId] = useState<string>('');
  const [customHeadline, setCustomHeadline] = useState<string>('');
  const [showRevenue, setShowRevenue] = useState<boolean>(true);
  const [showTimestamp, setShowTimestamp] = useState<boolean>(true);
  const [showFooterUrl, setShowFooterUrl] = useState<boolean>(true);
  const [snapshotDate, setSnapshotDate] = useState<Date>(() => new Date());

  // Caption controls
  const [tone, setTone] = useState<CaptionTone>('news');
  const [includeLinkInMain, setIncludeLinkInMain] = useState<boolean>(false);
  const [customMainCaption, setCustomMainCaption] = useState<string | null>(
    null
  );

  // Codes data state
  const [codeGames, setCodeGames] = useState<GameCodeDirectoryItem[]>([]);
  const [loadingCodeGames, setLoadingCodeGames] = useState<boolean>(false);
  const [selectedCodeSlug, setSelectedCodeSlug] = useState<string>('');
  const [codeDetailCodes, setCodeDetailCodes] = useState<GameCodeRecord[]>([]);
  const [loadingCodeDetail, setLoadingCodeDetail] = useState<boolean>(false);
  const [excludedCodeIds, setExcludedCodeIds] = useState<number[]>([]);

  // Export & clipboard feedback
  const [exporting, setExporting] = useState<boolean>(false);
  const [copyingImage, setCopyingImage] = useState<boolean>(false);
  const [feedbackToast, setFeedbackToast] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [playbookOpen, setPlaybookOpen] = useState<boolean>(false);

  // Daily cadence checklist (UTC-keyed localStorage)
  const [checklist, setChecklist] = useState<DailyChecklistState>(
    readInitialChecklist
  );

  // Scaled preview stage measurements
  const previewContainerRef = useRef<HTMLDivElement | null>(null);
  const exportCanvasRef = useRef<HTMLDivElement | null>(null);
  const [previewWidth, setPreviewWidth] = useState<number>(760);

  // Fetch games with verified codes on mount
  useEffect(() => {
    let cancelled = false;
    async function loadCodeDirectory() {
      setLoadingCodeGames(true);
      try {
        const res = await fetch('/api/codes?covered=1&sort=popular');
        if (!res.ok) return;
        const data = (await res.json()) as {
          games?: GameCodeDirectoryItem[];
        };
        if (cancelled) return;
        const list = (data.games || []).filter((g) => g.activeCodeCount > 0);
        setCodeGames(list);
        if (list.length > 0) {
          setSelectedCodeSlug((prev) => prev || list[0].slug);
        }
      } catch {
        // Non-blocking: other templates work purely off live games catalog
      } finally {
        if (!cancelled) setLoadingCodeGames(false);
      }
    }
    void loadCodeDirectory();
    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch active code rows for the selected Code Drop game
  useEffect(() => {
    if (!selectedCodeSlug) return;
    let cancelled = false;
    async function loadCodesForGame() {
      setLoadingCodeDetail(true);
      try {
        const res = await fetch(
          `/api/codes/${encodeURIComponent(selectedCodeSlug)}`
        );
        if (!res.ok) {
          if (!cancelled) setCodeDetailCodes([]);
          return;
        }
        const data = (await res.json()) as GameCodesDetailPayload;
        if (!cancelled) {
          const active = (data.codes || []).filter((c) => c.status === 'active');
          setCodeDetailCodes(active);
          setExcludedCodeIds([]);
        }
      } catch {
        if (!cancelled) setCodeDetailCodes([]);
      } finally {
        if (!cancelled) setLoadingCodeDetail(false);
      }
    }
    void loadCodesForGame();
    return () => {
      cancelled = true;
    };
  }, [selectedCodeSlug]);

  // Measure live preview stage width for crisp CSS scaling
  useEffect(() => {
    const el = previewContainerRef.current;
    if (!el) return;
    const updateWidth = () => {
      const w = el.getBoundingClientRect().width;
      if (w > 100) setPreviewWidth(w);
    };
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Resolve active games with sensible fallbacks so zero-state is immediately populated
  const effectivePrimaryGame = useMemo<GameRecordData | null>(() => {
    if (primaryGameId) {
      const exact = sortedByCcu.find((g) => g.universeId === primaryGameId);
      if (exact) return exact;
    }
    if (template === 'surge' && surgeCandidates.length > 0) {
      return surgeCandidates[0];
    }
    return sortedByCcu[0] || null;
  }, [primaryGameId, sortedByCcu, template, surgeCandidates]);

  const effectiveSecondaryGame = useMemo<GameRecordData | null>(() => {
    if (secondaryGameId && secondaryGameId !== effectivePrimaryGame?.universeId) {
      const exact = sortedByCcu.find((g) => g.universeId === secondaryGameId);
      if (exact) return exact;
    }
    if (effectivePrimaryGame) {
      return (
        findRivalGame(effectivePrimaryGame, sortedByCcu) ||
        sortedByCcu.find(
          (g) => g.universeId !== effectivePrimaryGame.universeId
        ) ||
        null
      );
    }
    return sortedByCcu[1] || null;
  }, [secondaryGameId, sortedByCcu, effectivePrimaryGame]);

  const activeCodeGame = useMemo<GameCodeDirectoryItem | null>(() => {
    if (!selectedCodeSlug) return codeGames[0] || null;
    return (
      codeGames.find((g) => g.slug === selectedCodeSlug) || codeGames[0] || null
    );
  }, [codeGames, selectedCodeSlug]);

  const selectedCodes = useMemo(() => {
    return codeDetailCodes
      .filter((c) => !excludedCodeIds.includes(c.id))
      .slice(0, 6);
  }, [codeDetailCodes, excludedCodeIds]);

  const leaderboardGames = useMemo(
    () => getTopLeaderboardGames(games, leaderboardCount),
    [games, leaderboardCount]
  );

  const surgeRunnersUp = useMemo(() => {
    return surgeCandidates
      .filter((g) => g.universeId !== effectivePrimaryGame?.universeId)
      .slice(0, 3);
  }, [surgeCandidates, effectivePrimaryGame]);

  const milestone = useMemo(
    () => (effectivePrimaryGame ? detectGameMilestone(effectivePrimaryGame) : null),
    [effectivePrimaryGame]
  );

  const detectedStories = useMemo(
    () => detectSocialStories(games, codeGames),
    [games, codeGames]
  );

  const generatedCaptions = useMemo(
    () =>
      generateSocialCaptions({
        template,
        tone,
        includeLinkInMain,
        leaderboardGames,
        primaryGame: effectivePrimaryGame,
        secondaryGame: effectiveSecondaryGame,
        milestone,
        codeGame: activeCodeGame,
        activeCodes: selectedCodes,
        showRevenue,
      }),
    [
      template,
      tone,
      includeLinkInMain,
      leaderboardGames,
      effectivePrimaryGame,
      effectiveSecondaryGame,
      milestone,
      activeCodeGame,
      selectedCodes,
      showRevenue,
    ]
  );

  const displayedMainCaption =
    customMainCaption !== null ? customMainCaption : generatedCaptions.mainPost;
  const charCount = displayedMainCaption.length;
  const isOverLimit = charCount > 280;

  const xComposerHref = useMemo(
    () =>
      `https://x.com/intent/tweet?text=${encodeURIComponent(displayedMainCaption)}`,
    [displayedMainCaption]
  );

  const showToast = useCallback((type: 'success' | 'error', text: string) => {
    setFeedbackToast({ type, text });
  }, []);

  useEffect(() => {
    if (!feedbackToast) return;
    const t = setTimeout(() => setFeedbackToast(null), 4000);
    return () => clearTimeout(t);
  }, [feedbackToast]);

  const copyText = useCallback(
    async (key: string, text: string, successMsg: string) => {
      try {
        await navigator.clipboard.writeText(text);
        setCopiedKey(key);
        showToast('success', successMsg);
        setTimeout(() => {
          setCopiedKey((prev) => (prev === key ? null : prev));
        }, 2000);
      } catch {
        showToast('error', 'Clipboard access was blocked by the browser.');
      }
    },
    [showToast]
  );

  const handleSelectStory = (story: DetectedStory) => {
    setTemplate(story.template);
    setCustomHeadline('');
    setCustomMainCaption(null);
    setSnapshotDate(new Date());
    if (story.primaryUniverseId) {
      setPrimaryGameId(story.primaryUniverseId);
    }
    if (story.secondaryUniverseId) {
      setSecondaryGameId(story.secondaryUniverseId);
    }
    if (story.codeGameSlug) {
      setSelectedCodeSlug(story.codeGameSlug);
    }
  };

  const handleTemplateChange = (next: SocialTemplateId) => {
    setTemplate(next);
    setCustomHeadline('');
    setCustomMainCaption(null);
    if (next === 'surge' && surgeCandidates.length > 0) {
      setPrimaryGameId(surgeCandidates[0].universeId);
    }
  };

  const handleSwapVsGames = () => {
    if (!effectivePrimaryGame || !effectiveSecondaryGame) return;
    setPrimaryGameId(effectiveSecondaryGame.universeId);
    setSecondaryGameId(effectivePrimaryGame.universeId);
    setCustomHeadline('');
    setCustomMainCaption(null);
  };

  const handleAutoRival = () => {
    if (!effectivePrimaryGame) return;
    const rival = findRivalGame(effectivePrimaryGame, sortedByCcu);
    if (rival) {
      setSecondaryGameId(rival.universeId);
      setCustomHeadline('');
      setCustomMainCaption(null);
    }
  };

  const toggleCodeSelection = (codeId: number) => {
    setCustomMainCaption(null);
    setExcludedCodeIds((prev) =>
      prev.includes(codeId)
        ? prev.filter((id) => id !== codeId)
        : [...prev, codeId]
    );
  };

  const toggleChecklistTask = (taskId: string) => {
    const today = getTodayUtcKey();
    setChecklist((prev) => {
      const base = prev.dateKey === today ? prev.completedIds : [];
      const nextIds = base.includes(taskId)
        ? base.filter((id) => id !== taskId)
        : [...base, taskId];
      const nextState: DailyChecklistState = {
        dateKey: today,
        completedIds: nextIds,
      };
      try {
        window.localStorage.setItem(
          CHECKLIST_STORAGE_KEY,
          JSON.stringify(nextState)
        );
      } catch {
        // ignore storage errors
      }
      return nextState;
    });
  };

  const buildFilenameBase = () => {
    if (template === 'leaderboard') return `top-${leaderboardCount}-ccu`;
    if (template === 'surge') return `surge-${effectivePrimaryGame?.slug || 'game'}`;
    if (template === 'milestone')
      return `milestone-${effectivePrimaryGame?.slug || 'game'}`;
    if (template === 'codes') return `codes-${activeCodeGame?.slug || 'roblox'}`;
    return `vs-${effectivePrimaryGame?.slug || 'a'}-${effectiveSecondaryGame?.slug || 'b'}`;
  };

  const handleDownloadPng = async () => {
    if (!exportCanvasRef.current || exporting) return;
    setExporting(true);
    try {
      const dims = SOCIAL_STAGE_DIMENSIONS[aspect];
      const result = await exportSocialCanvasToPng(exportCanvasRef.current, {
        width: dims.width,
        height: dims.height,
        filenameBase: buildFilenameBase(),
      });
      downloadPngDataUrl(result.dataUrl, result.filename);
      showToast('success', `Downloaded ${result.filename} (${dims.exportLabel})`);
    } catch (err) {
      console.error('Social Studio PNG export failed:', err);
      showToast('error', 'Failed to render 2x PNG. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const handleCopyImage = async () => {
    if (!exportCanvasRef.current || copyingImage) return;
    setCopyingImage(true);
    try {
      const dims = SOCIAL_STAGE_DIMENSIONS[aspect];
      const result = await exportSocialCanvasToPng(exportCanvasRef.current, {
        width: dims.width,
        height: dims.height,
        filenameBase: buildFilenameBase(),
      });
      const copied = await copyCardImageToClipboard(result.blob);
      if (copied) {
        showToast(
          'success',
          '2x PNG copied to clipboard — press Ctrl+V directly in X composer.'
        );
      } else {
        downloadPngDataUrl(result.dataUrl, result.filename);
        showToast(
          'success',
          'Browser blocked direct image copy — downloaded PNG instead.'
        );
      }
    } catch (err) {
      console.error('Social Studio copy image failed:', err);
      showToast('error', 'Unable to copy image to clipboard.');
    } finally {
      setCopyingImage(false);
    }
  };

  const dims = SOCIAL_STAGE_DIMENSIONS[aspect];
  const scale = Math.min(1, Math.max(0.22, previewWidth / dims.width));
  const scaledHeight = Math.round(dims.height * scale);

  const completedCount = checklist.completedIds.length;

  return (
    <div className="space-y-6">
      {/* Top Row: Studio Summary & Growth Playbook Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-[#7E98A6]">
            <span>X Growth Workbench</span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">{games.length} tracked games</span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">
              {completedCount}/{DAILY_CADENCE_TASKS.length} posted today (UTC)
            </span>
          </div>
          <h2 className="font-display text-xl font-bold text-slate-950 dark:text-white">
            Social Studio — Clean White X Data Cards
          </h2>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setSnapshotDate(new Date())}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-slate-900/12 dark:border-white/12 bg-white dark:bg-[#0D1A21] text-slate-700 dark:text-[#CBE0EA] hover:border-emerald-500/50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh Timestamp
          </button>

          <button
            type="button"
            onClick={() => setPlaybookOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg border border-slate-900/12 dark:border-white/12 bg-white dark:bg-[#0D1A21] text-slate-900 dark:text-white hover:border-emerald-500/50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <BookOpen className="w-3.5 h-3.5 text-emerald-600 dark:text-[#10E89A]" />
            X Growth Playbook
            {playbookOpen ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Collapsible X Growth Playbook */}
      {playbookOpen && (
        <div className="rounded-2xl border border-slate-900/12 dark:border-white/12 bg-white/90 dark:bg-[#0A161C]/90 p-5 space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="space-y-2">
              <div className="text-xs font-semibold text-emerald-700 dark:text-[#10E89A]">
                01. Profile Bio Funnel
              </div>
              <p className="text-xs text-slate-600 dark:text-[#9CB3C0] leading-relaxed">
                Keep your X bio direct so every viral chart converts profile visitors into RoMetric clicks.
              </p>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#0F1F27] border border-slate-900/8 dark:border-white/8 text-xs text-slate-800 dark:text-[#E2F1F7] leading-relaxed">
                {RECOMMENDED_X_BIO}
              </div>
              <button
                type="button"
                onClick={() =>
                  void copyText('bio', RECOMMENDED_X_BIO, 'Copied recommended X bio.')
                }
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-[#10E89A] hover:underline cursor-pointer"
              >
                {copiedKey === 'bio' ? (
                  <Check className="w-3.5 h-3.5" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                Copy X Bio
              </button>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-semibold text-emerald-700 dark:text-[#10E89A]">
                02. Pinned Welcome Post
              </div>
              <p className="text-xs text-slate-600 dark:text-[#9CB3C0] leading-relaxed">
                Pair this pinned post with today&apos;s Top 10 Live CCU Leaderboard PNG to anchor your profile.
              </p>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#0F1F27] border border-slate-900/8 dark:border-white/8 text-xs text-slate-800 dark:text-[#E2F1F7] whitespace-pre-line leading-relaxed max-h-28 overflow-y-auto">
                {RECOMMENDED_PINNED_POST}
              </div>
              <button
                type="button"
                onClick={() =>
                  void copyText(
                    'pinned',
                    RECOMMENDED_PINNED_POST,
                    'Copied pinned post draft.'
                  )
                }
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-[#10E89A] hover:underline cursor-pointer"
              >
                {copiedKey === 'pinned' ? (
                  <Check className="w-3.5 h-3.5" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                Copy Pinned Post
              </button>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-semibold text-emerald-700 dark:text-[#10E89A]">
                03. High-Reach Posting Rules
              </div>
              <ul className="space-y-1.5 text-xs text-slate-600 dark:text-[#9CB3C0] leading-relaxed">
                <li>
                  <strong className="text-slate-900 dark:text-white">
                    Reply-link split:
                  </strong>{' '}
                  Keep the main post link-free for wider X distribution, then immediately paste the UTM reply link underneath.
                </li>
                <li>
                  <strong className="text-slate-900 dark:text-white">
                    Tag Roblox studios:
                  </strong>{' '}
                  On Surge and Milestone posts, tag the game&apos;s creator handle — developer reposts drive the fastest growth.
                </li>
                <li>
                  <strong className="text-slate-900 dark:text-white">
                    Track winners in GA4:
                  </strong>{' '}
                  Every link carries <code className="font-mono text-[11px]">utm_campaign=&lt;format&gt;</code> so GA4 shows which card type drives the most traffic.
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Auto-Detected Stories Right Now */}
      {detectedStories.length > 0 && (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-700 dark:text-[#CBE0EA] inline-flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5 text-amber-500" />
              Auto-Detected Stories Right Now
            </span>
            <span className="text-slate-500 dark:text-[#7E98A6]">
              Click any story to load its graphic & caption
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
            {detectedStories.map((story) => {
              const isActive =
                template === story.template &&
                (!story.primaryUniverseId ||
                  effectivePrimaryGame?.universeId === story.primaryUniverseId ||
                  story.template === 'leaderboard' ||
                  story.template === 'codes');

              return (
                <button
                  key={story.id}
                  type="button"
                  onClick={() => handleSelectStory(story)}
                  className={`text-left p-3.5 rounded-xl border transition-colors cursor-pointer space-y-1 ${
                    isActive
                      ? 'border-emerald-500/60 bg-emerald-500/8 dark:bg-emerald-500/12'
                      : 'border-slate-900/10 dark:border-white/10 bg-white dark:bg-[#0B171E] hover:border-slate-900/25 dark:hover:border-white/25'
                  }`}
                >
                  <div className="text-[11px] font-semibold text-emerald-700 dark:text-[#10E89A]">
                    {story.kicker}
                  </div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                    {story.title}
                  </div>
                  <div className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-[#8CA4B2] truncate">
                    {story.metric}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Template Selector + Aspect Ratio Switcher */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-1">
        <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-[#0D1B22] border border-slate-900/8 dark:border-white/8 overflow-x-auto">
          {TEMPLATE_TABS.map((tab) => {
            const Icon = tab.icon;
            const active = template === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleTemplateChange(tab.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'bg-white dark:bg-[#10E89A] text-slate-950 dark:text-[#04130D] shadow-xs'
                    : 'text-slate-600 dark:text-[#9CB3C0] hover:text-slate-950 dark:hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-[#0D1B22] border border-slate-900/8 dark:border-white/8 self-start md:self-auto">
          {(['16:9', '1:1'] as SocialAspectRatio[]).map((ratio) => {
            const active = aspect === ratio;
            return (
              <button
                key={ratio}
                type="button"
                onClick={() => setAspect(ratio)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'bg-white dark:bg-[#17303C] text-slate-950 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-[#9CB3C0] hover:text-slate-950 dark:hover:text-white'
                }`}
              >
                {SOCIAL_STAGE_DIMENSIONS[ratio].label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Two-Column Studio Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-[360px_minmax(0,1fr)] gap-6 items-start">
        {/* LEFT RAIL: Template Configuration + Daily 3-Post Checklist */}
        <div className="space-y-5">
          {/* Card Configuration Container */}
          <div className="rounded-2xl border border-slate-900/12 dark:border-white/12 bg-white dark:bg-[#0A161C] p-5 space-y-5">
            <div className="pb-3 border-b border-slate-900/8 dark:border-white/10">
              <h3 className="text-sm font-bold text-slate-950 dark:text-white">
                Card Settings
              </h3>
              <p className="text-xs text-slate-500 dark:text-[#7E98A6] mt-0.5">
                Updates the clean white data card and captions in real time.
              </p>
            </div>

            {/* Template-Specific Controls */}
            {template === 'leaderboard' && (
              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-700 dark:text-[#CBE0EA]">
                  Ranked Rows
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {([10, 5] as Array<5 | 10>).map((cnt) => (
                    <button
                      key={cnt}
                      type="button"
                      onClick={() => {
                        setLeaderboardCount(cnt);
                        setCustomMainCaption(null);
                      }}
                      className={`py-2 px-3 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                        leaderboardCount === cnt
                          ? 'border-emerald-500 bg-emerald-500/12 text-emerald-700 dark:text-[#10E89A]'
                          : 'border-slate-900/10 dark:border-white/10 text-slate-600 dark:text-[#9CB3C0]'
                      }`}
                    >
                      Top {cnt} Games
                    </button>
                  ))}
                </div>
              </div>
            )}

            {(template === 'surge' || template === 'milestone') && (
              <GameSearchDropdown
                label={
                  template === 'surge'
                    ? 'Featured Breakout Game'
                    : 'Featured Milestone Game'
                }
                accentLabel={
                  template === 'surge' ? 'Sorted by 24h surge' : 'Sorted by CCU'
                }
                games={template === 'surge' ? surgeCandidates.concat(sortedByCcu.filter((g) => !surgeCandidates.some((s) => s.universeId === g.universeId))) : sortedByCcu}
                selectedId={effectivePrimaryGame?.universeId || ''}
                onSelect={(id) => {
                  setPrimaryGameId(id);
                  setCustomHeadline('');
                  setCustomMainCaption(null);
                }}
              />
            )}

            {template === 'vs' && (
              <div className="space-y-3.5">
                <GameSearchDropdown
                  label="Game A (Slate Side)"
                  games={sortedByCcu}
                  selectedId={effectivePrimaryGame?.universeId || ''}
                  onSelect={(id) => {
                    setPrimaryGameId(id);
                    setCustomHeadline('');
                    setCustomMainCaption(null);
                  }}
                />
                <GameSearchDropdown
                  label="Game B (Cobalt Side)"
                  games={sortedByCcu}
                  selectedId={effectiveSecondaryGame?.universeId || ''}
                  onSelect={(id) => {
                    setSecondaryGameId(id);
                    setCustomHeadline('');
                    setCustomMainCaption(null);
                  }}
                />
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleSwapVsGames}
                    className="inline-flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold rounded-lg border border-slate-900/12 dark:border-white/12 text-slate-700 dark:text-[#CBE0EA] hover:border-emerald-500/50 transition-colors cursor-pointer"
                  >
                    <ArrowLeftRight className="w-3.5 h-3.5" />
                    Swap Sides
                  </button>
                  <button
                    type="button"
                    onClick={handleAutoRival}
                    className="inline-flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold rounded-lg border border-slate-900/12 dark:border-white/12 text-slate-700 dark:text-[#CBE0EA] hover:border-emerald-500/50 transition-colors cursor-pointer"
                  >
                    <Swords className="w-3.5 h-3.5" />
                    Auto Rival
                  </button>
                </div>
              </div>
            )}

            {template === 'codes' && (
              <div className="space-y-3.5">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700 dark:text-[#CBE0EA]">
                      Game with Active Codes
                    </span>
                    <span className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-[#7E98A6]">
                      {loadingCodeGames
                        ? 'Loading...'
                        : `${codeGames.length} covered`}
                    </span>
                  </div>

                  {codeGames.length === 0 && !loadingCodeGames ? (
                    <div className="p-3 rounded-xl border border-amber-500/30 bg-amber-500/8 text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                      No games with verified active codes yet. Open the{' '}
                      <strong>Game Codes</strong> tab to sync codes from BloxArchive or Roblox signals first.
                    </div>
                  ) : (
                    <select
                      value={activeCodeGame?.slug || ''}
                      onChange={(e) => {
                        setSelectedCodeSlug(e.target.value);
                        setCustomHeadline('');
                        setCustomMainCaption(null);
                      }}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-900/12 dark:border-white/12 bg-white dark:bg-[#0D1A21] text-slate-900 dark:text-[#F1F7FA] focus:outline-none focus:border-emerald-500"
                    >
                      {codeGames.map((cg) => (
                        <option key={cg.universeId} value={cg.slug}>
                          {cg.name} ({cg.activeCodeCount} active ·{' '}
                          {formatCompactNumber(cg.currentCcu)} CCU)
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Pick up to 6 active codes to feature */}
                {codeGames.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-700 dark:text-[#CBE0EA]">
                        Featured Codes (Max 6)
                      </span>
                      <span className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-[#7E98A6]">
                        {loadingCodeDetail
                          ? 'Fetching...'
                          : `${selectedCodes.length} shown`}
                      </span>
                    </div>

                    {loadingCodeDetail ? (
                      <div className="py-4 text-xs text-slate-500 flex items-center justify-center gap-2">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Loading verified active codes...
                      </div>
                    ) : codeDetailCodes.length === 0 ? (
                      <div className="py-3 text-xs text-slate-500">
                        No active codes returned for this game.
                      </div>
                    ) : (
                      <div className="max-h-44 overflow-y-auto divide-y divide-slate-900/6 dark:divide-white/6 rounded-xl border border-slate-900/10 dark:border-white/10">
                        {codeDetailCodes.map((c) => {
                          const checked = !excludedCodeIds.includes(c.id);
                          return (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => toggleCodeSelection(c.id)}
                              className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-white/5 transition-colors cursor-pointer"
                            >
                              {checked ? (
                                <CheckSquare className="w-3.5 h-3.5 shrink-0 text-emerald-600 dark:text-[#10E89A]" />
                              ) : (
                                <Square className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                              )}
                              <div className="min-w-0 flex-1">
                                <div className="text-xs font-mono font-bold text-slate-900 dark:text-white truncate">
                                  {c.code}
                                </div>
                                {c.rewardDescription && (
                                  <div className="text-[11px] text-slate-500 dark:text-[#7E98A6] truncate">
                                    {c.rewardDescription}
                                  </div>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Editorial Headline Override */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <label
                  htmlFor="social-headline-override"
                  className="font-semibold text-slate-700 dark:text-[#CBE0EA]"
                >
                  Headline Override (Optional)
                </label>
                {customHeadline && (
                  <button
                    type="button"
                    onClick={() => setCustomHeadline('')}
                    className="text-[11px] text-emerald-600 dark:text-[#10E89A] hover:underline cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>
              <input
                id="social-headline-override"
                type="text"
                value={customHeadline}
                onChange={(e) => setCustomHeadline(e.target.value)}
                placeholder="Leave blank for automatic headline..."
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-900/12 dark:border-white/12 bg-white dark:bg-[#0D1A21] text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Clean Display Toggles */}
            <div className="space-y-2.5 pt-2 border-t border-slate-900/8 dark:border-white/10">
              <div className="text-xs font-semibold text-slate-700 dark:text-[#CBE0EA]">
                Graphic Details
              </div>

              {(template === 'surge' ||
                template === 'milestone' ||
                template === 'vs') && (
                <label className="flex items-center justify-between gap-3 text-xs text-slate-700 dark:text-[#B8CED8] cursor-pointer">
                  <span>Show Est. Monthly DevEx Revenue</span>
                  <input
                    type="checkbox"
                    checked={showRevenue}
                    onChange={(e) => {
                      setShowRevenue(e.target.checked);
                      setCustomMainCaption(null);
                    }}
                    className="h-4 w-4 rounded accent-emerald-600 cursor-pointer"
                  />
                </label>
              )}

              <label className="flex items-center justify-between gap-3 text-xs text-slate-700 dark:text-[#B8CED8] cursor-pointer">
                <span>Show Live UTC Timestamp</span>
                <input
                  type="checkbox"
                  checked={showTimestamp}
                  onChange={(e) => setShowTimestamp(e.target.checked)}
                  className="h-4 w-4 rounded accent-emerald-600 cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between gap-3 text-xs text-slate-700 dark:text-[#B8CED8] cursor-pointer">
                <span>Show rometrics.vercel.app Footer</span>
                <input
                  type="checkbox"
                  checked={showFooterUrl}
                  onChange={(e) => setShowFooterUrl(e.target.checked)}
                  className="h-4 w-4 rounded accent-emerald-600 cursor-pointer"
                />
              </label>
            </div>
          </div>

          {/* Daily 3-Post Cadence Checklist */}
          <div className="rounded-2xl border border-slate-900/12 dark:border-white/12 bg-white dark:bg-[#0A161C] p-5 space-y-3.5">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-900/8 dark:border-white/10">
              <div>
                <h3 className="text-sm font-bold text-slate-950 dark:text-white">
                  Daily 3-Post Rhythm
                </h3>
                <div className="text-[11px] text-slate-500 dark:text-[#7E98A6] font-mono tabular-nums">
                  {checklist.dateKey} UTC · Resets daily
                </div>
              </div>
              <span className="text-xs font-mono font-bold tabular-nums text-emerald-700 dark:text-[#10E89A]">
                {completedCount}/{DAILY_CADENCE_TASKS.length}
              </span>
            </div>

            <div className="space-y-2.5">
              {DAILY_CADENCE_TASKS.map((task) => {
                const done = checklist.completedIds.includes(task.id);
                return (
                  <div
                    key={task.id}
                    className="flex items-start gap-2.5 text-xs"
                  >
                    <button
                      type="button"
                      onClick={() => toggleChecklistTask(task.id)}
                      aria-label={`Mark "${task.title}" as ${done ? 'incomplete' : 'complete'}`}
                      className="mt-0.5 shrink-0 cursor-pointer text-slate-400 hover:text-emerald-600 dark:hover:text-[#10E89A]"
                    >
                      {done ? (
                        <CheckSquare className="w-4 h-4 text-emerald-600 dark:text-[#10E89A]" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-medium text-slate-500 dark:text-[#7E98A6]">
                          {task.slot}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            handleTemplateChange(task.recommendedTemplate)
                          }
                          className="text-[11px] font-semibold text-emerald-600 dark:text-[#10E89A] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          Load template
                        </button>
                      </div>
                      <div
                        className={`font-semibold ${
                          done
                            ? 'line-through text-slate-400 dark:text-[#5F7886]'
                            : 'text-slate-900 dark:text-white'
                        }`}
                      >
                        {task.title}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-[#7E98A6] leading-snug">
                        {task.hint}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* RIGHT WORKBENCH: Scaled White Card Canvas + Export Actions + Viral Captions */}
        <div className="space-y-5 min-w-0">
          {/* Live Scaled Preview Stage */}
          <div className="rounded-2xl border border-slate-900/12 dark:border-white/12 bg-slate-100/90 dark:bg-[#071117] p-4 sm:p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 text-slate-600 dark:text-[#9CB3C0]">
                <span className="font-semibold text-slate-900 dark:text-white">
                  Live White Card Preview
                </span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">{dims.exportLabel}</span>
              </div>
              <span className="text-[11px] text-slate-500 dark:text-[#7E98A6]">
                Exported at crisp 2x Retina scale
              </span>
            </div>

            {/* Responsive scaled canvas wrapper */}
            <div
              ref={previewContainerRef}
              className="w-full overflow-hidden rounded-xl border border-slate-900/12 dark:border-white/15 bg-white shadow-sm"
            >
              <div
                style={{
                  width: '100%',
                  height: scaledHeight,
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                <div
                  ref={exportCanvasRef}
                  style={{
                    width: dims.width,
                    height: dims.height,
                    transform: `scale(${scale})`,
                    transformOrigin: 'top left',
                  }}
                >
                  <SocialCardCanvas
                    template={template}
                    aspect={aspect}
                    customHeadline={customHeadline}
                    showRevenue={showRevenue}
                    showTimestamp={showTimestamp}
                    showFooterUrl={showFooterUrl}
                    leaderboardGames={leaderboardGames}
                    surgeRunnersUp={surgeRunnersUp}
                    primaryGame={effectivePrimaryGame}
                    secondaryGame={effectiveSecondaryGame}
                    milestone={milestone}
                    codeGame={activeCodeGame}
                    selectedCodes={selectedCodes}
                    snapshotDate={snapshotDate}
                  />
                </div>
              </div>
            </div>

            {/* Export & Publishing Action Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={exporting}
                  onClick={() => void handleDownloadPng()}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-600 dark:bg-[#10E89A] text-white dark:text-[#04130D] hover:opacity-90 disabled:opacity-50 transition-opacity whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {exporting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Download className="w-3.5 h-3.5" />
                  )}
                  {exporting ? 'Rendering 2x PNG...' : 'Download PNG (2x)'}
                </button>

                <button
                  type="button"
                  disabled={copyingImage}
                  onClick={() => void handleCopyImage()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg border border-slate-900/15 dark:border-white/15 bg-white dark:bg-[#0D1A21] text-slate-900 dark:text-white hover:border-emerald-500/60 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {copyingImage ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <ImageIcon className="w-3.5 h-3.5" />
                  )}
                  {copyingImage ? 'Copying...' : 'Copy Image'}
                </button>

                <a
                  href={xComposerHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg border border-slate-900/15 dark:border-white/15 bg-slate-950 dark:bg-white text-white dark:text-slate-950 hover:opacity-90 transition-opacity whitespace-nowrap shrink-0"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Open in X Composer
                </a>
              </div>

              {feedbackToast && (
                <div
                  className={`text-xs font-medium ${
                    feedbackToast.type === 'success'
                      ? 'text-emerald-700 dark:text-[#10E89A]'
                      : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {feedbackToast.text}
                </div>
              )}
            </div>
          </div>

          {/* Viral Caption & UTM Reply Workbench */}
          <div className="rounded-2xl border border-slate-900/12 dark:border-white/12 bg-white dark:bg-[#0A161C] p-5 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-900/8 dark:border-white/10">
              <div>
                <h3 className="text-sm font-bold text-slate-950 dark:text-white">
                  Viral Caption & UTM Link Workbench
                </h3>
                <p className="text-xs text-slate-500 dark:text-[#7E98A6]">
                  Main post stays link-free by default for higher X reach; paste the UTM reply immediately underneath.
                </p>
              </div>

              {/* Tone Switcher */}
              <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-[#0D1B22] self-start sm:self-auto">
                {TONE_OPTIONS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setTone(t.id);
                      setCustomMainCaption(null);
                    }}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      tone === t.id
                        ? 'bg-white dark:bg-[#17303C] text-slate-950 dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-[#9CB3C0] hover:text-slate-950 dark:hover:text-white'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Main Post Editor */}
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-slate-800 dark:text-[#E2F1F7]">
                    Main Post Caption
                  </span>
                  <label className="inline-flex items-center gap-1.5 text-slate-500 dark:text-[#8CA4B2] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeLinkInMain}
                      onChange={(e) => {
                        setIncludeLinkInMain(e.target.checked);
                        setCustomMainCaption(null);
                      }}
                      className="h-3.5 w-3.5 rounded accent-emerald-600 cursor-pointer"
                    />
                    Include link in main post
                  </label>
                </div>

                <div className="flex items-center gap-3">
                  {customMainCaption !== null && (
                    <button
                      type="button"
                      onClick={() => setCustomMainCaption(null)}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Reset Auto
                    </button>
                  )}
                  <span
                    className={`font-mono text-xs font-semibold tabular-nums ${
                      isOverLimit
                        ? 'text-rose-600 dark:text-rose-400'
                        : 'text-slate-500 dark:text-[#8CA4B2]'
                    }`}
                  >
                    {charCount} / 280
                  </span>
                </div>
              </div>

              <textarea
                rows={5}
                value={displayedMainCaption}
                onChange={(e) => setCustomMainCaption(e.target.value)}
                className="w-full p-3.5 text-xs leading-relaxed rounded-xl border border-slate-900/12 dark:border-white/12 bg-slate-50 dark:bg-[#0D1A21] text-slate-900 dark:text-[#F1F7FA] focus:outline-none focus:border-emerald-500 resize-y"
              />

              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-slate-500 dark:text-[#7E98A6]">
                  Tip: Add the game studio&apos;s @handle before posting to boost reposts.
                </span>
                <button
                  type="button"
                  onClick={() =>
                    void copyText(
                      'main-post',
                      displayedMainCaption,
                      'Main X post caption copied.'
                    )
                  }
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-950 hover:opacity-90 transition-opacity whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {copiedKey === 'main-post' ? (
                    <Check className="w-3.5 h-3.5" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  Copy Main Post
                </button>
              </div>
            </div>

            {/* Instant Reply Caption with UTM Tracking */}
            <div className="space-y-2 pt-3 border-t border-slate-900/8 dark:border-white/10">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-800 dark:text-[#E2F1F7]">
                  Instant Reply Caption (GA4 UTM Tracked)
                </span>
                <span className="text-[11px] font-mono text-emerald-700 dark:text-[#10E89A]">
                  utm_campaign={template}
                </span>
              </div>

              <div className="p-3.5 rounded-xl border border-slate-900/10 dark:border-white/10 bg-slate-50 dark:bg-[#0D1A21] text-xs text-slate-800 dark:text-[#DCEBF2] whitespace-pre-line leading-relaxed break-all">
                {generatedCaptions.replyPost}
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-slate-500 dark:text-[#7E98A6]">
                  Paste as the first reply under your post to drive clicks without hurting X reach.
                </span>
                <button
                  type="button"
                  onClick={() =>
                    void copyText(
                      'reply-post',
                      generatedCaptions.replyPost,
                      'Reply caption with UTM link copied.'
                    )
                  }
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-900/15 dark:border-white/15 bg-white dark:bg-[#102029] text-slate-900 dark:text-white hover:border-emerald-500/60 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {copiedKey === 'reply-post' ? (
                    <Check className="w-3.5 h-3.5" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  Copy Reply Link
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
