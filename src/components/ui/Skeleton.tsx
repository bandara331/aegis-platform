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
            borderRadius: "14px",
            background: "linear-gradient(90deg, #E8EBF3 25%, #F5F6FB 50%, #E8EBF3 75%)",
            backgroundSize: "200% 100%",
            animation: "shimmer-x 1.6s infinite linear",
          }}
        />
      ))}
    </div>
  );
}
