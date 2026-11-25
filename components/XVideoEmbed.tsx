'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ExternalLink, Film } from 'lucide-react';
import { useApp } from '@/components/AppProvider';
import { LiquidGlassCard } from '@/components/MotionPrimitives';

declare global {
  interface Window {
    twttr?: {
      widgets?: {
        createTweet: (
          tweetId: string,
          container: HTMLElement,
          options?: Record<string, unknown>
        ) => Promise<HTMLElement | undefined>;
      };
    };
  }
}

const X_STATUS_REGEX =
  /^https?:\/\/(?:www\.|mobile\.)?(?:x\.com|twitter\.com)\/[A-Za-z0-9_]{1,15}\/status\/(\d{6,25})/i;

export function extractXStatusId(input: string): string | null {
  const match = input.trim().match(X_STATUS_REGEX);
  return match?.[1] ?? null;
}

function loadTwitterWidgetsScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      resolve();
      return;
    }
    if (window.twttr?.widgets?.createTweet) {
      resolve();
      return;
    }
    const existing = document.getElementById('x-widgets-js');
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener(
        'error',
        () => reject(new Error('X embed script failed')),
        { once: true }
      );
      return;
    }
    const script = document.createElement('script');
    script.id = 'x-widgets-js';
    script.src = 'https://platform.twitter.com/widgets.js';
    script.async = true;
    script.charset = 'utf-8';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Unable to load X embed script'));
    document.body.appendChild(script);
  });
}

interface SingleXEmbedProps {
  url: string;
  tweetId: string;
  theme: 'dark' | 'light';
}

function SingleXEmbed({ url, tweetId, theme }: SingleXEmbedProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    let cancelled = false;
    const container = containerRef.current;
    if (!container) return;

    container.innerHTML = '';

    loadTwitterWidgetsScript()
      .then(() => {
        if (cancelled || !containerRef.current) return;
        if (!window.twttr?.widgets?.createTweet) {
          setStatus('error');
          return;
        }
        return window.twttr.widgets
          .createTweet(tweetId, containerRef.current, {
            theme,
            dnt: true,
            align: 'center',
          })
          .then((el) => {
            if (cancelled) return;
            setStatus(el ? 'ready' : 'error');
          });
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });

    return () => {
      cancelled = true;
    };
  }, [tweetId, theme]);

  return (
    <div className="rounded-2xl border border-slate-900/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.025] p-3 sm:p-5">
      {status === 'loading' && (
        <div className="py-12 text-center text-xs text-slate-500 dark:text-[#86A1B0]">
          Loading video from X...
        </div>
      )}

      <div ref={containerRef} className="w-full overflow-hidden flex justify-center" />

      {status === 'error' && (
        <div className="py-6 text-center space-y-2">
          <p className="text-xs text-slate-600 dark:text-[#9CB3C0]">
            Embedded X video could not load in this browser (tracking protection
            may block X embeds).
          </p>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-[#10E89A] hover:underline"
          >
            Watch video directly on X
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      )}
    </div>
  );
}

interface XVideoEmbedSectionProps {
  urls: string[];
  xSearchUrl?: string;
  xSearchLabel?: string;
}

export function XVideoEmbedSection({
  urls,
  xSearchUrl,
  xSearchLabel,
}: XVideoEmbedSectionProps) {
  const { theme } = useApp();

  const embedItems = urls
    .map((url) => ({
      url,
      tweetId: extractXStatusId(url),
    }))
    .filter((item): item is { url: string; tweetId: string } =>
      Boolean(item.tweetId)
    );

  if (embedItems.length === 0) return null;

  return (
    <LiquidGlassCard className="rounded-[28px] p-5 sm:p-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Film className="w-5 h-5 text-emerald-600 dark:text-[#10E89A]" />
            <h2 className="font-display text-lg sm:text-xl font-bold text-slate-950 dark:text-white">
              Watch Gameplay Clip on X
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-[#9CB3C0]">
            See what actually happens when you launch &ldquo;GTA 6&rdquo; on
            Roblox—the copied loading screen plays on loop and never starts.
          </p>
        </div>

        {xSearchUrl && (
          <a
            href={xSearchUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold liquid-glass-pill text-slate-800 dark:text-[#F1F7FA] hover:border-emerald-500/50 rounded-full transition-colors whitespace-nowrap shrink-0 w-fit"
          >
            {xSearchLabel || 'View on X'}
            <ExternalLink className="w-3.5 h-3.5 text-emerald-600 dark:text-[#10E89A]" />
          </a>
        )}
      </div>

      <div
        className={`grid grid-cols-1 ${
          embedItems.length > 1 ? 'md:grid-cols-2' : ''
        } gap-4`}
      >
        {embedItems.map((item) => (
          <SingleXEmbed
            key={item.tweetId}
            url={item.url}
            tweetId={item.tweetId}
            theme={theme}
          />
        ))}
      </div>
    </LiquidGlassCard>
  );
}
