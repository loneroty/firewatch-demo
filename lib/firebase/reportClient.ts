"use client";

import { httpsCallable } from "firebase/functions";
import { doc, getDoc } from "firebase/firestore";
import { ref, uploadBytes } from "firebase/storage";
import type { AdminProfile, Report, ReportDraft } from "@/lib/types";
import {
  ensureAnonymousSession,
  ensureAppCheckToken,
  getFirebaseServices
} from "@/lib/firebase/client";
import {
  REPORT_IMAGE_MAX_BYTES,
  buildBackendReportPayload,
  buildGsReportImageUrl,
  buildReportImagePath,
  createBackendDisplayReport,
  mapConfirmReportError,
  mapCreateReportError,
  mapFlagReportError,
  mapModerateReportError,
  type ModerateReportAction,
  readConfirmReportCallableResponse,
  readCreateReportCallableResponse,
  readFlagReportCallableResponse,
  readModerateReportCallableResponse
} from "@/lib/firebase/reportPayload";

function createReportImageId(): string {
  const uniqueId =
    globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
  return `${uniqueId}.jpg`;
}

function requireBackendImage(draft: ReportDraft): Blob {
  if (!draft.photoBlob) {
    throw new Error("โหมด Firebase backend ต้องมีไฟล์รูปที่บีบอัดแล้วก่อนส่งรายงาน");
  }

  if (draft.photoBlob.size > REPORT_IMAGE_MAX_BYTES) {
    throw new Error("รูปยังใหญ่เกิน 500KB หลังบีบอัด กรุณาเลือกรูปที่เล็กลง");
  }

  if (!draft.imageMetadata) {
    throw new Error("โหมด Firebase backend ต้องมีข้อมูลรูปภาพก่อนส่งรายงาน");
  }

  return draft.photoBlob;
}

export async function createReportInBackend(draft: ReportDraft): Promise<Report> {
  const services = getFirebaseServices();
  if (!services) {
    throw new Error("Firebase backend ยังตั้งค่าไม่ครบ: เพิ่ม NEXT_PUBLIC_FIREBASE_* หรือใช้ Local demo mode");
  }

  try {
    await ensureAppCheckToken();
    const uid = await ensureAnonymousSession();
    if (!uid) {
      throw new Error("เข้าสู่ระบบแบบ anonymous ไม่สำเร็จ: Firebase Auth ไม่คืนค่า user id");
    }

    const photoBlob = requireBackendImage(draft);
    const imagePath = buildReportImagePath(uid, createReportImageId());
    const imageRef = ref(services.storage, imagePath);

    await uploadBytes(imageRef, photoBlob, {
      contentType: draft.imageMetadata?.contentType ?? "image/jpeg"
    });

    const storageBucket = services.app.options.storageBucket;
    if (typeof storageBucket !== "string") {
      throw new Error("Firebase Storage bucket ยังตั้งค่าไม่ถูกต้อง");
    }

    const createReport = httpsCallable(services.functions, "createReport");
    const result = await createReport(
      buildBackendReportPayload(
        draft,
        buildGsReportImageUrl(storageBucket, imageRef.fullPath)
      )
    );
    const response = readCreateReportCallableResponse(result.data);

    return createBackendDisplayReport(draft, response.reportId, uid);
  } catch (error) {
    throw new Error(mapCreateReportError(error));
  }
}

export async function getBackendSessionUserId(): Promise<string> {
  const services = getFirebaseServices();
  if (!services) {
    throw new Error("Firebase backend ยังตั้งค่าไม่ครบ: เพิ่ม NEXT_PUBLIC_FIREBASE_* หรือใช้ Local demo mode");
  }

  try {
    const uid = await ensureAnonymousSession();
    if (!uid) {
      throw new Error("เข้าสู่ระบบแบบ anonymous ไม่สำเร็จ: Firebase Auth ไม่คืนค่า user id");
    }

    return uid;
  } catch (error) {
    throw new Error(mapConfirmReportError(error));
  }
}

export async function confirmReportInBackend(
  targetReportId: string,
  confirmingReportId: string
): Promise<void> {
  const services = getFirebaseServices();
  if (!services) {
    throw new Error("Firebase backend ยังตั้งค่าไม่ครบ: เพิ่ม NEXT_PUBLIC_FIREBASE_* หรือใช้ Local demo mode");
  }

  try {
    await ensureAppCheckToken();
    const uid = await ensureAnonymousSession();
    if (!uid) {
      throw new Error("เข้าสู่ระบบแบบ anonymous ไม่สำเร็จ: Firebase Auth ไม่คืนค่า user id");
    }

    const confirmReport = httpsCallable(services.functions, "confirmReport");
    const result = await confirmReport({
      targetReportId,
      confirmingReportId
    });
    readConfirmReportCallableResponse(result.data);
  } catch (error) {
    throw new Error(mapConfirmReportError(error));
  }
}

export async function flagReportInBackend(reportId: string): Promise<void> {
  const services = getFirebaseServices();
  if (!services) {
    throw new Error("Firebase backend ยังตั้งค่าไม่ครบ: เพิ่ม NEXT_PUBLIC_FIREBASE_* หรือใช้ Local demo mode");
  }

  try {
    await ensureAppCheckToken();
    const uid = await ensureAnonymousSession();
    if (!uid) {
      throw new Error("เข้าสู่ระบบแบบ anonymous ไม่สำเร็จ: Firebase Auth ไม่คืนค่า user id");
    }

    const flagReport = httpsCallable(services.functions, "flagReport");
    const result = await flagReport({ reportId });
    readFlagReportCallableResponse(result.data);
  } catch (error) {
    throw new Error(mapFlagReportError(error));
  }
}

export async function getBackendOperatorRole(): Promise<AdminProfile["role"] | null> {
  const services = getFirebaseServices();
  if (!services) {
    return null;
  }

  try {
    const uid = await ensureAnonymousSession();
    if (!uid) {
      return null;
    }

    const adminSnapshot = await getDoc(doc(services.firestore, "admins", uid));
    if (!adminSnapshot.exists()) {
      return null;
    }

    const role = adminSnapshot.data().role;
    return role === "moderator" || role === "superadmin" ? role : null;
  } catch {
    return null;
  }
}

export async function moderateReportInBackend(
  reportId: string,
  action: ModerateReportAction
): Promise<void> {
  const services = getFirebaseServices();
  if (!services) {
    throw new Error("Firebase backend ยังตั้งค่าไม่ครบ: เพิ่ม NEXT_PUBLIC_FIREBASE_* หรือใช้ Local demo mode");
  }

  try {
    await ensureAppCheckToken();
    const uid = await ensureAnonymousSession();
    if (!uid) {
      throw new Error("เข้าสู่ระบบแบบ anonymous ไม่สำเร็จ: Firebase Auth ไม่คืนค่า user id");
    }

    const moderateReport = httpsCallable(services.functions, "moderateReport");
    const result = await moderateReport({ reportId, action });
    readModerateReportCallableResponse(result.data);
  } catch (error) {
    throw new Error(mapModerateReportError(error));
  }
}
