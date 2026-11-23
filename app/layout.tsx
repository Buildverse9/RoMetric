import type { Metadata } from 'next';
import './globals.css';
import { AppProvider } from '@/components/AppProvider';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';

export const metadata: Metadata = {
  title: {
    default: 'RoMetric — Roblox Analytics & Intelligence',
    template: '%s | RoMetric',
  },
  description:
    'Discover. Analyze. Grow. Independent Roblox game analytics and market intelligence with live CCU tracking, historical charts, rankings, and comparisons.',
  openGraph: {
    title: 'RoMetric — Roblox Analytics & Intelligence',
    description:
      'Independent Roblox game analytics and market intelligence. Discover trending games, track live CCU, explore historical trends, and compare experiences.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'RoMetric — Roblox Analytics & Intelligence',
    description:
      'Discover. Analyze. Grow. Independent Roblox game analytics and market intelligence.',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap"
        />
      </head>
      <body
        suppressHydrationWarning
        className="min-h-screen bg-[#101820] text-[#E8EEF2] flex flex-col selection:bg-[#48D597]/25 selection:text-[#E8EEF2]"
      >
        <AppProvider>
          <Navbar />
          <main className="flex-1 w-full">{children}</main>
          <Footer />
        </AppProvider>
      </body>
    </html>
  );
}
