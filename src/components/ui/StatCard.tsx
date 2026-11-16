import { Card } from "./Card";
import { Tag, type TagTone } from "./Tag";

export interface StatCardProps {
  label: string;
  value: string | number;
  note?: string;
  tone?: TagTone;
}

export function StatCard({ label, value, note, tone = "default" }: StatCardProps) {
  return (
    <Card interactive>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
        <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--muted)" }}>{label}</span>
        {note && <Tag tone={tone}>{note}</Tag>}
      </div>
      <div
        className="mono"
        style={{
          fontSize: "34px",
          fontWeight: 700,
          letterSpacing: "-0.03em",
          color: "var(--ink)",
          lineHeight: 1.15,
        }}
      >
        {value}
      </div>
    </Card>
  );
}
