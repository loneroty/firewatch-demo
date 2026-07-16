import { buildCanonicalIncidentZones } from "./domain";
import type {
  IncidentZoneBuildOptions,
  IncidentZoneReport,
  IncidentZoneState
} from "./types";

export interface IncidentZoneBackfillSummary {
  reportsConsidered: number;
  zonesCreated: number;
  zonesMerged: number;
  zonesSplit: number;
  reportsExcluded: number;
  aliasesPlanned: number;
  membershipsPlanned: number;
  stateChangesPlanned: number;
}

export type IncidentZoneBackfillDryRunResult =
  | {
      status: "dry-run-ready";
      summary: IncidentZoneBackfillSummary;
    }
  | {
      status: "limit-exceeded";
      limit: "candidate-reports" | "bfs-rounds";
      maximum: number;
      observed: number;
      reportsConsidered: number;
    };

export function planIncidentZoneBackfillDryRun(
  reports: readonly IncidentZoneReport[],
  previousZones: readonly IncidentZoneState[],
  now: number,
  options: IncidentZoneBuildOptions = {}
): IncidentZoneBackfillDryRunResult {
  const result = buildCanonicalIncidentZones(
    reports,
    previousZones,
    now,
    options
  );

  if (result.status === "limit-exceeded") {
    return result;
  }

  return {
    status: "dry-run-ready",
    summary: {
      reportsConsidered: result.plan.stats.reportsConsidered,
      zonesCreated: result.plan.stats.zonesCreated,
      zonesMerged: result.plan.stats.zonesMerged,
      zonesSplit: result.plan.stats.zonesSplit,
      reportsExcluded: result.plan.stats.reportsExcluded,
      aliasesPlanned: result.plan.stats.aliasesPlanned,
      membershipsPlanned: result.plan.stats.membershipsPlanned,
      stateChangesPlanned: result.plan.stats.stateChangesPlanned
    }
  };
}
