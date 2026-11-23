import type { Metadata } from 'next';
import './globals.css';
import { AppProvider } from '@/components/AppProvider';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { PageTransition } from '@/components/MotionPrimitives';

export const metadata: Metadata = {
  metadataBase: new URL('https://rometrics.vercel.app'),
  title: {
    default: 'RoMetric — Roblox Analytics',
    template: '%s | RoMetric',
  },
  description:
    'Live Roblox game analytics, player rankings, breakout games, estimated revenue, and historical charts.',
  icons: {
    icon: '/assets/aistudio/logoofrometric_7c92ca67.png',
    shortcut: '/assets/aistudio/logoofrometric_7c92ca67.png',
    apple: '/assets/aistudio/logoofrometric_7c92ca67.png',
  },
  openGraph: {
    title: 'RoMetric — Roblox Analytics',
    description:
      'Track live Roblox player counts, breakout games, estimated revenue, rankings, and historical trends.',
    type: 'website',
    images: ['/assets/aistudio/logowithName_50295ff0.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'RoMetric — Roblox Analytics',
    description:
      'Live Roblox game analytics, player rankings, breakout games, estimated revenue, and historical charts.',
    images: ['/assets/aistudio/logowithName_50295ff0.png'],
  },
};

const THEME_INIT_SCRIPT = `
(function() {
  try {
    var stored = localStorage.getItem('rometric-theme');
    var theme = stored === 'light' || stored === 'dark' ? stored : 'dark';
    var root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    root.classList.toggle('light', theme === 'light');
    root.dataset.theme = theme;
    root.style.colorScheme = theme;
  } catch (e) {
    document.documentElement.classList.add('dark');
    document.documentElement.dataset.theme = 'dark';
    document.documentElement.style.colorScheme = 'dark';
  }
})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
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
