import type { Metadata } from 'next';
import './globals.css';
import { AppProvider } from '@/components/AppProvider';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { PageTransition } from '@/components/MotionPrimitives';
import { GoogleAnalytics } from '@/components/GoogleAnalytics';
import { Analytics } from '@vercel/analytics/next';

const SITE_URL = 'https://rometrics.vercel.app';
const GOOGLE_VERIFICATION = (
  process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || ''
).trim();

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'RoMetric — Live Roblox Game Analytics, Rankings & Codes',
    template: '%s | RoMetric',
  },
  description:
    'Track live Roblox player counts (CCU), game rankings, breakout hits, estimated Robux revenue, historical charts, and verified Roblox game codes on RoMetric.',
  keywords: [
    'Roblox analytics',
    'Roblox live player count',
    'Roblox CCU tracker',
    'Roblox game rankings',
    'Roblox game codes',
    'Roblox active codes',
    'Roblox game revenue estimator',
  ],
  alternates: {
    canonical: '/',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: GOOGLE_VERIFICATION
    ? { google: GOOGLE_VERIFICATION }
    : undefined,
  icons: {
    icon: '/assets/aistudio/logoofrometric_7c92ca67.png',
    shortcut: '/assets/aistudio/logoofrometric_7c92ca67.png',
    apple: '/assets/aistudio/logoofrometric_7c92ca67.png',
  },
  openGraph: {
    title: 'RoMetric — Live Roblox Game Analytics, Rankings & Codes',
    description:
      'Track live Roblox player counts, breakout games, estimated revenue, rankings, historical trends, and verified game codes.',
    url: SITE_URL,
    siteName: 'RoMetric',
    type: 'website',
    images: ['/assets/aistudio/logowithName_50295ff0.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'RoMetric — Live Roblox Game Analytics, Rankings & Codes',
    description:
      'Live Roblox game analytics, player rankings, breakout games, estimated revenue, historical charts, and active Roblox game codes.',
    images: ['/assets/aistudio/logowithName_50295ff0.png'],
  },
};

const SITE_STRUCTURED_DATA = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebSite',
      name: 'RoMetric',
      url: SITE_URL,
      description:
        'Live Roblox game analytics, CCU rankings, breakout games, and automated Roblox game codes database.',
      potentialAction: {
        '@type': 'SearchAction',
        target: `${SITE_URL}/codes?q={search_term_string}`,
        'query-input': 'required name=search_term_string',
      },
    },
    {
      '@type': 'WebApplication',
      name: 'RoMetric',
      url: SITE_URL,
      applicationCategory: 'GameApplication',
      operatingSystem: 'All',
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD',
      },
    },
  ],
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

const RAW_GTM_ID = (
  process.env.NEXT_PUBLIC_GTM_ID || 'GTM-5B3QCDG2'
).trim();
const VALID_GTM_ID = /^GTM-[A-Z0-9]{4,16}$/i.test(RAW_GTM_ID)
  ? RAW_GTM_ID
  : '';

const GTM_INIT_SCRIPT = VALID_GTM_ID
  ? `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${VALID_GTM_ID}');`
  : '';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {VALID_GTM_ID && (
          <script
            id="rometric-gtm-head"
            dangerouslySetInnerHTML={{ __html: GTM_INIT_SCRIPT }}
          />
        )}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(SITE_STRUCTURED_DATA).replace(/</g, '\\u003c'),
          }}
        />
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
        {VALID_GTM_ID && (
          <noscript>
            <iframe
              src={`https://www.googletagmanager.com/ns.html?id=${encodeURIComponent(VALID_GTM_ID)}`}
              height="0"
              width="0"
              className="hidden"
            />
          </noscript>
        )}
        <GoogleAnalytics />
        <AppProvider>
          <Navbar />
          <main className="flex-1 w-full">
            <PageTransition>{children}</PageTransition>
          </main>
          <Footer />
        </AppProvider>
        <Analytics />
      </body>
    </html>
  );
}
