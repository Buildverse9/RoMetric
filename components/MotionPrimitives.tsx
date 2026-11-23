'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePathname } from 'next/navigation';
import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  type HTMLMotionProps,
} from 'motion/react';
import { Download, MoreHorizontal, Share2 } from 'lucide-react';
import { useCardShare } from './CardShareProvider';

export const APPLE_SPRING = {
  type: 'spring' as const,
  stiffness: 420,
  damping: 34,
  mass: 0.75,
};

export const APPLE_SOFT_SPRING = {
  type: 'spring' as const,
  stiffness: 280,
  damping: 28,
  mass: 0.85,
};

export const APPLE_EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

/**
 * Smoothly animates numeric transitions (CCU, Est. Revenue, Game counts)
 * using Motion's spring/tween driver with tabular figure stability.
 */
export function AnimatedNumber({
  value,
  formatter,
  className = '',
  duration = 0.75,
}: {
  value: number;
  formatter: (v: number) => string;
  className?: string;
  duration?: number;
}) {
  const safeTarget = Number.isFinite(value) ? value : 0;
  const motionVal = useMotionValue(safeTarget);
  const formatterRef = useRef(formatter);
  const [display, setDisplay] = useState(() => formatter(safeTarget));
  const prevTargetRef = useRef<number>(safeTarget);

  useEffect(() => {
    formatterRef.current = formatter;
  }, [formatter]);

  useEffect(() => {
    const start = prevTargetRef.current;
    prevTargetRef.current = safeTarget;

    if (start === safeTarget) {
      setDisplay(formatterRef.current(safeTarget));
      return;
    }

    const controls = animate(motionVal, safeTarget, {
      duration,
      ease: APPLE_EASE,
      onUpdate: (latest) => {
        setDisplay(formatterRef.current(latest));
      },
      onComplete: () => {
        setDisplay(formatterRef.current(safeTarget));
      },
    });

    return () => controls.stop();
  }, [safeTarget, duration, motionVal]);

  return <span className={`tabular-nums ${className}`}>{display}</span>;
}

/**
 * Reusable 3-dot ("Share" + "Save as Image") popover menu attached to cards.
 */
