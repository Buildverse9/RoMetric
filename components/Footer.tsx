'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';

const FOOTER_COLUMNS = [
  {
    title: 'Analytics',
    links: [
      { href: '/rankings', label: 'Live Rankings' },
      { href: '/trending', label: 'Trending & Breakouts' },
      { href: '/updates', label: 'Recent Updates' },
      { href: '/compare', label: 'Compare Games' },
    ],
  },
  {
    title: 'Discovery',
    links: [
      { href: '/genres', label: 'Genres & Niches' },
      { href: '/trends', label: 'Keyword Trends' },
      { href: '/similar', label: 'Similar Games' },
      { href: '/codes', label: 'Active Game Codes' },
    ],
  },
  {
    title: 'Asset IDs',
    links: [
      { href: '/ids', label: 'Roblox Asset IDs' },
      { href: '/ids/crosshairs', label: 'Crosshair IDs' },
      { href: '/ids/decals', label: 'Decal & Image IDs' },
      { href: '/ids/music', label: 'Music & Song IDs' },
    ],
  },
  {
    title: 'Intelligence',
    links: [
      { href: '/articles', label: 'Articles & Stories' },
      { href: '/developers', label: 'Studios & Developers' },
      { href: '/weekly', label: 'Weekly Recaps' },
      { href: '/insights', label: 'Revenue & Insights' },
    ],
  },
  {
    title: 'Platform',
    links: [
      { href: '/status', label: 'Roblox API Status' },
      { href: '/guide', label: 'Methodology Guide' },
      { href: '/sitemap.xml', label: 'XML Sitemap' },
    ],
  },
];

export function Footer() {
  return (
    <footer className="mt-16 px-4 sm:px-6 pb-24 md:pb-8">
      <div className="max-w-[1280px] mx-auto liquid-glass rounded-3xl px-6 py-8 space-y-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-4 space-y-3">
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
            <p className="text-xs text-slate-500 dark:text-[#6F8796] max-w-sm leading-relaxed">
              Independent Roblox market intelligence, live CCU charts, update
              velocity, and verified game codes directory. Not affiliated with
              Roblox Corporation. Codes attribution includes{' '}
              <a
                href="https://bloxarchive.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-700 dark:text-[#9CB3C0] underline decoration-emerald-500/40 underline-offset-2 hover:text-emerald-600 dark:hover:text-[#10E89A] transition-colors"
              >
                BloxArchive
              </a>
              .
            </p>
          </div>

          <div className="lg:col-span-8 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-6">
            {FOOTER_COLUMNS.map((col) => (
              <div key={col.title} className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-900 dark:text-[#F1F7FA]">
                  {col.title}
                </p>
                <ul className="space-y-2 text-sm text-slate-600 dark:text-[#9CB3C0]">
                  {col.links.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className="hover:text-emerald-600 dark:hover:text-[#10E89A] transition-colors"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="pt-5 border-t border-slate-900/8 dark:border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-slate-400 dark:text-[#6F8796] tabular-nums">
          <span>© {new Date().getFullYear()} RoMetric. All rights reserved.</span>
          <span>Live telemetry refreshed continuously from public Roblox APIs.</span>
        </div>
      </div>
    </footer>
  );
}
