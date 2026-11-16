import { getQueue, getShelters } from "@/lib/api";
import { Card, EmptyState, ErrorState, PageHeader, Tag } from "@/components/ui";

export default async function AdminMapPage() {
  const [queueRes, sheltersRes] = await Promise.all([getQueue(), getShelters()]);
  const totalPins = queueRes.data.length + sheltersRes.data.length;

  return (
    <div>
      <PageHeader
        eyebrow="GEOSPATIAL SITUATION PICTURE"
        eyebrowTone="accent"
        title="Live Operational Map"
        subtitle="Displays only real database coordinates for active requests, shelters, and resource depots."
      />

      {sheltersRes.error ? (
        <ErrorState message={sheltersRes.error} />
      ) : totalPins === 0 ? (
        <EmptyState
          title="0 geospatial pins in database"
          description="No active assistance requests or shelters with coordinates exist in the database yet."
        />
      ) : (
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
            <strong>Registered Map Entities</strong>
            <Tag tone="success" pulse>{totalPins} LIVE PINS</Tag>
          </div>
          <div className="bento-grid cols-3">
            {sheltersRes.data.map((s) => (
              <Card key={s.id}>
                <div style={{ fontWeight: 700 }}>{s.name}</div>
                <div style={{ fontSize: "13px", color: "var(--muted)" }}>{s.district}</div>
                <div className="mono" style={{ fontSize: "12px", marginTop: "6px" }}>
                  Occupancy: {s.occupancy}/{s.capacity} · ({s.latitude.toFixed(4)}, {s.longitude.toFixed(4)})
                </div>
              </Card>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
