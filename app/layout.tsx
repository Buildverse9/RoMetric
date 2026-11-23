import type { Metadata } from 'next';
import './globals.css';
import { AppProvider } from '@/components/AppProvider';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { PageTransition } from '@/components/MotionPrimitives';

export const metadata: Metadata = {
  title: {
    default: 'RoMetric — Roblox Analytics',
    template: '%s | RoMetric',
  },
  description:
    'Live Roblox game analytics, player rankings, breakout games, estimated revenue, and historical charts.',
  openGraph: {
    title: 'RoMetric — Roblox Analytics',
    description:
      'Track live Roblox player counts, breakout games, estimated revenue, rankings, and historical trends.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'RoMetric — Roblox Analytics',
    description:
      'Live Roblox game analytics, player rankings, breakout games, estimated revenue, and historical charts.',
  },
};

const THEME_INIT_SCRIPT = `
(function() {
  try {
    var stored = localStorage.getItem('rometric-theme');
    var theme = stored === 'light' || stored === 'dark' ? stored : 'dark';
    document.documentElement.classList.toggle('dark', theme === 'dark');
  } catch (e) {
    document.documentElement.classList.add('dark');
  }
})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap"
        />
      </head>
      <body
        suppressHydrationWarning
        className="min-h-screen flex flex-col text-slate-900 dark:text-[#F1F7FA] selection:bg-emerald-500/25 selection:text-emerald-950 dark:selection:text-white transition-colors duration-200 pb-20 md:pb-0"
      >
        <AppProvider>
          <Navbar />
          <main className="flex-1 w-full">
            <PageTransition>{children}</PageTransition>
          </main>
          <Footer />
        </AppProvider>
      </body>
    </html>
  );
}
