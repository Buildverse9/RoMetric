'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { Gamepad2 } from 'lucide-react';

interface GameArtworkProps {
  src?: string | null;
  alt: string;
  variant?: 'icon' | 'banner';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const directCdnLoader = ({ src }: { src: string }) => src;

export function GameArtwork({
  src,
  alt,
  variant = 'icon',
  size = 'md',
  className = '',
}: GameArtworkProps) {
  const [failed, setFailed] = useState(false);

  const validSrc = src && src.startsWith('https://') && !failed ? src : null;

  if (variant === 'banner') {
    return (
      <div
        className={`relative w-full aspect-video rounded-3xl overflow-hidden bg-slate-200/70 dark:bg-white/[0.04] border border-slate-900/8 dark:border-white/12 shadow-sm ${className}`}
      >
        {validSrc ? (
          <Image
            loader={directCdnLoader}
            src={validSrc}
            alt={alt}
            fill
            sizes="(max-width: 768px) 100vw, 640px"
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setFailed(true)}
            className="object-cover"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-emerald-500/10 to-slate-200/40 dark:from-[#10E89A]/10 dark:to-[#08131A] text-slate-500 dark:text-[#6F8796]">
            <Gamepad2 className="w-8 h-8 text-emerald-600/70 dark:text-[#10E89A]/70" />
            <span className="text-xs font-medium px-3 text-center truncate max-w-[85%]">
              {alt}
            </span>
          </div>
        )}
      </div>
    );
  }

  const sizeClass =
    size === 'sm'
      ? 'w-10 h-10 rounded-xl'
      : size === 'lg'
        ? 'w-16 h-16 rounded-2xl'
        : 'w-12 h-12 rounded-2xl';

  const pxSize = size === 'sm' ? 40 : size === 'lg' ? 64 : 48;

  return (
    <div
      className={`relative shrink-0 overflow-hidden bg-slate-200/70 dark:bg-white/[0.05] border border-slate-900/8 dark:border-white/12 ${sizeClass} ${className}`}
    >
      {validSrc ? (
        <Image
          loader={directCdnLoader}
          src={validSrc}
          alt={alt}
          width={pxSize}
          height={pxSize}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-emerald-500/10 text-emerald-600 dark:text-[#10E89A]">
          <Gamepad2 className="w-4 h-4" />
        </div>
      )}
    </div>
  );
}
