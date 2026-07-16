const INCIDENT_ZONE_RELEVANT_REPORT_FIELDS = [
  "lat",
  "lng",
  "geohash",
  "category",
  "severity",
  "createdAt",
  "verificationStatus",
  "moderationStatus",
  "confirmedByReportIds",
  "addressLabel"
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeForComparison(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(normalizeForComparison);
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (isRecord(value)) {
    const timestamp = value as { seconds?: unknown; nanoseconds?: unknown };
    if (
      typeof timestamp.seconds === "number" &&
      typeof timestamp.nanoseconds === "number"
    ) {
      return {
        nanoseconds: timestamp.nanoseconds,
        seconds: timestamp.seconds
      };
    }

    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, normalizeForComparison(value[key])])
    );
  }

  return value;
}

function projectRelevantFields(value: Record<string, unknown>): unknown {
  return Object.fromEntries(
    INCIDENT_ZONE_RELEVANT_REPORT_FIELDS.map((field) => [
      field,
      normalizeForComparison(value[field])
    ])
  );
}

export function hasRelevantIncidentZoneReportChange(
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null
): boolean {
  if (before === null || after === null) {
    return before !== after;
  }

  return (
    JSON.stringify(projectRelevantFields(before)) !==
    JSON.stringify(projectRelevantFields(after))
  );
}

