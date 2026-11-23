'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import Image from 'next/image';
import { AnimatePresence, motion } from 'motion/react';
import {
  Camera,
  Check,
  Copy,
  Download,
  Facebook,
  Link2,
  Loader2,
  MessageCircle,
  Share2,
  X,
  Youtube,
} from 'lucide-react';
import {
  captureCardAsWhitePng,
  copyCardImageToClipboard,
  downloadPngDataUrl,
  shareCardToPlatform,
  type CapturedCardImage,
  type SharePlatform,
} from '@/lib/card-export';

interface CardShareContextValue {
  saveCardAsImage: (element: HTMLElement, title?: string) => Promise<void>;
  openShareCardModal: (element: HTMLElement, title?: string) => Promise<void>;
}

const CardShareContext = createContext<CardShareContextValue | null>(null);

export function useCardShare() {
  return useContext(CardShareContext);
}

const SHARE_PLATFORMS: Array<{
  id: SharePlatform;
  label: string;
  accent: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    id: 'whatsapp',
    label: 'WhatsApp',
    accent: 'bg-[#25D366]/14 text-[#16A34A] dark:text-[#4ADE80] border-[#25D366]/30 hover:bg-[#25D366]/22',
    icon: MessageCircle,
  },
  {
    id: 'instagram',
    label: 'Instagram',
    accent: 'bg-[#E1306C]/12 text-[#DB2777] dark:text-[#F472B6] border-[#E1306C]/30 hover:bg-[#E1306C]/20',
    icon: Camera,
  },
  {
    id: 'facebook',
    label: 'Facebook',
    accent: 'bg-[#1877F2]/12 text-[#2563EB] dark:text-[#60A5FA] border-[#1877F2]/30 hover:bg-[#1877F2]/20',
    icon: Facebook,
  },
  {
    id: 'x',
    label: 'X',
    accent: 'bg-slate-900/10 dark:bg-white/10 text-slate-900 dark:text-white border-slate-900/20 dark:border-white/20 hover:bg-slate-900/15 dark:hover:bg-white/15',
    icon: Share2,
  },
  {
    id: 'youtube',
    label: 'YouTube',
    accent: 'bg-[#FF0000]/12 text-[#DC2626] dark:text-[#F87171] border-[#FF0000]/30 hover:bg-[#FF0000]/20',
    icon: Youtube,
  },
];

