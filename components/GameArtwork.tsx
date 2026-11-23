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
        className={`relative w-full aspect-video rounded-lg overflow-hidden bg-[#101820] border border-[#263844] ${className}`}
      >
        {validSrc ? (
          <Image
            src={validSrc}
            alt={alt}
            fill
            sizes="(max-width: 768px) 100vw, 640px"
            referrerPolicy="no-referrer"
            onError={() => setFailed(true)}
            className="object-cover"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-[#1C2A32] to-[#101820] text-[#6E8492]">
            <Gamepad2 className="w-8 h-8 text-[#48D597]/60" />
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
      ? 'w-9 h-9 rounded-md'
      : size === 'lg'
        ? 'w-16 h-16 rounded-xl'
        : 'w-11 h-11 rounded-lg';

  const pxSize = size === 'sm' ? 36 : size === 'lg' ? 64 : 44;

  return (
    <div
      className={`relative shrink-0 overflow-hidden bg-[#101820] border border-[#263844] ${sizeClass} ${className}`}
    >
      {validSrc ? (
        <Image
          src={validSrc}
          alt={alt}
          width={pxSize}
          height={pxSize}
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-[#1C2A32] text-[#48D597]/70">
          <Gamepad2 className="w-4 h-4" />
        </div>
      )}
    </div>
  );
}
