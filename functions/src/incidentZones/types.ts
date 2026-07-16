export const INCIDENT_ZONE_REPORT_CATEGORIES = [
  "open_burning",
  "wildfire_smoke",
  "industrial_smoke",
  "other"
] as const;

export type IncidentZoneReportCategory =
  (typeof INCIDENT_ZONE_REPORT_CATEGORIES)[number];
export type IncidentZoneSeverity = 1 | 2 | 3;
export type IncidentZoneRiskLevel =
  | "เฝ้าระวัง"
  | "น่ากังวล"
  | "ควรตรวจสอบเร่งด่วน";
export type IncidentZoneStatus = "active" | "resolved" | "hidden";
export type IncidentZoneVerificationStatus =
  | "รอการยืนยัน"
  | "ยืนยันแล้ว"
  | "ถูกปฏิเสธ";
export type IncidentZoneModerationStatus = "ปกติ" | "รอตรวจสอบ" | "ถูกซ่อน";

export interface IncidentZoneReport {
  id: string;
  lat: number;
  lng: number;
  category: IncidentZoneReportCategory;
  severity: IncidentZoneSeverity;
  createdAt: number;
  verificationStatus: IncidentZoneVerificationStatus;
  moderationStatus: IncidentZoneModerationStatus;
  addressLabel?: string;
}

export interface IncidentZoneCategoryCounts {
  industrial_smoke: number;
  open_burning: number;
  other: number;
  wildfire_smoke: number;
}

export interface IncidentZoneState {
  id: string;
  reportIds: string[];
  reportCount: number;
  centerLat: number;
  centerLng: number;
  geohash: string;
  categories: IncidentZoneReportCategory[];
  categoryCounts: IncidentZoneCategoryCounts;
  riskLevel: IncidentZoneRiskLevel;
  riskRank: number;
  riskScore: number;
  maxSeverity: IncidentZoneSeverity;
  averageSeverity: number;
  verifiedReportCount: number;
  latestReportAt: number;
  primaryAddressLabel: string;
  riskFactors: string[];
  status: IncidentZoneStatus;
  anchorReportId: string;
  algorithmVersion: string;
  stateHash: string;
  nextEvaluationAt: number | null;
  createdAt: number;
  updatedAt: number;
  version: number;
}

export interface IncidentZoneMembership {
  reportId: string;
  zoneId: string | null;
  status: "active" | "inactive";
  algorithmVersion: string;
  updatedAt: number;
}

export interface IncidentZoneAlias {
  oldZoneId: string;
  canonicalZoneId: string;
  reason: "merged";
  algorithmVersion: string;
  createdAt: number;
}

export type IncidentZoneJobStatus =
  | "pending"
  | "leased"
  | "completed"
  | "failed";

export interface IncidentZoneJob {
  partitionKey: string;
  dirtyGeohashes: string[];
  generation: number;
  status: IncidentZoneJobStatus;
  attemptCount: number;
  leaseOwner: string | null;
  leaseExpiresAt: number | null;
  nextAttemptAt: number | null;
  lastErrorCode: string | null;
  createdAt: number;
  updatedAt: number;
}

export type IncidentZoneExclusionReason =
  | "duplicate-id"
  | "future"
  | "hidden"
  | "inactive-window"
  | "invalid"
  | "rejected"
  | "stale";

export interface ExcludedIncidentZoneReport {
  reportId: string;
  reason: IncidentZoneExclusionReason;
}

export interface IncidentZonePlanStats {
  reportsConsidered: number;
  reportsEligible: number;
  reportsExcluded: number;
  activeZones: number;
  zonesCreated: number;
  zonesMerged: number;
  zonesSplit: number;
  aliasesPlanned: number;
  membershipsPlanned: number;
  stateChangesPlanned: number;
}

export interface IncidentZoneRecomputationPlan {
  zones: IncidentZoneState[];
  zoneUpserts: IncidentZoneState[];
  unchangedZoneIds: string[];
  aliases: IncidentZoneAlias[];
  memberships: IncidentZoneMembership[];
  excludedReports: ExcludedIncidentZoneReport[];
  stats: IncidentZonePlanStats;
}

export interface IncidentZoneBuildOptions {
  maxCandidateReports?: number;
  maxBfsRounds?: number;
}

export interface IncidentZoneBuildSuccess {
  status: "ok";
  plan: IncidentZoneRecomputationPlan;
}

export interface IncidentZoneLimitExceeded {
  status: "limit-exceeded";
  limit: "candidate-reports" | "bfs-rounds";
  maximum: number;
  observed: number;
  reportsConsidered: number;
}

export type IncidentZoneBuildResult =
  | IncidentZoneBuildSuccess
  | IncidentZoneLimitExceeded;
