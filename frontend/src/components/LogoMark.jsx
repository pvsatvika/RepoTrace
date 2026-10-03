import React from 'react';

export default function LogoMark({ size = 28, className = '' }) {
  return (
    <div
      className={`inline-flex items-center justify-center font-mono font-bold text-white bg-[#B88A52] rounded-lg shadow-theme-sm select-none shrink-0 ${className}`}
      style={{ width: `${size}px`, height: `${size}px`, fontSize: `${Math.round(size * 0.48)}px` }}
      aria-label="RepoTrace Logo"
    >
      &lt;/&gt;
    </div>
  );
}