export function CardShareProvider({ children }: { children: React.ReactNode }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [captured, setCaptured] = useState<CapturedCardImage | null>(null);
  const [modalTitle, setModalTitle] = useState('Share Card');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedImg, setCopiedImg] = useState(false);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (!modalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setModalOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modalOpen]);

  const saveCardAsImage = useCallback(
    async (element: HTMLElement, title?: string) => {
      showToast('Rendering white-mode PNG...');
      try {
        const result = await captureCardAsWhitePng(element, { title });
        downloadPngDataUrl(result.dataUrl, result.filename);
        showToast(`Saved ${result.filename}`);
      } catch {
        showToast('Unable to save card image.');
      }
    },
    [showToast]
  );

  const openShareCardModal = useCallback(
    async (element: HTMLElement, title?: string) => {
      setModalTitle(title?.trim() || 'Share Card');
      setCaptured(null);
      setFeedback(null);
      setCopiedLink(false);
      setCopiedImg(false);
      setModalOpen(true);
      setCapturing(true);
      try {
        const result = await captureCardAsWhitePng(element, { title });
        setCaptured(result);
      } catch {
        setFeedback('Could not generate preview image. Please try again.');
      } finally {
        setCapturing(false);
      }
    },
    []
  );

  const handlePlatformClick = async (platform: SharePlatform) => {
    if (!captured) return;
    const res = await shareCardToPlatform(platform, captured);
    setFeedback(res.message);
  };

  const handleCopyImage = async () => {
    if (!captured) return;
    const ok = await copyCardImageToClipboard(captured.blob);
    if (ok) {
      setCopiedImg(true);
      setFeedback('White-mode card image copied to clipboard.');
      setTimeout(() => setCopiedImg(false), 2000);
    } else {
      downloadPngDataUrl(captured.dataUrl, captured.filename);
      setFeedback('Downloaded PNG image.');
    }
  };

  const handleCopyLink = async () => {
    if (!captured) return;
    try {
      await navigator.clipboard.writeText(captured.shareUrl);
      setCopiedLink(true);
      setFeedback('Link copied to clipboard.');
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      setFeedback(captured.shareUrl);
    }
  };

  return (
    <CardShareContext.Provider
      value={{ saveCardAsImage, openShareCardModal }}
    >
      {children}

      {/* Floating confirmation toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
            className="fixed bottom-24 md:bottom-6 right-5 z-[90] liquid-glass-strong rounded-full px-4 py-2.5 text-xs font-semibold text-slate-900 dark:text-white flex items-center gap-2 shadow-xl"
          >
            <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-[#10E89A]" />
            <span>{toast}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Share Card Modal */}
      <AnimatePresence>
        {modalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-[80] bg-slate-950/55 backdrop-blur-md flex items-center justify-center p-4"
            onClick={() => setModalOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 14 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              transition={{ type: 'spring', stiffness: 420, damping: 34 }}
              className="w-full max-w-lg liquid-glass-strong rounded-[28px] overflow-hidden shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-slate-900/8 dark:border-white/10">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="relative w-8 h-8 rounded-xl overflow-hidden bg-[#091318] ring-1 ring-emerald-500/30 shrink-0">
                    <Image
                      src="/assets/aistudio/logoofrometric_7c92ca67.png"
                      alt="RoMetric"
                      fill
                      sizes="32px"
                      referrerPolicy="no-referrer"
                      className="object-cover"
                    />
                  </span>
                  <div className="min-w-0">
                    <h3 className="font-display text-base font-bold text-slate-950 dark:text-white truncate">
                      Share Card Image
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-[#9CB3C0] truncate">
                      {modalTitle} · White Mode PNG with website link
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  aria-label="Close share dialog"
                  className="p-2 rounded-full text-slate-500 dark:text-[#9CB3C0] hover:text-slate-950 dark:hover:text-white hover:bg-black/[0.05] dark:hover:bg-white/[0.08] transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* White-Mode Preview */}
              <div className="p-5 space-y-5 max-h-[80vh] overflow-y-auto">
                <div className="rounded-2xl bg-slate-100 dark:bg-black/35 border border-slate-900/8 dark:border-white/10 p-3 flex items-center justify-center min-h-[190px]">
                  {capturing ? (
                    <div className="flex flex-col items-center gap-2 text-xs text-slate-500 dark:text-[#9CB3C0] py-8">
                      <Loader2 className="w-5 h-5 animate-spin text-emerald-600 dark:text-[#10E89A]" />
                      <span>Rendering crisp white-mode image...</span>
                    </div>
                  ) : captured ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={captured.dataUrl}
                      alt={captured.title}
                      className="max-h-[260px] w-auto rounded-xl shadow-md border border-slate-200 object-contain bg-white"
                    />
                  ) : (
                    <p className="text-xs text-slate-500 dark:text-[#9CB3C0]">
                      Preview unavailable.
                    </p>
                  )}
                </div>

                {/* 5 Requested Share Platforms */}
                <div className="space-y-2.5">
                  <p className="text-xs font-semibold text-slate-500 dark:text-[#9CB3C0]">
                    Share to
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    {SHARE_PLATFORMS.map((p) => {
                      const Icon = p.icon;
                      return (
                        <motion.button
                          key={p.id}
                          type="button"
                          disabled={!captured}
                          whileHover={{ y: -2, scale: 1.02 }}
                          whileTap={{ scale: 0.96 }}
                          onClick={() => void handlePlatformClick(p.id)}
                          className={`flex flex-col items-center justify-center gap-1.5 py-3 px-2 rounded-2xl border text-xs font-semibold transition-colors cursor-pointer disabled:opacity-40 ${p.accent}`}
                        >
                          <Icon className="w-4 h-4" />
                          <span className="whitespace-nowrap">{p.label}</span>
                        </motion.button>
                      );
                    })}
                  </div>
                </div>

                {/* Quick Utility Actions */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    disabled={!captured}
                    onClick={() =>
                      captured &&
                      downloadPngDataUrl(captured.dataUrl, captured.filename)
                    }
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-semibold bg-emerald-600 dark:bg-[#10E89A] text-white dark:text-[#04130D] rounded-full hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-40 whitespace-nowrap"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Save PNG
                  </button>
                  <button
                    type="button"
                    disabled={!captured}
                    onClick={() => void handleCopyImage()}
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-semibold liquid-glass-pill text-slate-800 dark:text-[#F1F7FA] hover:border-emerald-500/40 rounded-full transition-colors cursor-pointer disabled:opacity-40 whitespace-nowrap"
                  >
                    {copiedImg ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-[#10E89A]" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    {copiedImg ? 'Copied' : 'Copy Image'}
                  </button>
                  <button
                    type="button"
                    disabled={!captured}
                    onClick={() => void handleCopyLink()}
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-semibold liquid-glass-pill text-slate-800 dark:text-[#F1F7FA] hover:border-emerald-500/40 rounded-full transition-colors cursor-pointer disabled:opacity-40 whitespace-nowrap"
                  >
                    {copiedLink ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-[#10E89A]" />
                    ) : (
                      <Link2 className="w-3.5 h-3.5" />
                    )}
                    {copiedLink ? 'Copied' : 'Copy Link'}
                  </button>
                </div>

                {feedback && (
                  <p className="text-xs text-emerald-700 dark:text-[#10E89A] font-medium text-center">
                    {feedback}
                  </p>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </CardShareContext.Provider>
  );
}
