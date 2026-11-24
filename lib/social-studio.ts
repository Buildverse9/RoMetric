'use client';

import { toPng } from 'html-to-image';
import { getTodayUtcKey } from './social-studio-shared';

export * from './social-studio-shared';

function isRobloxCdnUrl(src: string): boolean {
  try {
    const u = new URL(src, window.location.href);
    return (
      u.protocol === 'https:' &&
      u.hostname.toLowerCase().endsWith('.rbxcdn.com')
    );
  } catch {
    return false;
  }
}

export function getProxiedArtworkUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('/')) return url;
  if (url.includes('.rbxcdn.com')) {
    return `/api/roblox/image-proxy?url=${encodeURIComponent(url)}`;
  }
  return url;
}

async function waitForImages(
  container: HTMLElement,
  timeoutMs = 3500
): Promise<void> {
  const imgs = Array.from(container.querySelectorAll('img'));
  if (imgs.length === 0) return;

  await Promise.race([
    Promise.all(
      imgs.map(
        (img) =>
          new Promise<void>((resolve) => {
            if (img.complete && img.naturalWidth > 0) {
              resolve();
              return;
            }
            const done = () => resolve();
            img.addEventListener('load', done, { once: true });
            img.addEventListener('error', done, { once: true });
          })
      )
    ),
    new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
  ]);
}

/**
 * Exports a fixed-pixel Social Studio canvas (1200x675 or 1080x1080) as a crisp 2x Retina PNG
 * without preview scale distortion or Roblox CDN CORS tainting.
 */
export async function exportSocialCanvasToPng(
  sourceEl: HTMLElement,
  options: {
    width: number;
    height: number;
    filenameBase: string;
  }
): Promise<{ dataUrl: string; blob: Blob; filename: string }> {
  const host = document.createElement('div');
  host.style.position = 'fixed';
  host.style.left = '-12000px';
  host.style.top = '0';
  host.style.width = `${options.width}px`;
  host.style.height = `${options.height}px`;
  host.style.zIndex = '-1';
  host.style.pointerEvents = 'none';
  host.style.background = '#ffffff';

  const cloned = sourceEl.cloneNode(true) as HTMLElement;
  cloned.style.width = `${options.width}px`;
  cloned.style.height = `${options.height}px`;
  cloned.style.transform = 'none';
  cloned.style.margin = '0';
  cloned.style.boxShadow = 'none';

  cloned.querySelectorAll('img').forEach((img) => {
    const src = img.getAttribute('src') || img.src || '';
    if (isRobloxCdnUrl(src)) {
      img.setAttribute('crossorigin', 'anonymous');
      img.setAttribute(
        'src',
        `/api/roblox/image-proxy?url=${encodeURIComponent(src)}`
      );
      img.removeAttribute('srcset');
    }
  });

  host.appendChild(cloned);
  document.body.appendChild(host);

  try {
    await waitForImages(cloned);
    let dataUrl: string;
    try {
      dataUrl = await toPng(cloned, {
        width: options.width,
        height: options.height,
        pixelRatio: 2,
        backgroundColor: '#ffffff',
        cacheBust: false,
      });
    } catch {
      dataUrl = await toPng(cloned, {
        width: options.width,
        height: options.height,
        pixelRatio: 2,
        backgroundColor: '#ffffff',
        cacheBust: false,
        skipFonts: true,
      });
    }

    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const safeName = options.filenameBase
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 56);
    const filename = `rometric-${safeName || 'social-card'}-${getTodayUtcKey()}.png`;

    return { dataUrl, blob, filename };
  } finally {
    host.remove();
  }
}
