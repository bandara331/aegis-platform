export interface SkeletonProps {
  height?: string | number;
  width?: string | number;
  rows?: number;
}

export function Skeleton({ height = 24, width = "100%", rows = 1 }: SkeletonProps) {
  return (
    <div aria-busy="true" aria-label="Loading content" style={{ display: "grid", gap: "12px" }}>
      {Array.from({ length: rows }).map((_, idx) => (
        <div
          key={idx}
          style={{
            height,
            width,
            borderRadius: "var(--radius-md)",
            background: "linear-gradient(90deg, #ECEEF2 25%, #F6F7F9 50%, #ECEEF2 75%)",
            backgroundSize: "200% 100%",
            animation: "bento-shimmer 1.6s infinite linear",
          }}
        />
      ))}
    </div>
  );
}
