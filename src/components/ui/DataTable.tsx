import type { ReactNode } from "react";
import { Card } from "./Card";
import { EmptyState } from "./EmptyState";

export interface DataTableColumn<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  emptyTitle?: string;
  emptyDescription?: string;
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  emptyTitle = "No records found",
  emptyDescription = "There are currently no records in the database matching this view.",
}: DataTableProps<T>) {
  if (rows.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <Card style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border-card)", background: "var(--bg-subtle)" }}>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="mono"
                  style={{
                    textAlign: "left",
                    padding: "14px 20px",
                    fontSize: "11px",
                    fontWeight: 600,
                    color: "var(--muted)",
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                  }}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={rowKey(row)}
                style={{
                  borderBottom: "1px solid var(--border-card)",
                  transition: "background 0.15s ease",
                }}
              >
                {columns.map((col) => (
                  <td key={col.key} style={{ padding: "14px 20px", color: "var(--ink)", verticalAlign: "middle" }}>
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
