import type { Metadata } from 'next';
import { Inter, Space_Grotesk } from 'next/font/google';
import './globals.css';
import { AppProvider } from '@/components/AppProvider';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-inter',
  display: 'swap',
});

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-space-grotesk',
  display: 'swap',
});

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
    <html lang="en" className={`${inter.variable} ${spaceGrotesk.variable} dark`}>
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
