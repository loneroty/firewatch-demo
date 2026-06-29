"use client";

import {
  Timestamp,
  collection,
  onSnapshot,
  orderBy,
  query,
  type QueryDocumentSnapshot,
  type Unsubscribe
} from "firebase/firestore";
import { getDownloadURL, ref, type FirebaseStorage } from "firebase/storage";
import type {
  ModerationStatus,
  Report,
  ReportCategory,
  Severity,
  VerificationStatus
} from "@/lib/types";
import { reportCategories } from "@/lib/types";
import { getFirebaseServices } from "@/lib/firebase/client";

interface ReportSubscriptionHandlers {
  onReports: (reports: Report[]) => void;
  onError: (message: string) => void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function readNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function readSeverity(value: unknown): Severity {
  return value === 1 || value === 2 || value === 3 ? value : 1;
}

function readCategory(value: unknown): ReportCategory {
  return typeof value === "string" && reportCategories.includes(value as ReportCategory)
    ? value as ReportCategory
    : "other";
}

function readVerificationStatus(value: unknown): VerificationStatus {
  if (value === "ยืนยันแล้ว" || value === "ถูกปฏิเสธ") {
    return value;
  }

  return "รอการยืนยัน";
}

function readModerationStatus(value: unknown): ModerationStatus {
  if (value === "ถูกซ่อน" || value === "รอตรวจสอบ") {
    return value;
  }

  return "ปกติ";
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

function readCreatedAt(value: unknown): string {
  if (value instanceof Timestamp) {
    return value.toDate().toISOString();
  }

  if (typeof value === "string") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }

  return new Date(0).toISOString();
}

async function resolvePhotoURL(
  storage: FirebaseStorage,
  photoURL: string
): Promise<string> {
  if (!photoURL.startsWith("gs://")) {
    return photoURL || "/report-placeholder.svg";
  }

  try {
    return await getDownloadURL(ref(storage, photoURL));
  } catch {
    return "/report-placeholder.svg";
  }
}

async function mapReportSnapshot(
  storage: FirebaseStorage,
  snapshot: QueryDocumentSnapshot
): Promise<Report> {
  const data = snapshot.data();
  const record = isRecord(data) ? data : {};
  const photoURL = readString(record.photoURL);

  return {
    id: readString(record.id, snapshot.id) || snapshot.id,
    lat: readNumber(record.lat),
    lng: readNumber(record.lng),
    geohash: readString(record.geohash),
    photoURL: await resolvePhotoURL(storage, photoURL),
    category: readCategory(record.category),
    severity: readSeverity(record.severity),
    createdAt: readCreatedAt(record.createdAt),
    userId: readString(record.userId),
    verificationStatus: readVerificationStatus(record.verificationStatus),
    confirmedByReportIds: readStringArray(record.confirmedByReportIds),
    isThrottled: record.isThrottled === true,
    flaggedCount: readNumber(record.flaggedCount),
    moderationStatus: readModerationStatus(record.moderationStatus),
    addressLabel: readString(record.addressLabel, "ไม่ระบุพื้นที่"),
    notes: readString(record.notes)
  };
}

function mapSubscriptionError(error: unknown): string {
  if (error instanceof Error && error.message) {
    if (error.message.includes("permission")) {
      return "โหลดรายงานจาก Firebase ไม่ได้: บัญชีนี้ไม่มีสิทธิ์อ่าน reports";
    }

    return `โหลดรายงานจาก Firebase ไม่ได้: ${error.message}`;
  }

  return "โหลดรายงานจาก Firebase ไม่ได้ กรุณาตรวจค่า Firebase config และลองใหม่";
}

export function subscribeToBackendReports(
  handlers: ReportSubscriptionHandlers
): Unsubscribe {
  const services = getFirebaseServices();
  if (!services) {
    handlers.onError("Firebase backend ยังตั้งค่าไม่ครบ: เพิ่ม NEXT_PUBLIC_FIREBASE_* หรือใช้ Local demo mode");
    return () => undefined;
  }

  const reportsQuery = query(
    collection(services.firestore, "reports"),
    orderBy("createdAt", "desc")
  );
  let isClosed = false;
  let snapshotVersion = 0;

  const unsubscribe = onSnapshot(
    reportsQuery,
    (snapshot) => {
      const currentVersion = snapshotVersion + 1;
      snapshotVersion = currentVersion;

      Promise.all(snapshot.docs.map((docSnapshot) => mapReportSnapshot(services.storage, docSnapshot)))
        .then((reports) => {
          if (!isClosed && currentVersion === snapshotVersion) {
            handlers.onReports(reports);
          }
        })
        .catch((error: unknown) => {
          if (!isClosed) {
            handlers.onError(mapSubscriptionError(error));
          }
        });
    },
    (error) => {
      if (!isClosed) {
        handlers.onError(mapSubscriptionError(error));
      }
    }
  );

  return () => {
    isClosed = true;
    unsubscribe();
  };
}
