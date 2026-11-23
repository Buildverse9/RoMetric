'use client';

import React from 'react';
import Link from 'next/link';
import { BarChart2 } from 'lucide-react';

export function Footer() {
  return (
    <footer className="mt-20 border-t border-[#263844] bg-[#0D141B]">
      <div className="max-w-[1360px] mx-auto px-4 sm:px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 pb-10 border-b border-[#263844]">
          <div className="md:col-span-2 space-y-3">
            <Link href="/" className="inline-flex items-center gap-2.5">
              <span className="w-6 h-6 rounded-md bg-[#48D597] flex items-center justify-center text-[#101820]">
                <BarChart2 className="w-3.5 h-3.5 stroke-[2.5]" />
              </span>
              <span className="font-display text-base font-bold text-[#E8EEF2]">
                RoMetric
              </span>
            </Link>
            <p className="text-sm text-[#9BB0BD] max-w-md leading-relaxed">
              Discover. Analyze. Grow. Independent Roblox game analytics and market
              intelligence built on transparent, directly observed public data.
            </p>
            <p className="text-xs text-[#6E8492] max-w-md leading-relaxed">
              Every player count, visit total, and historical chart on RoMetric is
              derived exclusively from timestamped observations of official Roblox
              public APIs. Missing history is shown as N/A and never fabricated.
            </p>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-[#E8EEF2]">Platform</h3>
            <ul className="space-y-2 text-sm text-[#9BB0BD]">
              <li>
                <Link href="/rankings" className="hover:text-[#48D597] transition-colors">
                  Game Rankings
                </Link>
              </li>
              <li>
                <Link href="/trending" className="hover:text-[#48D597] transition-colors">
                  Trending Discovery
                </Link>
              </li>
              <li>
                <Link href="/compare" className="hover:text-[#48D597] transition-colors">
                  Compare Experiences
                </Link>
              </li>
              <li>
                <Link href="/developers" className="hover:text-[#48D597] transition-colors">
                  Developer Analytics
                </Link>
              </li>
            </ul>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-[#E8EEF2]">
              Transparency & Operations
            </h3>
            <ul className="space-y-2 text-sm text-[#9BB0BD]">
              <li>
                <Link href="/methodology" className="hover:text-[#48D597] transition-colors">
                  Methodology & Data Sources
                </Link>
              </li>
              <li>
                <Link href="/methodology#revenue" className="hover:text-[#48D597] transition-colors">
                  Revenue Estimation Policy
                </Link>
              </li>
              <li>
                <Link href="/methodology#disclaimer" className="hover:text-[#48D597] transition-colors">
                  Legal & Affiliation Disclaimer
                </Link>
              </li>
              <li>
                <Link href="/admin" className="hover:text-[#48D597] transition-colors">
                  Owner Admin Console
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-[#6E8492]">
          <p>
            RoMetric is an independent analytics platform and is not affiliated with,
            endorsed by, or sponsored by Roblox Corporation. All Roblox trademarks and
            game imagery belong to their respective owners.
          </p>
          <p className="whitespace-nowrap shrink-0 tabular-nums">
            © {new Date().getFullYear()} RoMetric
          </p>
        </div>
      </div>
    </footer>
  );
}
