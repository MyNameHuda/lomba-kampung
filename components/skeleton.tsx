// Shared skeleton primitives — used by loading.tsx across the app.
// Match the red palette so the placeholder feels on-brand while real data loads.

import type { CSSProperties } from "react";

type SkeletonProps = {
  className?: string;
  style?: CSSProperties;
};

export function Skeleton({ className = "", style }: SkeletonProps) {
  return <div className={`skeleton ${className}`} style={style} aria-hidden="true" />;
}

export function SkeletonText({ className = "", width = "w-full" }: SkeletonProps & { width?: string }) {
  return <div className={`skeleton h-3 ${width} ${className}`} aria-hidden="true" />;
}

export function SkeletonBlock({ className = "" }: SkeletonProps) {
  return <div className={`skeleton ${className}`} aria-hidden="true" />;
}
