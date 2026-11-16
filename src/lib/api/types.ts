export type Priority = "critical" | "high" | "medium";

export interface Kpi {
  label: string;
  value: string;
  note: string;
  color: string;
}

export interface QueueItem {
  id: string;
  need: string;
  area: string;
  wait: string;
  priority: Priority;
  score: number;
  status: string;
  selected?: boolean;
}

export interface AiRecommendationItem {
  id: string;
  requestId: string;
  requestTrackingNumber: string;
  modelName: string;
  modelVersion: string;
  priority: string;
  confidence: number;
  rationaleJson: string;
  featureScoresJson: string;
  status: string;
  createdAt: string;
}

export interface ShelterItem {
  id: string;
  name: string;
  district: string;
  capacity: number;
  occupancy: number;
  availableSpots: number;
  facilities: string;
  accessibilityTags: string;
  latitude: number;
  longitude: number;
}

export interface PublicStats {
  resolvedRequestsCount: number;
  openRequestsCount: number;
  activeCrisesCount: number;
  openSheltersCount: number;
  shelteredPeopleCount: number;
  organisationsCount: number;
}

export type DecisionActionType = "Approve" | "Modify" | "Reject" | "Defer";

export interface ApiLoadResult<T> {
  data: T;
  error: string | null;
}
