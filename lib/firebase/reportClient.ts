"use client";

import { httpsCallable } from "firebase/functions";
import { ref, uploadBytes } from "firebase/storage";
import type { Report, ReportDraft } from "@/lib/types";
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
  mapCreateReportError,
  readCreateReportCallableResponse
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