export function CardActionMenu({
  targetRef,
  exportTitle,
  className = '',
}: {
  targetRef: React.RefObject<HTMLElement | null>;
  exportTitle?: string;
  className?: string;
}) {
  const cardShare = useCardShare();
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(
    null
  );
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        buttonRef.current?.contains(target) ||
        dropdownRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onViewportChange = () => setOpen(false);
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('scroll', onViewportChange, true);
    window.addEventListener('resize', onViewportChange);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('scroll', onViewportChange, true);
      window.removeEventListener('resize', onViewportChange);
    };
  }, [open]);

  if (!cardShare) return null;

  const resolveTitle = () => {
    if (exportTitle) return exportTitle;
    const heading = targetRef.current?.querySelector('h1, h2, h3, p');
    return heading?.textContent?.trim().slice(0, 60) || 'RoMetric Card';
  };

  const handleToggle = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (open) {
      setOpen(false);
      return;
    }
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const menuWidth = 176;
      const menuHeight = 92;
      const left = Math.max(
        12,
        Math.min(window.innerWidth - menuWidth - 12, rect.right - menuWidth)
      );
      const openUpward =
        rect.bottom + menuHeight + 12 > window.innerHeight &&
        rect.top > menuHeight + 12;
      const top = openUpward ? rect.top - menuHeight - 6 : rect.bottom + 6;
      setMenuPos({ top, left });
    }
    setOpen(true);
  };

  const portalDropdown =
    typeof document !== 'undefined'
      ? createPortal(
          <AnimatePresence>
            {open && menuPos && (
              <motion.div
                ref={dropdownRef}
                data-export-ignore="true"
                initial={{ opacity: 0, scale: 0.94, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.94, y: -4 }}
                transition={{ duration: 0.14, ease: APPLE_EASE }}
                style={{
                  position: 'fixed',
                  top: menuPos.top,
                  left: menuPos.left,
                  width: 176,
                }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                className="rounded-2xl liquid-glass-strong p-1.5 shadow-2xl border border-slate-900/12 dark:border-white/15 z-[95]"
              >
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setOpen(false);
                    if (targetRef.current) {
                      void cardShare.openShareCardModal(
                        targetRef.current,
                        resolveTitle()
                      );
                    }
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-800 dark:text-[#F1F7FA] hover:bg-emerald-500/12 hover:text-emerald-700 dark:hover:text-[#10E89A] transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Share2 className="w-3.5 h-3.5 shrink-0" />
                  <span>Share</span>
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setOpen(false);
                    if (targetRef.current) {
                      void cardShare.saveCardAsImage(
                        targetRef.current,
                        resolveTitle()
                      );
                    }
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-800 dark:text-[#F1F7FA] hover:bg-emerald-500/12 hover:text-emerald-700 dark:hover:text-[#10E89A] transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Download className="w-3.5 h-3.5 shrink-0" />
                  <span>Save as Image</span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )
      : null;

  return (
    <div
      data-export-ignore="true"
      className={`relative z-30 ${className}`}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        aria-label="Card options"
        aria-expanded={open}
        onClick={handleToggle}
        className="w-7 h-7 rounded-full inline-flex items-center justify-center text-slate-500 dark:text-[#9CB3C0] hover:text-slate-950 dark:hover:text-white bg-white/70 dark:bg-black/30 hover:bg-white/95 dark:hover:bg-white/15 border border-slate-900/10 dark:border-white/12 transition-all opacity-75 group-hover/card:opacity-100 focus-visible:opacity-100 cursor-pointer"
      >
        <MoreHorizontal className="w-3.5 h-3.5" />
      </button>
      {portalDropdown}
    </div>
  );
}

/**
 * Interactive Apple Liquid Glass surface with subtle mouse-tracked
 * specular rim spotlight, silky hover lift, and built-in 3-dot Share / Save-as-Image menu.
 */
interface LiquidGlassCardProps extends Omit<HTMLMotionProps<'div'>, 'children'> {
  variant?: 'default' | 'hero' | 'strong' | 'subtle';
  interactive?: boolean;
  spotlight?: boolean;
  exportTitle?: string;
  hideCardActions?: boolean;
  children: React.ReactNode;
}

export function LiquidGlassCard({
  variant = 'default',
  interactive = false,
  spotlight = true,
  exportTitle,
  hideCardActions = false,
  className = '',
  children,
  onMouseMove,
  ...rest
}: LiquidGlassCardProps) {
  const cardRef = useRef<HTMLDivElement | null>(null);

  const variantClass =
    variant === 'hero'
      ? 'liquid-glass-hero'
      : variant === 'strong'
        ? 'liquid-glass-strong'
        : variant === 'subtle'
          ? 'liquid-glass-subtle'
          : 'liquid-glass';

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (spotlight && cardRef.current) {
      const rect = cardRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      cardRef.current.style.setProperty('--spot-x', `${x}px`);
      cardRef.current.style.setProperty('--spot-y', `${y}px`);
    }
    onMouseMove?.(e);
  };

  return (
    <motion.div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      whileHover={interactive ? { y: -3, scale: 1.008 } : undefined}
      whileTap={interactive ? { scale: 0.992 } : undefined}
      transition={APPLE_SPRING}
      className={`group/card relative ${variantClass} ${spotlight ? 'liquid-spotlight' : ''} ${className}`}
      {...rest}
    >
      {!hideCardActions && (
        <div
          data-card-actions="true"
          data-export-ignore="true"
          className="absolute top-3 right-3 z-30"
        >
          <CardActionMenu targetRef={cardRef} exportTitle={exportTitle} />
        </div>
      )}
      {children}
    </motion.div>
  );
}

/**
 * Scroll-revealed section container with gentle Apple lift & opacity settle.
 */
export function FadeInSection({
  children,
  className = '',
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14, scale: 0.99 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, amount: 0.05 }}
      transition={{ duration: 0.42, delay, ease: APPLE_EASE }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/**
 * Subtle page-level entrance transition keyed to route pathname.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <motion.div
      key={pathname}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: APPLE_EASE }}
      className="flex-1 w-full"
    >
      {children}
    </motion.div>
  );
}

const DIGIT_STACK = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

function RollingDigitReel({ digit }: { digit: number }) {
  return (
    <span
      aria-hidden="true"
      className="relative inline-flex h-[1.12em] w-[0.62em] overflow-hidden align-baseline justify-center"
    >
      <motion.span
        initial={{ y: `${-Math.max(0, digit - 2) * 1.12}em` }}
        animate={{ y: `${-digit * 1.12}em` }}
        transition={{
          type: 'spring',
          stiffness: 210,
          damping: 26,
          mass: 0.85,
        }}
        className="flex flex-col items-center leading-[1.12em] will-change-transform"
      >
        {DIGIT_STACK.map((n) => (
          <span
            key={n}
            className="h-[1.12em] leading-[1.12em] flex items-center justify-center"
          >
            {n}
          </span>
        ))}
      </motion.span>
    </span>
  );
}

/**
 * Real-time vertical odometer digit animation for live CCU counters.
 * Every digit smoothly rolls into position, with an emerald rise glow
 * and optional floating +delta pulse whenever CCU increases.
 */
export function RollingCcuNumber({
  value,
  className = '',
  showDelta = true,
}: {
  value: number;
  className?: string;
  showDelta?: boolean;
}) {
  const safeVal = Math.max(0, Math.round(Number.isFinite(value) ? value : 0));
  const prevRef = useRef<number | null>(null);
  const [trendFlash, setTrendFlash] = useState<'up' | 'down' | null>(null);
  const [deltaAmount, setDeltaAmount] = useState<number>(0);

  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = safeVal;
    if (prev === null || prev === safeVal) return;

    const diff = safeVal - prev;
    const startTimer = window.setTimeout(() => {
      setTrendFlash(diff > 0 ? 'up' : 'down');
      setDeltaAmount(diff);
    }, 0);
    const clearTimer = window.setTimeout(() => {
      setTrendFlash(null);
      setDeltaAmount(0);
    }, 2400);

    return () => {
      window.clearTimeout(startTimer);
      window.clearTimeout(clearTimer);
    };
  }, [safeVal]);

  const formatted = safeVal.toLocaleString('en-US');
  const chars = formatted.split('');

  return (
    <span
      className={`inline-flex items-baseline gap-2 tabular-nums ${className}`}
      aria-label={formatted}
    >
      <span
        className={`inline-flex items-baseline transition-colors duration-500 ${
          trendFlash === 'up'
            ? 'text-emerald-600 dark:text-[#10E89A] drop-shadow-[0_0_16px_rgba(16,232,154,0.35)]'
            : trendFlash === 'down'
              ? 'text-rose-600 dark:text-rose-400'
              : ''
        }`}
      >
        {chars.map((char, idx) => {
          const posFromRight = chars.length - 1 - idx;
          if (char >= '0' && char <= '9') {
            return (
              <RollingDigitReel
                key={`d-${posFromRight}`}
                digit={Number(char)}
              />
            );
          }
          return (
            <span
              key={`s-${posFromRight}-${char}`}
              aria-hidden="true"
              className="inline-block leading-[1.12em]"
            >
              {char}
            </span>
          );
        })}
      </span>

      <AnimatePresence>
        {showDelta && trendFlash === 'up' && deltaAmount > 0 && (
          <motion.span
            key={`delta-${safeVal}`}
            initial={{ opacity: 0, y: 6, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.94 }}
            transition={{ duration: 0.35, ease: APPLE_EASE }}
            className="text-xs font-bold tracking-normal text-emerald-600 dark:text-[#10E89A] tabular-nums"
          >
            +{deltaAmount.toLocaleString('en-US')}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}
