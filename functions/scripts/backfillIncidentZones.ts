import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { runIncidentZoneBackfillBatch } from "../src/incidentZones/backfillRuntime";

function readProjectId(): string {
  const explicit =
    process.env.GCLOUD_PROJECT ??
    process.env.GOOGLE_CLOUD_PROJECT ??
    process.env.FIREBASE_PROJECT_ID;
  if (explicit) {
    return explicit;
  }

  const firebaseConfig = process.env.FIREBASE_CONFIG;
  if (!firebaseConfig) {
    return "";
  }
  try {
    const parsed: unknown = JSON.parse(firebaseConfig);
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      const projectId = (parsed as Record<string, unknown>).projectId;
      return typeof projectId === "string" ? projectId : "";
    }
  } catch {
    return "";
  }
  return "";
}

function readPositiveInteger(value: string | undefined): number | undefined {
  if (value === undefined || value.trim().length === 0) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : Number.NaN;
}

async function main(): Promise<void> {
  const projectId = readProjectId();
  if (projectId.length === 0) {
    throw new Error("Set an explicit Firebase project ID before running backfill.");
  }

  initializeApp({ projectId });
  const summary = await runIncidentZoneBackfillBatch(getFirestore(), {
    apply: process.env.FIREWATCH_ZONE_BACKFILL_APPLY === "true",
    guards: {
      applyEnabled: process.env.FIREWATCH_ZONE_BACKFILL_APPLY === "true",
      projectId,
      allowedProjectIds: (process.env.FIREWATCH_ZONE_BACKFILL_ALLOWED_PROJECTS ?? "")
        .split(",")
        .map((value) => value.trim())
        .filter((value) => value.length > 0),
      confirmation: process.env.FIREWATCH_ZONE_BACKFILL_CONFIRMATION ?? ""
    },
    batchSize: readPositiveInteger(process.env.FIREWATCH_ZONE_BACKFILL_BATCH_SIZE),
    maxJobs: readPositiveInteger(process.env.FIREWATCH_ZONE_BACKFILL_JOB_LIMIT),
    resumeCursor: process.env.FIREWATCH_ZONE_BACKFILL_CURSOR,
    now: Date.now()
  });
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown backfill error.";
  process.stderr.write(`Incident-zone backfill failed: ${message}\n`);
  process.exitCode = 1;
});

