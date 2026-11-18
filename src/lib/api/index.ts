import { cookies } from "next/headers";
import type {
  AiAnalyticsDto,
  AiGovernanceViewDto,
  AiRecommendationItem,
  AiStatusDto,
  ApiLoadResult,
  DistrictRiskResponseDto,
  Kpi,
  DuplicateCandidate,
  RequestChatMessage,
  PagedRequestsResult,
  PublicStats,
  QueueItem,
  RequestDetail,
  ShelterItem,
  StockForecastDto,
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

export async function getRequests(): Promise<ApiLoadResult<RequestDetail[]>> {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE_URL}/requests`, { headers, cache: "no-store" });
    if (!res.ok) {
      return { data: [], error: `Unable to load requests (HTTP ${res.status})` };
    }
    return { data: (await res.json()) as RequestDetail[], error: null };
  } catch {
    return { data: [], error: "Unable to connect to AEGIS backend API." };
  }
}

export async function getRequestById(idOrTracking: string): Promise<ApiLoadResult<RequestDetail | null>> {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE_URL}/requests/${encodeURIComponent(idOrTracking)}`, {
      headers,
      cache: "no-store",
    });
    if (res.status === 404) {
      return { data: null, error: null };
    }
    if (!res.ok) {
      return { data: null, error: `Unable to load request (HTTP ${res.status})` };
    }
    return { data: (await res.json()) as RequestDetail, error: null };
  } catch {
    return { data: null, error: "Unable to connect to AEGIS backend API." };
  }
}

export async function getAdminRequestsPaged(params: {
  search?: string;
  status?: string;
  priority?: string;
  district?: string;
  language?: string;
  page?: number;
  pageSize?: number;
}): Promise<ApiLoadResult<PagedRequestsResult>> {
  try {
    const headers = await getAuthHeaders();
    const query = new URLSearchParams();
    if (params.search) query.set("search", params.search);
    if (params.status && params.status !== "All") query.set("status", params.status);
    if (params.priority && params.priority !== "All") query.set("priority", params.priority);
    if (params.district && params.district !== "All") query.set("district", params.district);
    if (params.language && params.language !== "All") query.set("language", params.language);
    query.set("page", String(params.page || 1));
    query.set("pageSize", String(params.pageSize || 10));

    const res = await fetch(`${API_BASE_URL}/requests?${query.toString()}`, {
      headers,
      cache: "no-store",
    });

    if (!res.ok) {
      return {
        data: { items: [], totalCount: 0, page: 1, pageSize: 10, totalPages: 0 },
        error: `Unable to load requests (HTTP ${res.status})`,
      };
    }

    const data = (await res.json()) as PagedRequestsResult;
    return { data, error: null };
  } catch {
    return {
      data: { items: [], totalCount: 0, page: 1, pageSize: 10, totalPages: 0 },
      error: "Unable to connect to AEGIS backend API.",
    };
  }
}

export async function getRequestDuplicates(id: string): Promise<ApiLoadResult<DuplicateCandidate[]>> {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE_URL}/requests/${id}/duplicates`, {
      headers,
      cache: "no-store",
    });
    if (!res.ok) {
      return { data: [], error: `Unable to load duplicates (HTTP ${res.status})` };
    }
    return { data: await res.json(), error: null };
  } catch {
    return { data: [], error: "Unable to connect to duplicates service." };
  }
}

export async function getRequestMessages(idOrTracking: string): Promise<ApiLoadResult<RequestChatMessage[]>> {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE_URL}/requests/${encodeURIComponent(idOrTracking)}/messages`, {
      headers,
      cache: "no-store",
    });
    if (!res.ok) {
      return { data: [], error: null };
    }
    return { data: await res.json(), error: null };
  } catch {
    return { data: [], error: null };
  }
}

export async function getRecommendationForRequest(requestId: string): Promise<ApiLoadResult<AiRecommendationItem | null>> {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE_URL}/ai/recommendations/by-request/${requestId}`, { headers, cache: "no-store" });
    if (res.status === 404) return { data: null, error: null };
    if (!res.ok) return { data: null, error: `Unable to load AI recommendation (HTTP ${res.status})` };
    return { data: (await res.json()) as AiRecommendationItem, error: null };
  } catch {
    return { data: null, error: "Unable to connect to AEGIS backend API." };
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

export async function getAiStatus(): Promise<ApiLoadResult<AiStatusDto | null>> {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE_URL}/ai/status`, { headers, cache: "no-store" });
    if (!res.ok) return { data: null, error: `HTTP ${res.status}` };
    return { data: (await res.json()) as AiStatusDto, error: null };
  } catch {
    return { data: null, error: "Unable to connect to AEGIS backend API." };
  }
}

export async function getAiGovernance(): Promise<ApiLoadResult<AiGovernanceViewDto | null>> {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE_URL}/admin/ai/governance`, { headers, cache: "no-store" });
    if (!res.ok) return { data: null, error: `Unable to load AI governance (HTTP ${res.status})` };
    return { data: (await res.json()) as AiGovernanceViewDto, error: null };
  } catch {
    return { data: null, error: "Unable to connect to AEGIS backend API." };
  }
}

export async function getAiAnalytics(from?: string, to?: string): Promise<ApiLoadResult<AiAnalyticsDto | null>> {
  try {
    const headers = await getAuthHeaders();
    const qs = new URLSearchParams();
    if (from) qs.set("from", from);
    if (to) qs.set("to", to);
    const query = qs.toString() ? `?${qs.toString()}` : "";
    const res = await fetch(`${API_BASE_URL}/admin/ai/analytics${query}`, { headers, cache: "no-store" });
    if (!res.ok) return { data: null, error: `Unable to load AI analytics (HTTP ${res.status})` };
    return { data: (await res.json()) as AiAnalyticsDto, error: null };
  } catch {
    return { data: null, error: "Unable to connect to AEGIS backend API." };
  }
}

export async function getStockForecasts(): Promise<ApiLoadResult<StockForecastDto[]>> {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE_URL}/ai/forecast/stock`, { headers, cache: "no-store" });
    if (!res.ok) return { data: [], error: `Unable to load stock forecasts (HTTP ${res.status})` };
    return { data: (await res.json()) as StockForecastDto[], error: null };
  } catch {
    return { data: [], error: "Unable to connect to AEGIS backend API." };
  }
}

export async function getDistrictRisk(): Promise<ApiLoadResult<DistrictRiskResponseDto | null>> {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE_URL}/ai/risk/districts`, { headers, cache: "no-store" });
    if (!res.ok) return { data: null, error: `Unable to load district risk (HTTP ${res.status})` };
    return { data: (await res.json()) as DistrictRiskResponseDto, error: null };
  } catch {
    return { data: null, error: "Unable to connect to AEGIS backend API." };
  }
}

export * from "./types";
