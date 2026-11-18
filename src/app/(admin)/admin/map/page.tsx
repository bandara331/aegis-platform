import { getDistrictRisk, getShelters } from "@/lib/api";
import { ErrorState, PageHeader } from "@/components/ui";
import { AdminMapClient } from "./AdminMapClient";

export const dynamic = "force-dynamic";

export default async function AdminMapPage() {
  const [sheltersRes, riskRes] = await Promise.all([getShelters(), getDistrictRisk()]);
  const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  return (
    <div>
      <PageHeader
        eyebrow="GEOSPATIAL SITUATION PICTURE"
        eyebrowTone="accent"
        title="Live Operational Map & District Risk Index"
        subtitle="Real Open-Meteo rainfall/river discharge, active official alerts, and open-request density (advisory, not official)."
      />

      {sheltersRes.error && !riskRes.data ? (
        <ErrorState message={sheltersRes.error} />
      ) : (
        <AdminMapClient
          shelters={sheltersRes.data}
          initialRisk={riskRes.data}
          googleMapsApiKey={googleMapsApiKey}
        />
      )}
    </div>
  );
}
