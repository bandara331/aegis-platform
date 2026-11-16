import { getShelters, type ShelterItem } from "@/lib/api";
import { DataTable, ErrorState, PageHeader, Tag } from "@/components/ui";
import { getDictionary } from "@/lib/i18n/dictionary";

export default async function AdminSheltersPage() {
  const dict = getDictionary("en");
  const { data: shelters, error } = await getShelters();

  return (
    <div>
      <PageHeader
        eyebrow="SHELTER CAPACITY & CONCURRENCY"
        eyebrowTone="accent"
        title="Emergency Shelters"
        subtitle="Protected by PostgreSQL CHECK (occupancy <= capacity), xmin optimistic concurrency tokens, and SELECT ... FOR UPDATE row locking."
      />

      {error ? (
        <ErrorState message={error} />
      ) : (
        <DataTable<ShelterItem>
          rows={shelters}
          rowKey={(s) => s.id}
          emptyTitle="No shelters registered"
          emptyDescription={dict.empty.noShelters}
          columns={[
            { key: "name", header: "Shelter Name", render: (s) => <strong>{s.name}</strong> },
            { key: "district", header: "District", render: (s) => s.district },
            {
              key: "occupancy",
              header: "Occupancy / Capacity",
              render: (s) => (
                <span className="mono">
                  {s.occupancy} / {s.capacity} ({s.availableSpots} free)
                </span>
              ),
            },
            { key: "facilities", header: "Facilities", render: (s) => s.facilities },
            { key: "access", header: "Accessibility", render: (s) => <Tag>{s.accessibilityTags || "Standard"}</Tag> },
          ]}
        />
      )}
    </div>
  );
}
