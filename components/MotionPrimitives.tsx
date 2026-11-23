'use client';

import React, { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import {
  animate,
  motion,
  useMotionValue,
  type HTMLMotionProps,
} from 'motion/react';

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
  formatterRef.current = formatter;
  const [display, setDisplay] = useState(() => formatter(safeTarget));
  const prevTargetRef = useRef<number>(safeTarget);

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
 * Interactive Apple Liquid Glass surface with subtle mouse-tracked
 * specular rim spotlight and silky hover lift.
 */
interface LiquidGlassCardProps extends Omit<HTMLMotionProps<'div'>, 'children'> {
  variant?: 'default' | 'hero' | 'strong' | 'subtle';
  interactive?: boolean;
  spotlight?: boolean;
  children: React.ReactNode;
}

export function LiquidGlassCard({
  variant = 'default',
  interactive = false,
  spotlight = true,
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
      className={`${variantClass} ${spotlight ? 'liquid-spotlight' : ''} ${className}`}
      {...rest}
    >
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
