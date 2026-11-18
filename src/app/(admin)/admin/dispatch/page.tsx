import { DispatchClient } from "./DispatchClient";

export const dynamic = "force-dynamic";

export default function AdminDispatchPage() {
  const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  return <DispatchClient googleMapsApiKey={googleMapsApiKey} />;
}
