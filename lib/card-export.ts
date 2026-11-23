'use client';

import { toPng } from 'html-to-image';

export type SharePlatform =
  | 'whatsapp'
  | 'instagram'
  | 'facebook'
  | 'x'
  | 'youtube';

export interface CapturedCardImage {
  dataUrl: string;
  blob: Blob;
  filename: string;
  shareUrl: string;
  title: string;
}

const CANONICAL_HOST = 'rometrics.vercel.app';

export function buildDisplayShareUrl(): string {
  if (typeof window === 'undefined') {
    return `https://${CANONICAL_HOST}`;
  }
  const path = `${window.location.pathname}${window.location.search}`;
  return `https://${CANONICAL_HOST}${path === '/' ? '' : path}`;
}

export function buildShortDisplayLink(): string {
  if (typeof window === 'undefined') {
    return CANONICAL_HOST;
  }
  const path = window.location.pathname;
  return `${CANONICAL_HOST}${path === '/' ? '' : path}`;
}

function slugifyFilename(title: string): string {
  const clean = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return `rometric-${clean || 'card'}.png`;
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return res.blob();
}

function isRobloxCdnUrl(src: string): boolean {
  try {
    const u = new URL(src, window.location.href);
    return u.protocol === 'https:' && u.hostname.toLowerCase().endsWith('.rbxcdn.com');
  } catch {
    return false;
  }
}

