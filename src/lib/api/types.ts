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
  distressFlagged?: boolean;
  distressLevel?: string | null;
  distressAcknowledgedAt?: string | null;
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
  isShadow?: boolean;
  belowThreshold?: boolean;
  promptVersion?: string | null;
  counterfactualNote?: string | null;
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
  detectedLanguage?: string | null;
  normalizedText?: string | null;
  extractedJson?: string | null;
  languageConfidence?: number | null;
  aiTranslated?: boolean;
}

export interface AiStatusDto {
  mode: "Active" | "Shadow" | "Off" | string;
  confidenceThreshold: number;
  fairnessDisparityThreshold: number;
  isPaused: boolean;
  isShadow: boolean;
}

export interface AiGovernanceConfigDto {
  mode: "Active" | "Shadow" | "Off" | string;
  confidenceThreshold: number;
  fairnessDisparityThreshold: number;
  updatedById?: string | null;
  updatedReason?: string | null;
  updatedAt: string;
}

export interface AiAuditEventDto {
  sequenceNumber: number;
  actorId: string;
  detailsJson: string;
  timestampUtc: string;
}

export interface AiGovernanceViewDto {
  config: AiGovernanceConfigDto;
  auditHistory: AiAuditEventDto[];
}

export interface AiBreakdownBucketDto {
  key: string;
  approved: number;
  modified: number;
  rejected: number;
  deferred: number;
  total: number;
  agreementRate: number;
}

export interface AiCalibrationBucketDto {
  rangeLabel: string;
  avgConfidence: number;
  agreementRate: number;
  count: number;
}

export interface AiFairnessRowDto {
  dimension: string;
  group: string;
  totalRequests: number;
  criticalOrHighRate: number;
  agreementRate: number;
  disparityFromMean: number;
  flagged: boolean;
}

export interface AiAnalyticsDto {
  fromUtc: string;
  toUtc: string;
  totalDecisions: number;
  overallAgreementRate: number;
  fairnessDisparityThreshold: number;
  byDay: AiBreakdownBucketDto[];
  byLanguage: AiBreakdownBucketDto[];
  byDistrict: AiBreakdownBucketDto[];
  byCategory: AiBreakdownBucketDto[];
  calibration: AiCalibrationBucketDto[];
  fairness: AiFairnessRowDto[];
}

export interface ChatSummaryDto {
  requestId: string;
  bullets: string[];
  promptVersion: string;
  usedFallback: boolean;
}

export interface SuggestedReplyDto {
  requestId: string;
  targetLanguage: string;
  draftText: string;
  promptVersion: string;
  usedFallback: boolean;
}

export interface HandoverItemDto {
  requestId: string;
  trackingNumber: string;
  priority: string;
  status: string;
  area: string;
  distressFlagged: boolean;
  changeSummary: string;
  lastActivityUtc: string;
}

export interface HandoverNoteDto {
  staffUserId: string;
  sinceUtc: string;
  generatedAtUtc: string;
  summaryText: string;
  items: HandoverItemDto[];
}

export interface NlSearchFilterDto {
  status?: string | null;
  priority?: string | null;
  district?: string | null;
  category?: string | null;
  assigned?: string | null;
  dateRange?: string | null;
  language?: string | null;
  unassigned?: boolean | null;
}

export interface NlSearchResponseDto {
  filters: NlSearchFilterDto;
  items: RequestDetail[];
  totalCount: number;
  usedFallback: boolean;
}

export interface SituationReportDraftDto {
  id: string;
  title: string;
  contentMarkdown: string;
  status: "Draft" | "Published" | string;
  isAiAssisted: boolean;
  createdById: string;
  publishedById?: string | null;
  publishedAt?: string | null;
  updatedAt: string;
}

export interface StockForecastDto {
  resourceId: string;
  itemName: string;
  category: string;
  depot: string;
  quantityAvailable: number;
  unit: string;
  hasEnoughData: boolean;
  dataPointsCount: number;
  ewmaHourlyRate: number;
  rainfallMultiplier: number;
  estimatedHours?: number | null;
  minHours?: number | null;
  maxHours?: number | null;
  alertTriggered: boolean;
  displayText: string;
  explanation: string;
  computedAtUtc: string;
}

export interface RiskFactorDto {
  name: string;
  value: string;
  source: string;
  weightContribution: number;
}

export interface DistrictRiskDto {
  district: string;
  latitude: number;
  longitude: number;
  riskLevel: "Low" | "Medium" | "High" | "Severe" | string;
  riskScore: number;
  advisoryNotice: string;
  lastUpdatedUtc: string;
  isStale: boolean;
  factors: RiskFactorDto[];
}

export interface DistrictRiskResponseDto {
  advisoryNotice: string;
  lastUpdatedUtc: string;
  anyStale: boolean;
  districts: DistrictRiskDto[];
}

export interface VehicleDto {
  id: string;
  name: string;
  vehicleType: string;
  capacity: number;
  currentLatitude: number;
  currentLongitude: number;
  assignedVolunteerId?: string | null;
  assignedDriverName?: string | null;
  availability: string;
  skills: string;
}

export interface DispatchStopDto {
  requestId: string;
  trackingNumber: string;
  area: string;
  category: string;
  priority: string;
  peopleCount: number;
  latitude: number;
  longitude: number;
  sequence: number;
  etaMinutes: number;
  distanceFromPrevKm: number;
}

export interface DispatchVehicleRouteDto {
  vehicleId: string;
  vehicleName: string;
  vehicleType: string;
  driverName: string;
  totalStops: number;
  totalLoad: number;
  capacity: number;
  totalDistanceKm: number;
  totalDurationMinutes: number;
  encodedPolyline: string;
  stops: DispatchStopDto[];
}

export interface UnservedStopDto {
  requestId: string;
  trackingNumber: string;
  priority: string;
  peopleCount: number;
  reason: string;
}

export interface DispatchPlanDto {
  id: string;
  status: string;
  routingSource: string;
  isEstimated: boolean;
  totalDistanceKm: number;
  totalDurationMinutes: number;
  baselineDurationMinutes: number;
  minutesSaved: number;
  requiresSecondApprover: boolean;
  explanation: string;
  routes: DispatchVehicleRouteDto[];
  unserved: UnservedStopDto[];
  createdAtUtc: string;
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
