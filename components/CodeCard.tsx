'use client';

import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  HelpCircle,
  Loader2,
  Trash2,
  XCircle,
} from 'lucide-react';
import { formatRelativeTime, formatUtcTimestamp } from '@/lib/format';
import type { CodeStatus, GameCodeRecord } from '@/lib/codes-types';
import { APPLE_SPRING } from './MotionPrimitives';

const STATUS_META: Record<
  CodeStatus,
  {
    label: string;
    textClass: string;
    icon: React.ComponentType<{ className?: string }>;
  }
> = {
  active: {
    label: 'Active',
    textClass: 'text-emerald-700 dark:text-[#10E89A]',
    icon: CheckCircle2,
  },
  pending_verification: {
    label: 'Pending Verification',
    textClass: 'text-amber-700 dark:text-amber-400',
    icon: Clock,
  },
  expired: {
    label: 'Expired',
    textClass: 'text-slate-500 dark:text-[#7893A3]',
    icon: XCircle,
  },
  unverified: {
    label: 'Unverified',
    textClass: 'text-sky-700 dark:text-sky-400',
    icon: HelpCircle,
  },
};

async function copyTextReliably(text: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to legacy textarea fallback for strict mobile webviews
    }
  }
  if (typeof document === 'undefined') return false;
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.top = '-9999px';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const ok = document.execCommand('copy');
    textarea.remove();
    return ok;
  } catch {
    return false;
  }
}

export function CodeCard({
  item,
  compact = false,
  isAdmin = false,
  busy = false,
  onDelete,
  onToggleStatus,
}: {
  item: GameCodeRecord;
  compact?: boolean;
  isAdmin?: boolean;
  busy?: boolean;
  onDelete?: (item: GameCodeRecord) => void | Promise<void>;
  onToggleStatus?: (
    item: GameCodeRecord,
    nextStatus: 'active' | 'expired'
  ) => void | Promise<void>;
}) {
  const [copied, setCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const meta = STATUS_META[item.status] ?? STATUS_META.unverified;
  const StatusIcon = meta.icon;
  const isExpired = item.status === 'expired';

  const handleCopy = async () => {
    const ok = await copyTextReliably(item.code);
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    }
  };

  return (
    <div
      className={`rounded-2xl border transition-colors ${
        isExpired
          ? 'bg-black/[0.018] dark:bg-white/[0.02] border-slate-900/6 dark:border-white/7 opacity-80'
          : 'bg-black/[0.025] dark:bg-white/[0.035] border-slate-900/8 dark:border-white/10 hover:border-emerald-500/35 dark:hover:border-[#10E89A]/35'
      } ${compact ? 'p-3.5' : 'p-4 sm:p-5'}`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
        <div className="min-w-0 flex-1 space-y-1.5">
          {/* Code String + Status Row */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <code
              className={`font-mono font-bold tracking-wide select-all break-all ${
                compact ? 'text-sm sm:text-base' : 'text-base sm:text-lg'
              } ${
                isExpired
                  ? 'line-through text-slate-500 dark:text-[#7893A3]'
                  : 'text-slate-950 dark:text-white'
              }`}
            >
              {item.code}
            </code>

            <span
              className={`inline-flex items-center gap-1 text-xs font-semibold ${meta.textClass}`}
            >
              <StatusIcon className="w-3.5 h-3.5 shrink-0" />
              <span>{meta.label}</span>
            </span>
          </div>

          {/* Honest Reward Description (Never Fabricated) */}
          <p className="text-sm text-slate-700 dark:text-[#C8D9E2] leading-snug">
            {item.rewardDescription ? (
              item.rewardDescription
            ) : (
              <span className="text-slate-500 dark:text-[#7893A3] italic">
                Reward not specified by source
              </span>
            )}
          </p>

          {/* Clean Unboxed Metadata Strip */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 dark:text-[#7893A3] tabular-nums">
            <span>
              {item.lastVerifiedAt
                ? `Checked ${formatRelativeTime(item.lastVerifiedAt)}`
                : `Discovered ${formatRelativeTime(item.discoveredAt)}`}
            </span>

            {item.expiresAt && (
              <>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Expires {formatUtcTimestamp(item.expiresAt)}
                </span>
              </>
            )}

            <span aria-hidden="true">·</span>

            {item.sourceUrl ? (
              <a
                href={item.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-slate-600 dark:text-[#9CB3C0] hover:text-emerald-600 dark:hover:text-[#10E89A] transition-colors"
              >
                <span>{item.sourceAttributionLabel || item.sourceId}</span>
                <ExternalLink className="w-3 h-3 shrink-0" />
              </a>
            ) : (
              <span>{item.sourceAttributionLabel || item.sourceId}</span>
            )}
          </div>
        </div>

        {/* Action Strip: Admin-Only Controls + One-Tap Copy Button */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {isAdmin && (
            <div className="flex items-center gap-1.5">
              {onToggleStatus && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void onToggleStatus(item, isExpired ? 'active' : 'expired')
                  }
                  className="min-h-[38px] px-3 py-1.5 rounded-full text-xs font-semibold border border-slate-900/12 dark:border-white/15 text-slate-700 dark:text-[#C8D9E2] hover:border-emerald-500/45 hover:text-emerald-700 dark:hover:text-[#10E89A] transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
                >
                  {isExpired ? 'Mark Active' : 'Mark Expired'}
                </button>
              )}

              {onDelete &&
                (confirmDelete ? (
                  <div className="inline-flex items-center gap-1">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setConfirmDelete(false);
                        void onDelete(item);
                      }}
                      className="min-h-[38px] px-3 py-1.5 rounded-full text-xs font-semibold bg-rose-600 text-white hover:bg-rose-700 transition-colors cursor-pointer disabled:opacity-50 inline-flex items-center gap-1 whitespace-nowrap"
                    >
                      {busy ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                      <span>Confirm Delete</span>
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setConfirmDelete(false)}
                      className="min-h-[38px] px-2.5 py-1.5 rounded-full text-xs font-medium text-slate-500 dark:text-[#9CB3C0] hover:text-slate-900 dark:hover:text-white cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setConfirmDelete(true)}
                    aria-label={`Delete code ${item.code}`}
                    title={`Delete code ${item.code}`}
                    className="min-h-[38px] px-3 py-1.5 rounded-full text-xs font-semibold border border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300 hover:bg-rose-500/20 transition-colors cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5 whitespace-nowrap"
                  >
                    {busy ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                    <span>Delete</span>
                  </button>
                ))}
            </div>
          )}

          {/* One-Tap Copy Button (44px+ Mobile Ergonomic Target) */}
          <motion.button
            type="button"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.95 }}
            transition={APPLE_SPRING}
            onClick={() => void handleCopy()}
            aria-label={`Copy code ${item.code}`}
            className={`min-h-[44px] px-5 py-2.5 rounded-full text-xs font-semibold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              copied
                ? 'bg-emerald-700 dark:bg-emerald-400 text-white dark:text-[#04130D]'
                : isExpired
                  ? 'bg-black/[0.06] dark:bg-white/[0.08] text-slate-700 dark:text-[#C8D9E2] hover:bg-black/[0.1] dark:hover:bg-white/[0.14]'
                  : 'bg-emerald-600 dark:bg-[#10E89A] text-white dark:text-[#04130D] hover:opacity-90 shadow-sm'
            }`}
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 shrink-0" />
                <span>Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 shrink-0" />
                <span>Copy Code</span>
              </>
            )}
          </motion.button>
        </div>
      </div>
    </div>
  );
}
