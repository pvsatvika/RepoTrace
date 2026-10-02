import React from 'react';

export default function LogoMark({ size = 28, className = '' }) {
  return (
    <div
      className={`inline-flex items-center justify-center font-mono font-bold text-white gradient-accent-bg rounded-lg shadow-sm select-none ${className}`}
      style={{ width: `${size}px`, height: `${size}px`, fontSize: `${Math.round(size * 0.48)}px` }}
      aria-label="WhyTheCodeIsLikeThis Logo"
    >
      &lt;/&gt;
    </div>
  );
}
