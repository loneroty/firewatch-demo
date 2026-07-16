"use client";

import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  where,
  type Firestore,
  type Unsubscribe
} from "firebase/firestore";
import { getFirebaseServices } from "@/lib/firebase/client";
import {
  adaptServerIncidentZonePayload,
  readIncidentZoneReadinessStatus,
  type IncidentZoneReadinessStatus
} from "@/lib/firebase/incidentZonePayload";
import type { AlertZone } from "@/lib/incidentIntelligence";
import {
  resolveIncidentZoneWithAliasLookup,
  type ServerIncidentZoneStatus
} from "@/lib/incidentZoneSource";

export interface ServerIncidentZoneSnapshot {
  zones: AlertZone[];
  status: ServerIncidentZoneStatus;
  readiness: IncidentZoneReadinessStatus;
}

interface IncidentZoneSubscriptionHandlers {
  onState: (snapshot: ServerIncidentZoneSnapshot) => void;
  onError: (message: string) => void;
}

export type IncidentZoneDeepLinkResolution =
  | {
      status: "found";
      requestedZoneId: string;
      canonicalZoneId: string;
      zone: AlertZone;
      zoneStatus: "active" | "resolved";
      aliasHops: number;
    }
  | { status: "missing" | "unavailable" | "loop" | "max-hops" };

function mapStreamError(error: unknown): string {
  if (
    error instanceof Error &&
    error.message.toLowerCase().includes("permission")
  ) {
    return "โหลดพื้นที่เสี่ยงจาก server ไม่ได้: ไม่มีสิทธิ์อ่านข้อมูลชุดนี้";
  }
  return "พื้นที่เสี่ยงจาก server ยังไม่พร้อม ระบบกำลังใช้การวิเคราะห์บนเครื่องแทน";
}

export function subscribeToBackendIncidentZones(
  handlers: IncidentZoneSubscriptionHandlers
): Unsubscribe {
  const services = getFirebaseServices();
  if (!services) {
    handlers.onError(
      "Firebase backend ยังตั้งค่าไม่ครบ ระบบกำลังใช้การวิเคราะห์บนเครื่องแทน"
    );
    return () => undefined;
  }

  let readiness: IncidentZoneReadinessStatus = "not-ready";
  let zones: AlertZone[] = [];
  let zonesLoaded = false;
  let streamFailed = false;
  let closed = false;

  function emit(): void {
    if (closed) {
      return;
    }
    let status: ServerIncidentZoneStatus;
    if (streamFailed || readiness === "error") {
      status = "error";
    } else if (readiness !== "ready") {
      status = readiness === "not-ready" || readiness === "backfilling"
        ? "not-ready"
        : "loading";
    } else if (!zonesLoaded) {
      status = "loading";
    } else {
      status = zones.length === 0 ? "empty" : "ready";
    }
    handlers.onState({ zones, status, readiness });
  }

  handlers.onState({ zones: [], status: "loading", readiness: "not-ready" });
  const unsubscribeReadiness = onSnapshot(
    doc(services.firestore, "incidentZoneSystem", "state"),
    (snapshot) => {
      readiness = snapshot.exists()
        ? readIncidentZoneReadinessStatus(snapshot.data())
        : "not-ready";
      emit();
    },
    (error) => {
      streamFailed = true;
      handlers.onError(mapStreamError(error));
      emit();
    }
  );
  const zonesQuery = query(
    collection(services.firestore, "incidentZones"),
    where("status", "==", "active"),
    orderBy("riskRank", "desc"),
    orderBy("updatedAt", "desc")
  );
  const unsubscribeZones = onSnapshot(
    zonesQuery,
    (snapshot) => {
      const now = new Date();
      zones = snapshot.docs
        .map((document) =>
          adaptServerIncidentZonePayload(document.id, document.data(), now)
        )
        .filter(
          (adapted): adapted is NonNullable<typeof adapted> =>
            adapted !== null && adapted.status === "active"
        )
        .map((adapted) => adapted.zone);
      zonesLoaded = true;
      emit();
    },
    (error) => {
      streamFailed = true;
      handlers.onError(mapStreamError(error));
      emit();
    }
  );

  return () => {
    closed = true;
    unsubscribeReadiness();
    unsubscribeZones();
  };
}

function readAliasTarget(value: unknown): string | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  const canonicalZoneId = (value as Record<string, unknown>).canonicalZoneId;
  return typeof canonicalZoneId === "string" && canonicalZoneId.length > 0
    ? canonicalZoneId
    : null;
}

async function getZoneById(
  firestore: Firestore,
  zoneId: string
): Promise<ReturnType<typeof adaptServerIncidentZonePayload>> {
  const snapshot = await getDoc(doc(firestore, "incidentZones", zoneId));
  return snapshot.exists()
    ? adaptServerIncidentZonePayload(snapshot.id, snapshot.data())
    : null;
}

export async function resolveBackendIncidentZoneDeepLink(
  requestedZoneId: string,
  maximumHops = 8
): Promise<IncidentZoneDeepLinkResolution> {
  const services = getFirebaseServices();
  if (!services || requestedZoneId.length === 0 || requestedZoneId.includes("/")) {
    return { status: "unavailable" };
  }

  try {
    const resolution = await resolveIncidentZoneWithAliasLookup(
      requestedZoneId,
      (zoneId) => getZoneById(services.firestore, zoneId),
      async (zoneId) => {
        const aliasSnapshot = await getDoc(
          doc(services.firestore, "incidentZoneAliases", zoneId)
        );
        if (!aliasSnapshot.exists()) {
          return null;
        }
        const target = readAliasTarget(aliasSnapshot.data());
        if (target === null) {
          throw new Error("Malformed incident-zone alias document.");
        }
        return target;
      },
      maximumHops
    );
    if (resolution.status === "found") {
      return {
        status: "found",
        requestedZoneId,
        canonicalZoneId: resolution.canonicalZoneId,
        zone: resolution.value.zone,
        zoneStatus: resolution.value.status,
        aliasHops: resolution.hops
      };
    }
    return resolution;
  } catch {
    return { status: "unavailable" };
  }
}
