'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';

export function Footer() {
  return (
    <footer className="mt-16 px-4 sm:px-6 pb-8">
      <div className="max-w-[1280px] mx-auto liquid-glass rounded-3xl px-6 py-7 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2.5">
          <Link
            href="/"
            className="inline-flex items-center rounded-2xl overflow-hidden bg-[#091318] px-3 py-1.5 border border-emerald-500/20 shadow-sm hover:border-emerald-500/45 transition-colors"
          >
            <Image
              src="/assets/aistudio/logowithName_50295ff0.png"
              alt="RoMetric — Operations & Analytics"
              width={184}
              height={54}
              referrerPolicy="no-referrer"
              className="h-10 w-auto object-contain"
            />
          </Link>
          <p className="text-xs text-slate-500 dark:text-[#6F8796] max-w-md">
            Independent Roblox analytics. Not affiliated with Roblox Corporation.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-6 text-sm text-slate-600 dark:text-[#9CB3C0]">
          <Link
            href="/rankings"
            className="hover:text-emerald-600 dark:hover:text-[#10E89A] transition-colors"
          >
            Rankings
          </Link>
          <Link
            href="/trending"
            className="hover:text-emerald-600 dark:hover:text-[#10E89A] transition-colors"
          >
            Trending
          </Link>
          <Link
            href="/compare"
            className="hover:text-emerald-600 dark:hover:text-[#10E89A] transition-colors"
          >
            Compare
          </Link>
          <Link
            href="/developers"
            className="hover:text-emerald-600 dark:hover:text-[#10E89A] transition-colors"
          >
            Developers
          </Link>
          <span className="text-xs text-slate-400 dark:text-[#6F8796] tabular-nums">
            © {new Date().getFullYear()} RoMetric
          </span>
        </div>
      </div>
    </footer>
  );
}
