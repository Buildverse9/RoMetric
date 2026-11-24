'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export function CardDestinationRedirect({
  targetUrl,
  title,
  description,
  previewImageUrl,
}: {
  targetUrl: string;
  title: string;
  description: string;
  previewImageUrl: string;
}) {
  useEffect(() => {
    // Immediate client redirect for human visitors while keeping HTTP 200 + OG tags intact for X/Discord bots
    const timer = window.setTimeout(() => {
      window.location.replace(targetUrl);
    }, 60);
    return () => window.clearTimeout(timer);
  }, [targetUrl]);

  return (
    <div className="max-w-2xl mx-auto px-4 py-14 space-y-6 text-center">
      <div className="space-y-2">
        <div className="text-xs font-semibold text-emerald-600 dark:text-[#10E89A]">
          RoMetric · Opening Live Analytics
        </div>
        <h1 className="font-display text-2xl font-bold text-slate-950 dark:text-white">
          {title}
        </h1>
        <p className="text-sm text-slate-600 dark:text-[#9CB3C0]">
          {description}
        </p>
      </div>

      <div className="rounded-2xl overflow-hidden border border-slate-900/12 dark:border-white/12 bg-white shadow-sm">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={previewImageUrl}
          alt={title}
          className="w-full h-auto block"
          referrerPolicy="no-referrer"
        />
      </div>

      <div>
        <Link
          href={targetUrl}
          className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-full bg-emerald-600 dark:bg-[#10E89A] text-white dark:text-[#04130D] hover:opacity-90 transition-opacity"
        >
          Open on RoMetric
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
