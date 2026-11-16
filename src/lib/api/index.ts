import { cookies } from "next/headers";
import type {
  AiRecommendationItem,
  ApiLoadResult,
  Kpi,
  PublicStats,
  QueueItem,
  ShelterItem,
} from "./types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000/api/v1";

async function getAuthHeaders(): Promise<HeadersInit> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("aegis_token")?.value;
    if (token) {
      return {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      };
    }
  } catch {
    // Ignored outside request context
  }
  return { "Content-Type": "application/json" };
}

export async function getPublicStats(): Promise<ApiLoadResult<PublicStats | null>> {
  try {
    const res = await fetch(`${API_BASE_URL}/public/stats`, { cache: "no-store" });
    if (!res.ok) {
      return { data: null, error: `API returned HTTP ${res.status}` };
    }
    return { data: (await res.json()) as PublicStats, error: null };
  } catch {
    return { data: null, error: "Backend API unreachable" };
  }
}

export async function getKpis(): Promise<ApiLoadResult<Kpi[]>> {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE_URL}/metrics/kpis`, {
      headers,
      cache: "no-store",
    });
    if (!res.ok) {
      return { data: [], error: `Unable to load KPIs (HTTP ${res.status})` };
    }
    return { data: (await res.json()) as Kpi[], error: null };
  } catch {
    return { data: [], error: "Unable to connect to AEGIS backend API." };
  }
}

export async function getQueue(): Promise<ApiLoadResult<QueueItem[]>> {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE_URL}/cases?sort=ai_priority`, {
      headers,
      cache: "no-store",
    });
    if (!res.ok) {
      return { data: [], error: `Unable to load priority queue (HTTP ${res.status})` };
    }
    return { data: (await res.json()) as QueueItem[], error: null };
  } catch {
    return { data: [], error: "Unable to connect to AEGIS backend API." };
  }
}

export async function getPendingRecommendations(): Promise<ApiLoadResult<AiRecommendationItem[]>> {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE_URL}/ai/recommendations`, {
      headers,
      cache: "no-store",
    });
    if (!res.ok) {
      return { data: [], error: `Unable to load AI recommendations (HTTP ${res.status})` };
    }
    return { data: (await res.json()) as AiRecommendationItem[], error: null };
  } catch {
    return { data: [], error: "Unable to connect to AEGIS backend API." };
  }
}

export async function getShelters(): Promise<ApiLoadResult<ShelterItem[]>> {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE_URL}/shelters`, {
      headers,
      cache: "no-store",
    });
    if (!res.ok) {
      return { data: [], error: `Unable to load shelters (HTTP ${res.status})` };
    }
    return { data: (await res.json()) as ShelterItem[], error: null };
  } catch {
    return { data: [], error: "Unable to connect to AEGIS backend API." };
  }
}

export * from "./types";
