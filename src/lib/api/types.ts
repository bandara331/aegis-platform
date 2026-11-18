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

export interface RequestTimelineStep {
  stage: string;
  fromStatus: string;
  toStatus: string;
  notes: string;
  timestampUtc: string;
  completed: boolean;
  current: boolean;
}

export interface RequestEvidenceItem {
  id: string;
  fileName: string;
  contentType: string;
  fileSizeBytes: number;
  sha256Hash: string;
  createdAt: string;
}

export interface DuplicateWarning {
  existingRequestId: string;
  existingTrackingNumber: string;
  category: string;
  area: string;
  status: string;
  distanceMeters: number;
  createdAt: string;
  message: string;
}

export interface RequestDetail {
  id: string;
  trackingNumber: string;
  citizenId?: string | null;
  crisisId?: string | null;
  category: string;
  description: string;
  language: string;
  area: string;
  latitude: number;
  longitude: number;
  status: string;
  priority: string;
  urgencyScore: number;
  peopleCount: number;
  createdAt: string;
  vulnerableFlags?: string | null;
  contactMobile?: string | null;
  contactEmail?: string | null;
  rejectionReason?: string | null;
  cancellationReason?: string | null;
  feedbackRating?: number | null;
  feedbackComment?: string | null;
  feedbackSubmittedAt?: string | null;
  canCancel?: boolean;
  canSubmitFeedback?: boolean;
  timeline?: RequestTimelineStep[];
  evidence?: RequestEvidenceItem[];
  aiPriority?: string | null;
  aiConfidence?: number | null;
  maskedNic?: string | null;
  englishTranslation?: string | null;
  recommendationId?: string | null;
}

export interface PagedRequestsResult {
  items: RequestDetail[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface DuplicateCandidate {
  candidateId: string;
  trackingNumber: string;
  jaccardSimilarity: number;
  distanceMeters: number;
  hoursApart: number;
  isLikelyDuplicate: boolean;
  explanation: string;
}

export interface DuplicateCandidateItem {
  id: string;
  trackingNumber: string;
  category: string;
  area: string;
  status: string;
  distanceMeters: number;
  jaccardSimilarity?: number;
  isLikelyDuplicate?: boolean;
  createdAt?: string;
  message?: string;
}

export interface RequestChatMessage {
  id: string;
  requestId: string;
  senderRole: "System" | "Staff" | "Citizen" | string;
  senderName: string;
  messageText: string;
  createdAt: string;
  isSystem: boolean;
}

export type DecisionActionType = "Approve" | "Modify" | "Reject" | "Defer";

export interface ApiLoadResult<T> {
  data: T;
  error: string | null;
}
