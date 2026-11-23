'use client';

import React from 'react';
import Link from 'next/link';
import { BarChart2 } from 'lucide-react';

export function Footer() {
  return (
    <footer className="mt-16 px-4 sm:px-6 pb-8">
      <div className="max-w-[1280px] mx-auto liquid-glass rounded-3xl px-6 py-7 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2">
          <Link href="/" className="inline-flex items-center gap-2.5">
            <span className="w-6 h-6 rounded-full bg-emerald-600 dark:bg-[#10E89A] flex items-center justify-center text-white dark:text-[#04130D]">
              <BarChart2 className="w-3.5 h-3.5 stroke-[2.5]" />
            </span>
            <span className="font-display text-base font-bold text-slate-900 dark:text-[#F1F7FA]">
              RoMetric
            </span>
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
