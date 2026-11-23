'use client';

import React, { useEffect } from 'react';
import Script from 'next/script';
import { usePathname } from 'next/navigation';

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

const RAW_GA_ID = (process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || '').trim();
const VALID_GA_ID = /^G-[A-Z0-9]{4,20}$/i.test(RAW_GA_ID) ? RAW_GA_ID : '';

export function GoogleAnalytics() {
  const pathname = usePathname();

  useEffect(() => {
    if (!VALID_GA_ID || typeof window === 'undefined' || !window.gtag) return;
    window.gtag('config', VALID_GA_ID, {
      page_path: pathname,
    });
  }, [pathname]);

  if (!VALID_GA_ID) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(VALID_GA_ID)}`}
        strategy="afterInteractive"
      />
      <Script id="rometric-ga4-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          window.gtag = gtag;
          gtag('js', new Date());
          gtag('config', '${VALID_GA_ID}', { send_page_view: true });
        `}
      </Script>
    </>
  );
}
