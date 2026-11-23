'use client';

import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { CheckCircle2, Loader2, Send, ShieldAlert, X } from 'lucide-react';
import { APPLE_SPRING } from './MotionPrimitives';

export function SubmitCodeModal({
  open,
  onClose,
  defaultGameInput = '',
  defaultGameName = '',
  onSubmitted,
}: {
  open: boolean;
  onClose: () => void;
  defaultGameInput?: string;
  defaultGameName?: string;
  onSubmitted?: () => void;
}) {
  return (
    <AnimatePresence>
      {open && (
        <SubmitCodeModalDialog
          key={defaultGameInput || 'default'}
          onClose={onClose}
          defaultGameInput={defaultGameInput}
          defaultGameName={defaultGameName}
          onSubmitted={onSubmitted}
        />
      )}
    </AnimatePresence>
  );
}

function SubmitCodeModalDialog({
  onClose,
  defaultGameInput,
  defaultGameName,
  onSubmitted,
}: {
  onClose: () => void;
  defaultGameInput: string;
  defaultGameName: string;
  onSubmitted?: () => void;
}) {
  const [gameInput, setGameInput] = useState(defaultGameInput);
  const [code, setCode] = useState('');
  const [rewardDescription, setRewardDescription] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [submitterNote, setSubmitterNote] = useState('');
  const [website, setWebsite] = useState(''); // Hidden spam honeypot
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!gameInput.trim()) {
      setErrorMsg('Enter a Roblox Game URL, Universe ID, or exact game name.');
      return;
    }
    if (code.trim().length < 3) {
      setErrorMsg('Enter a valid promo code (at least 3 characters).');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/codes/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameInput: gameInput.trim(),
          code: code.trim(),
          rewardDescription: rewardDescription.trim() || undefined,
          sourceUrl: sourceUrl.trim() || undefined,
          submitterNote: submitterNote.trim() || undefined,
          website,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        message?: string;
      };

      if (!res.ok || !data.ok) {
        setErrorMsg(
          data.message || 'Unable to submit this code right now. Please try again.'
        );
        return;
      }

      setSuccessMsg(
        data.message ||
          'Submitted to Pending Verification. It will appear as Active once verified by Admin.'
      );
      setCode('');
      setRewardDescription('');
      setSourceUrl('');
      setSubmitterNote('');
      onSubmitted?.();
    } catch {
      setErrorMsg('Network error submitting code. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          className="fixed inset-0 z-[80] bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            transition={APPLE_SPRING}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg liquid-glass-strong rounded-[28px] overflow-hidden shadow-2xl"
          >
            <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-slate-900/8 dark:border-white/10">
              <div className="min-w-0">
                <h2 className="font-display text-lg font-bold text-slate-950 dark:text-white truncate">
                  {defaultGameName
                    ? `Submit Code for ${defaultGameName}`
                    : 'Submit a Roblox Game Code'}
                </h2>
                <p className="text-xs text-slate-500 dark:text-[#9CB3C0]">
                  All community & developer submissions enter Pending Verification
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close submission dialog"
                className="p-2 rounded-full text-slate-500 dark:text-[#9CB3C0] hover:text-slate-950 dark:hover:text-white hover:bg-black/[0.05] dark:hover:bg-white/[0.08] transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Honeypot hidden field */}
              <div className="hidden" aria-hidden="true">
                <label htmlFor="code-submit-website">Website</label>
                <input
                  id="code-submit-website"
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="submit-game-input"
                  className="block text-xs font-semibold text-slate-700 dark:text-[#C8D9E2]"
                >
                  Roblox Game URL or Universe ID *
                </label>
                <input
                  id="submit-game-input"
                  type="text"
                  required
                  value={gameInput}
                  onChange={(e) => setGameInput(e.target.value)}
                  placeholder="https://www.roblox.com/games/... or Universe ID"
                  className="w-full px-4 py-2.5 text-sm rounded-xl bg-black/[0.03] dark:bg-white/[0.05] border border-slate-900/12 dark:border-white/12 text-slate-900 dark:text-[#F1F7FA] placeholder:text-slate-400 dark:placeholder:text-[#6F8796] focus:outline-none focus:ring-2 focus:ring-emerald-500/40 dark:focus:ring-[#10E89A]/40"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="submit-code-input"
                  className="block text-xs font-semibold text-slate-700 dark:text-[#C8D9E2]"
                >
                  Promo Code *
                </label>
                <input
                  id="submit-code-input"
                  type="text"
                  required
                  maxLength={42}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="e.g. UPDATE24BOOST"
                  className="w-full px-4 py-2.5 text-sm font-mono rounded-xl bg-black/[0.03] dark:bg-white/[0.05] border border-slate-900/12 dark:border-white/12 text-slate-900 dark:text-[#F1F7FA] placeholder:text-slate-400 dark:placeholder:text-[#6F8796] focus:outline-none focus:ring-2 focus:ring-emerald-500/40 dark:focus:ring-[#10E89A]/40"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="submit-reward-input"
                  className="block text-xs font-semibold text-slate-700 dark:text-[#C8D9E2]"
                >
                  Reward Description (optional)
                </label>
                <input
                  id="submit-reward-input"
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
                  htmlFor="submit-source-url"
                  className="block text-xs font-semibold text-slate-700 dark:text-[#C8D9E2]"
                >
                  Official Source URL (Discord, X, Group, or Game Page)
                </label>
                <input
                  id="submit-source-url"
                  type="url"
                  maxLength={400}
                  value={sourceUrl}
                  onChange={(e) => setSourceUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-4 py-2.5 text-sm rounded-xl bg-black/[0.03] dark:bg-white/[0.05] border border-slate-900/12 dark:border-white/12 text-slate-900 dark:text-[#F1F7FA] placeholder:text-slate-400 dark:placeholder:text-[#6F8796] focus:outline-none focus:ring-2 focus:ring-emerald-500/40 dark:focus:ring-[#10E89A]/40"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="submit-note"
                  className="block text-xs font-semibold text-slate-700 dark:text-[#C8D9E2]"
                >
                  Developer / Submitter Note (optional)
                </label>
                <input
                  id="submit-note"
                  type="text"
                  maxLength={140}
                  value={submitterNote}
                  onChange={(e) => setSubmitterNote(e.target.value)}
                  placeholder="e.g. Announced in official studio update log"
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

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-full text-xs font-semibold text-slate-600 dark:text-[#9CB3C0] hover:text-slate-950 dark:hover:text-white transition-colors cursor-pointer"
                >
                  Close
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
                    <Send className="w-3.5 h-3.5" />
                  )}
                  <span>{submitting ? 'Submitting...' : 'Submit for Review'}</span>
                </motion.button>
              </div>
            </form>
          </motion.div>
        </motion.div>
  );
}