async function waitForImages(container: HTMLElement, timeoutMs = 2600): Promise<void> {
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
 * Captures any RoMetric card DOM node as a crisp, high-DPI WHITE-MODE PNG
 * with the rometrics.vercel.app website link stamped cleanly at the bottom.
 */
export async function captureCardAsWhitePng(
  sourceEl: HTMLElement,
  options: { title?: string } = {}
): Promise<CapturedCardImage> {
  const rect = sourceEl.getBoundingClientRect();
  const targetWidth = Math.max(Math.round(rect.width), 380);
  const title = options.title?.trim() || 'RoMetric Analytics';
  const shareUrl = buildDisplayShareUrl();
  const shortLink = buildShortDisplayLink();

  // Build an off-screen .force-light export stage so Dark Mode users never see a flash
  const host = document.createElement('div');
  host.style.position = 'fixed';
  host.style.left = '-10000px';
  host.style.top = '0';
  host.style.zIndex = '-1';
  host.style.pointerEvents = 'none';
  host.className = 'force-light';

  const frame = document.createElement('div');
  frame.className = 'force-light';
  frame.style.width = `${targetWidth + 44}px`;
  frame.style.backgroundColor = '#ffffff';
  frame.style.color = '#0b141a';
  frame.style.padding = '22px';
  frame.style.borderRadius = '28px';
  frame.style.border = '1px solid rgba(15, 23, 42, 0.1)';
  frame.style.fontFamily =
    "'DM Sans', -apple-system, BlinkMacSystemFont, ui-sans-serif, system-ui, sans-serif";
  frame.style.boxSizing = 'border-box';

  const cloned = sourceEl.cloneNode(true) as HTMLElement;
  cloned.style.width = `${targetWidth}px`;
  cloned.style.maxWidth = 'none';
  cloned.style.transform = 'none';
  cloned.style.opacity = '1';
  cloned.style.background = '#ffffff';
  cloned.style.boxShadow = 'none';
  cloned.style.backdropFilter = 'none';
  cloned.style.border = '1px solid rgba(15, 23, 42, 0.08)';
  cloned.classList.add('force-light');

  // Remove interactive 3-dot buttons / dropdowns from exported artwork
  cloned.querySelectorAll('[data-export-ignore="true"]').forEach((el) => el.remove());

  // Copy pixel data from live canvases (ECharts graphs!) into cloned canvases
  const origCanvases = Array.from(sourceEl.querySelectorAll('canvas'));
  const clonedCanvases = Array.from(cloned.querySelectorAll('canvas'));
  origCanvases.forEach((origCanvas, idx) => {
    const destCanvas = clonedCanvases[idx];
    if (!destCanvas || origCanvas.width === 0 || origCanvas.height === 0) return;
    destCanvas.width = origCanvas.width;
    destCanvas.height = origCanvas.height;
    const ctx = destCanvas.getContext('2d');
    if (ctx) {
      try {
        ctx.drawImage(origCanvas, 0, 0);
      } catch {
        // Ignore tainted canvas edge case
      }
    }
  });

  // Route external Roblox CDN images through our same-origin proxy so PNG capture stays crisp & untainted
  const clonedImgs = Array.from(cloned.querySelectorAll('img'));
  clonedImgs.forEach((img) => {
    const currentSrc = img.getAttribute('src') || img.src || '';
    if (isRobloxCdnUrl(currentSrc)) {
      img.setAttribute('crossorigin', 'anonymous');
      img.setAttribute(
        'src',
        `/api/roblox/image-proxy?url=${encodeURIComponent(currentSrc)}`
      );
      img.removeAttribute('srcset');
    }
  });

  // Branded RoMetric white-mode footer displaying the website link directly on the card image
  const footer = document.createElement('div');
  footer.style.display = 'flex';
  footer.style.alignItems = 'center';
  footer.style.justifyContent = 'space-between';
  footer.style.gap = '12px';
  footer.style.marginTop = '16px';
  footer.style.paddingTop = '12px';
  footer.style.borderTop = '1px solid rgba(15, 23, 42, 0.08)';

  const brandWrap = document.createElement('div');
  brandWrap.style.display = 'flex';
  brandWrap.style.alignItems = 'center';
  brandWrap.style.gap = '8px';

  const mark = document.createElement('img');
  mark.src = '/assets/aistudio/logoofrometric_7c92ca67.png';
  mark.alt = 'RoMetric';
  mark.style.width = '24px';
  mark.style.height = '24px';
  mark.style.borderRadius = '7px';
  mark.style.objectFit = 'cover';
  mark.style.background = '#091318';
  mark.style.border = '1px solid rgba(16, 185, 129, 0.35)';

  const brandText = document.createElement('div');
  brandText.style.fontWeight = '800';
  brandText.style.fontSize = '13px';
  brandText.style.color = '#0b141a';
  brandText.style.letterSpacing = '-0.02em';
  brandText.textContent = 'RoMetric';

  brandWrap.appendChild(mark);
  brandWrap.appendChild(brandText);

  const linkEl = document.createElement('div');
  linkEl.style.fontSize = '11px';
  linkEl.style.fontWeight = '600';
  linkEl.style.color = '#059669';
  linkEl.style.fontFamily = "'JetBrains Mono', ui-monospace, monospace";
  linkEl.style.maxWidth = '65%';
  linkEl.style.overflow = 'hidden';
  linkEl.style.textOverflow = 'ellipsis';
  linkEl.style.whiteSpace = 'nowrap';
  linkEl.textContent = shortLink;

  footer.appendChild(brandWrap);
  footer.appendChild(linkEl);

  frame.appendChild(cloned);
  frame.appendChild(footer);
  host.appendChild(frame);
  document.body.appendChild(host);

  try {
    await waitForImages(frame);
    let dataUrl: string;
    try {
      dataUrl = await toPng(frame, {
        pixelRatio: 2,
        backgroundColor: '#ffffff',
        cacheBust: false,
      });
    } catch {
      // Resilient retry skipping external webfont rules if browser blocks stylesheet inspection
      dataUrl = await toPng(frame, {
        pixelRatio: 2,
        backgroundColor: '#ffffff',
        cacheBust: false,
        skipFonts: true,
      });
    }
    const blob = await dataUrlToBlob(dataUrl);
    return {
      dataUrl,
      blob,
      filename: slugifyFilename(title),
      shareUrl,
      title,
    };
  } finally {
    host.remove();
  }
}

export function downloadPngDataUrl(dataUrl: string, filename: string): void {
  const link = document.createElement('a');
  link.download = filename;
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export async function copyCardImageToClipboard(blob: Blob): Promise<boolean> {
  if (
    typeof navigator === 'undefined' ||
    !navigator.clipboard ||
    typeof ClipboardItem === 'undefined'
  ) {
    return false;
  }
  try {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    return true;
  } catch {
    return false;
  }
}

export async function shareCardToPlatform(
  platform: SharePlatform,
  captured: CapturedCardImage
): Promise<{ mode: 'native' | 'web'; message: string }> {
  const shareText = `${captured.title} — Live Roblox analytics on RoMetric\n${captured.shareUrl}`;

  // Prefer native Web Share API with attached PNG image file on mobile / supported browsers
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      const file = new File([captured.blob], captured.filename, {
        type: 'image/png',
      });
      if (
        typeof navigator.canShare === 'function' &&
        navigator.canShare({ files: [file] })
      ) {
        await navigator.share({
          title: captured.title,
          text: shareText,
          files: [file],
        });
        return {
          mode: 'native',
          message: 'Shared white-mode card image.',
        };
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return { mode: 'native', message: 'Share cancelled.' };
      }
    }
  }

  // Desktop fallback: copy image to clipboard + download PNG + open platform share composer
  const copiedImg = await copyCardImageToClipboard(captured.blob);
  downloadPngDataUrl(captured.dataUrl, captured.filename);

  const encodedText = encodeURIComponent(shareText);
  const encodedUrl = encodeURIComponent(captured.shareUrl);

  const platformUrls: Record<SharePlatform, string> = {
    whatsapp: `https://wa.me/?text=${encodedText}`,
    x: `https://twitter.com/intent/tweet?text=${encodeURIComponent(`${captured.title} — Live Roblox analytics on RoMetric`)}&url=${encodedUrl}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    instagram: 'https://www.instagram.com/',
    youtube: 'https://www.youtube.com/',
  };

  const anchor = document.createElement('a');
  anchor.href = platformUrls[platform];
  anchor.target = '_blank';
  anchor.rel = 'noopener noreferrer';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  const platformNames: Record<SharePlatform, string> = {
    whatsapp: 'WhatsApp',
    instagram: 'Instagram',
    facebook: 'Facebook',
    x: 'X',
    youtube: 'YouTube',
  };

  return {
    mode: 'web',
    message: copiedImg
      ? `White card image copied & saved — paste or upload it in ${platformNames[platform]}.`
      : `White card image downloaded — attach ${captured.filename} in ${platformNames[platform]}.`,
  };
}
