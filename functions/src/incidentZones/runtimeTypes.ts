import type { IncidentZoneState } from "./types";

export const MAX_DIRTY_CENTERS_PER_JOB = 32;
export const MAX_DIRTY_GEOHASHES_PER_JOB = 32;
export const MAX_DIRTY_REPORT_IDS_PER_JOB = 64;

export interface DirtyIncidentZoneCenter {
  reportId: string;
  lat: number;
  lng: number;
  geohash: string;
}

export type IncidentZoneRuntimeJobStatus =
  | "pending"
  | "leased"
  | "completed"
  | "failed";

export interface IncidentZoneRuntimeJob {
  partitionKey: string;
  generation: number;
  dirtyCenters: DirtyIncidentZoneCenter[];
  dirtyGeohashes: string[];
  dirtyReportIds: string[];
  earliestRelevantAt: number;
  status: IncidentZoneRuntimeJobStatus;
  leaseOwner: string | null;
  leaseExpiresAt: number | null;
  attempts: number;
  nextAttemptAt: number | null;
  lastErrorCode: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface IncidentZoneLease {
  partitionKey: string;
  generation: number;
  leaseOwner: string;
  job: IncidentZoneRuntimeJob;
}

export interface LoadedIncidentZoneCandidates {
  reports: import("./types").IncidentZoneReport[];
  previousZones: IncidentZoneState[];
  queriedPartitionKeys: string[];
  malformedReportCount: number;
}

export type IncidentZoneCandidateLoadResult =
  | {
      status: "ok";
      value: LoadedIncidentZoneCandidates;
    }
  | {
      status: "limit-exceeded";
      limit: "candidate-reports" | "connected-partitions";
      maximum: number;
      observed: number;
    };
