import type { ReactNode } from "react";

interface SkeletonProps {
  width?: string;
  height?: string;
  borderRadius?: string;
  className?: string;
}

export function Skeleton({ width = "100%", height = "1rem", borderRadius = "4px", className = "" }: SkeletonProps) {
  return (
    <div
      className={`skeleton ${className}`}
      style={{ width, height, borderRadius }}
      aria-hidden="true"
    />
  );
}

export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="skeleton-table">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="skeleton-table__row">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} width={`${60 + Math.random() * 30}%`} height="14px" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function KpiSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="kpi-grid">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="kpi-card kpi-card--skeleton">
          <Skeleton width="60%" height="14px" />
          <Skeleton width="40%" height="28px" />
        </div>
      ))}
    </div>
  );
}
