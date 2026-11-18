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
    <Card interactive style={{ padding: "18px 20px", borderRadius: "24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
        <span style={{ fontSize: "13px", color: "var(--muted)" }}>{label}</span>
        {note && <Tag tone={tone}>{note}</Tag>}
      </div>
      <div style={{ fontSize: "38px", fontWeight: 600, letterSpacing: "-0.04em", margin: "6px 0 0", lineHeight: 1.1 }}>
        {value}
      </div>
    </Card>
  );
}
