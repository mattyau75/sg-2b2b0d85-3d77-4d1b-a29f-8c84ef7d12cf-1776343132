import React from "react";

interface CourtProps {
  children?: React.ReactNode;
  className?: string;
}

export function Court({ children, className }: CourtProps) {
  return (
    <div className={`relative aspect-[50/47] w-full bg-card rounded-2xl border border-white/5 overflow-hidden ${className}`}>
      {/* Basketball Court SVG - Half Court Dimensions */}
      <svg
        viewBox="0 0 500 470"
        className="absolute inset-0 w-full h-full opacity-20 pointer-events-none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <g fill="none" stroke="currentColor" strokeWidth="2">
          {/* Baseline */}
          <line x1="0" y1="0" x2="500" y2="0" />
          {/* Sidelines */}
          <line x1="0" y1="0" x2="0" y2="470" />
          <line x1="500" y1="0" x2="500" y2="470" />
          
          {/* Key / Paint */}
          <rect x="170" y="0" width="160" height="190" />
          <rect x="190" y="0" width="120" height="190" />
          
          {/* Free Throw Circle */}
          <path d="M 170 190 A 80 80 0 1 0 330 190" strokeDasharray="5,5" />
          <path d="M 330 190 A 80 80 0 1 0 170 190" />
          
          {/* Three Point Line */}
          <path d="M 30 0 L 30 140 A 220 220 0 0 0 470 140 L 470 0" />
          
          {/* Restricted Area */}
          <path d="M 210 40 A 40 40 0 0 0 290 40" />
          
          {/* Backboard & Hoop */}
          <line x1="220" y1="40" x2="280" y2="40" />
          <circle cx="250" cy="52" r="7.5" />
        </g>
      </svg>
      {children}
    </div>
  );
}