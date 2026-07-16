import { getFirestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { enqueueIncidentZoneDirtyRegion } from "./dirtyRegion";
import { incidentZoneJobFromFirestore } from "./jobAdapter";
import { runIncidentZoneMaintenance } from "./maintenance";
import { workIncidentZoneJob } from "./worker";

const REGION = "asia-southeast1";

export const onIncidentZoneReportWritten = onDocumentWritten(
  {
    document: "reports/{reportId}",
    region: REGION,
    retry: true,
    concurrency: 4,
    maxInstances: 4
  },
  async (event) => {
    const reportId = event.params.reportId;
    const before = event.data?.before.exists
      ? event.data.before.data()
      : null;
    const after = event.data?.after.exists ? event.data.after.data() : null;
    const enqueued = await enqueueIncidentZoneDirtyRegion(
      getFirestore(),
      reportId,
      before,
      after
    );

    if (enqueued) {
      logger.info("Incident-zone dirty regions enqueued.", {
        action: "incident-zone-report-write"
      });
    }
  }
);

export const onIncidentZoneJobWritten = onDocumentWritten(
  {
    document: "incidentZoneJobs/{partitionKey}",
    region: REGION,
    retry: false,
    concurrency: 1,
    maxInstances: 2
  },
  async (event) => {
    const partitionKey = event.params.partitionKey;
    const after = event.data?.after;
    if (!after?.exists) {
      return;
    }

    const job = incidentZoneJobFromFirestore(partitionKey, after.data());
    if (job?.status !== "pending") {
      return;
    }

    const result = await workIncidentZoneJob(
      getFirestore(),
      partitionKey,
      event.id
    );
    if (result.status === "failed") {
      logger.error("Incident-zone worker failed.", {
        action: "incident-zone-worker",
        errorCode: result.errorCode
      });
      return;
    }

    logger.info("Incident-zone worker finished.", {
      action: "incident-zone-worker",
      resultStatus: result.status
    });
  }
);

export const maintainIncidentZones = onSchedule(
  {
    schedule: "every 10 minutes",
    region: REGION,
    timeZone: "Asia/Bangkok",
    retryCount: 2,
    maxInstances: 1
  },
  async () => {
    const result = await runIncidentZoneMaintenance(getFirestore());
    logger.info("Incident-zone maintenance finished.", {
      action: "incident-zone-maintenance",
      ...result
    });
  }
);

