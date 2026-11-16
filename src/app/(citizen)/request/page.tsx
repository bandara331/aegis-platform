import { EmptyState, PageHeader } from "@/components/ui";
import Link from "next/link";
import { Button } from "@/components/ui";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000/api/v1";

interface ReferenceMetadata {
  provinces: { code: string; name: string }[];
  districts: { provinceCode: string; name: string }[];
  categories: { code: string; name: string }[];
}

export default async function CitizenRequestAidPage() {
  let metadata: ReferenceMetadata | null = null;
  try {
    const res = await fetch(`${API_BASE_URL}/reference/metadata`, { cache: "no-store" });
    if (res.ok) {
      metadata = (await res.json()) as ReferenceMetadata;
    }
  } catch {
    metadata = null;
  }

  return (
    <div>
      <PageHeader
        eyebrow="CITIZEN REQUEST PORTAL"
        eyebrowTone="accent"
        title="Request Emergency Assistance"
        subtitle={`Reference data loaded: ${metadata?.districts.length ?? 0} Sri Lankan districts and ${metadata?.categories.length ?? 0} aid categories.`}
        actions={
          <Link href="/my-requests" style={{ textDecoration: "none" }}>
            <Button variant="secondary">My Requests</Button>
          </Link>
        }
      />

      <EmptyState
        title="No active crisis declared for new submissions"
        description="Once an Emergency Coordinator declares an active crisis event in your district, the emergency request submission form for that crisis will open here automatically."
      />
    </div>
  );
}
