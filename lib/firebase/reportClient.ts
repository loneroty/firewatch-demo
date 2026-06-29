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
    throw new Error("Backend mode requires a compressed image file.");
  }

  if (draft.photoBlob.size > REPORT_IMAGE_MAX_BYTES) {
    throw new Error("The selected image is larger than the backend upload limit.");
  }

  if (!draft.imageMetadata) {
    throw new Error("Backend mode requires image metadata.");
  }

  return draft.photoBlob;
}

export async function createReportInBackend(draft: ReportDraft): Promise<Report> {
  const services = getFirebaseServices();
  if (!services) {
    throw new Error("Firebase backend is not configured. Use Local demo mode or add Firebase public env vars.");
  }

  try {
    await ensureAppCheckToken();
    const uid = await ensureAnonymousSession();
    if (!uid) {
      throw new Error("Anonymous sign-in did not return a user id.");
    }

    const photoBlob = requireBackendImage(draft);
    const imagePath = buildReportImagePath(uid, createReportImageId());
    const imageRef = ref(services.storage, imagePath);

    await uploadBytes(imageRef, photoBlob, {
      contentType: draft.imageMetadata?.contentType ?? "image/jpeg"
    });

    const storageBucket = services.app.options.storageBucket;
    if (typeof storageBucket !== "string") {
      throw new Error("Firebase Storage bucket is not configured correctly.");
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
