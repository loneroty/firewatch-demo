import { createLocalReport } from "@/lib/reportFactory";
import type { Report, ReportDraft, ReportImageMetadata } from "@/lib/types";

export const REPORT_IMAGE_MAX_BYTES = 500 * 1024;

export interface BackendReportPayload {
  lat: number;
  lng: number;
  category: ReportDraft["category"];
  severity: ReportDraft["severity"];
  photoURL: string;
  addressLabel: string;
  notes: string;
  imageMetadata?: ReportImageMetadata;
}

export interface CreateReportCallableResponse {
  reportId: string;
  rateLimit: {
    bucketId: string;
    count: number;
    limit: number;
  };
}

export interface ConfirmReportCallableResponse {
  targetReportId: string;
  confirmingReportId: string;
  confirmedByReportIds: string[];
  verificationStatus: "ยืนยันแล้ว";
}

export interface FlagReportCallableResponse {
  reportId: string;
  flaggedCount: number;
  moderationStatus: Report["moderationStatus"];
}

export type ModerateReportAction = "hide" | "restore";

export interface ModerateReportCallableResponse {
  reportId: string;
  action: ModerateReportAction;
  moderationStatus: "ปกติ" | "ถูกซ่อน";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeErrorCode(code: string | null): string | null {
  if (!code) {
    return null;
  }

  return code.startsWith("functions/") ? code.slice("functions/".length) : code;
}

function readErrorCode(error: unknown): string | null {
  if (!isRecord(error) || typeof error.code !== "string") {
    return null;
  }

  return normalizeErrorCode(error.code);
}

function readErrorMessage(error: unknown): string | null {
  if (error instanceof Error) {
    return error.message;
  }

  if (isRecord(error) && typeof error.message === "string") {
    return error.message;
  }

  return null;
}

function isFirebaseStorageErrorCode(code: string | null): boolean {
  return typeof code === "string" && code.startsWith("storage/");
}

function isFirebaseAuthErrorCode(code: string | null): boolean {
  return typeof code === "string" && code.startsWith("auth/");
}

export function buildReportImagePath(uid: string, imageId: string): string {
  if (!uid || uid.includes("/")) {
    throw new Error("user id จาก Firebase Auth ไม่ถูกต้องสำหรับ Storage path");
  }

  if (!/^[A-Za-z0-9._-]+$/.test(imageId)) {
    throw new Error("image id สำหรับรายงานไม่ถูกต้อง");
  }

  return `reportImages/${uid}/${imageId}`;
}

export function buildGsReportImageUrl(bucket: string, path: string): string {
  const normalizedBucket = bucket.replace(/^gs:\/\//, "").replace(/\/+$/, "");
  if (!normalizedBucket || normalizedBucket.includes("/")) {
    throw new Error("Firebase Storage bucket ยังตั้งค่าไม่ถูกต้อง");
  }

  return `gs://${normalizedBucket}/${path}`;
}

export function buildBackendReportPayload(
  draft: ReportDraft,
  gsPhotoURL: string
): BackendReportPayload {
  return {
    lat: draft.lat,
    lng: draft.lng,
    category: draft.category,
    severity: draft.severity,
    photoURL: gsPhotoURL,
    addressLabel: draft.addressLabel,
    notes: draft.notes,
    imageMetadata: draft.imageMetadata
  };
}

export function readCreateReportCallableResponse(
  data: unknown
): CreateReportCallableResponse {
  if (!isRecord(data) || typeof data.reportId !== "string") {
    throw new Error("callable createReport ไม่ได้คืนค่า report id");
  }

  const rateLimit = data.rateLimit;
  if (
    !isRecord(rateLimit) ||
    typeof rateLimit.bucketId !== "string" ||
    typeof rateLimit.count !== "number" ||
    typeof rateLimit.limit !== "number"
  ) {
    throw new Error("callable createReport ไม่ได้คืนข้อมูล rate limit");
  }

  return {
    reportId: data.reportId,
    rateLimit: {
      bucketId: rateLimit.bucketId,
      count: rateLimit.count,
      limit: rateLimit.limit
    }
  };
}

export function readConfirmReportCallableResponse(
  data: unknown
): ConfirmReportCallableResponse {
  if (
    !isRecord(data) ||
    typeof data.targetReportId !== "string" ||
    typeof data.confirmingReportId !== "string" ||
    data.verificationStatus !== "ยืนยันแล้ว" ||
    !Array.isArray(data.confirmedByReportIds) ||
    !data.confirmedByReportIds.every((reportId): reportId is string => typeof reportId === "string")
  ) {
    throw new Error("callable confirmReport ไม่ได้คืนค่าผลการยืนยันที่ถูกต้อง");
  }

  return {
    targetReportId: data.targetReportId,
    confirmingReportId: data.confirmingReportId,
    confirmedByReportIds: data.confirmedByReportIds,
    verificationStatus: data.verificationStatus
  };
}

export function readFlagReportCallableResponse(
  data: unknown
): FlagReportCallableResponse {
  if (
    !isRecord(data) ||
    typeof data.reportId !== "string" ||
    typeof data.flaggedCount !== "number" ||
    (
      data.moderationStatus !== "ปกติ" &&
      data.moderationStatus !== "รอตรวจสอบ" &&
      data.moderationStatus !== "ถูกซ่อน"
    )
  ) {
    throw new Error("callable flagReport ไม่ได้คืนค่าผลการส่งเข้าคิวตรวจสอบที่ถูกต้อง");
  }

  return {
    reportId: data.reportId,
    flaggedCount: data.flaggedCount,
    moderationStatus: data.moderationStatus
  };
}

export function readModerateReportCallableResponse(
  data: unknown
): ModerateReportCallableResponse {
  if (
    !isRecord(data) ||
    typeof data.reportId !== "string" ||
    (data.action !== "hide" && data.action !== "restore") ||
    (data.moderationStatus !== "ปกติ" && data.moderationStatus !== "ถูกซ่อน")
  ) {
    throw new Error("callable moderateReport ไม่ได้คืนค่าผลการตรวจสอบที่ถูกต้อง");
  }

  return {
    reportId: data.reportId,
    action: data.action,
    moderationStatus: data.moderationStatus
  };
}

export function createBackendDisplayReport(
  draft: ReportDraft,
  reportId: string,
  userId: string,
  now = new Date()
): Report {
  const report = createLocalReport(draft, [], userId, 35, now);

  return {
    ...report,
    id: reportId,
    userId
  };
}

export function mapCreateReportError(error: unknown): string {
  const code = readErrorCode(error);
  const message = readErrorMessage(error);

  if (
    message?.includes("App Check") ||
    message?.includes("ยังตั้งค่า") ||
    message?.includes("ตั้งค่าไม่ครบ")
  ) {
    return message;
  }

  if (isFirebaseAuthErrorCode(code)) {
    return "เข้าสู่ระบบแบบ anonymous ไม่สำเร็จ: ตรวจว่าเปิด Anonymous Auth ใน Firebase แล้วลองใหม่";
  }

  switch (code) {
    case "unauthenticated":
      return "ยังไม่ได้เข้าสู่ระบบ จึงส่งรายงานผ่าน Firebase backend ไม่ได้";
    case "resource-exhausted":
      return "ส่งรายงานครบ 10 ครั้งใน 1 ชั่วโมงแล้ว กรุณาลองใหม่ภายหลัง";
    case "failed-precondition":
      return "ข้อมูลผู้ใช้ของรายงานไม่ตรงกับ session ปัจจุบัน กรุณารีเฟรชแล้วลองใหม่";
    case "invalid-argument":
      return "ข้อมูลรายงานไม่ถูกต้อง: ตรวจพิกัด ประเภท ความรุนแรง ความยาวข้อความ และรูปภาพ";
    case "permission-denied":
    case "storage/unauthorized":
      return "อัปโหลดรูปไม่ได้: บัญชีนี้ไม่มีสิทธิ์เขียน path รูปที่เลือก";
    case "storage/canceled":
      return "การอัปโหลดรูปถูกยกเลิกก่อนส่งรายงาน";
    case "storage/retry-limit-exceeded":
      return "อัปโหลดรูปไม่สำเร็จเพราะเครือข่ายไม่เสถียร กรุณาลองใหม่";
    default:
      if (isFirebaseStorageErrorCode(code)) {
        return "อัปโหลดรูปไป Firebase Storage ไม่สำเร็จ กรุณาลองใหม่";
      }

      if (code) {
        return "callable createReport ส่งรายงานไม่สำเร็จ กรุณาตรวจข้อมูลแล้วลองใหม่";
      }

      return message || "ส่งรายงานไม่สำเร็จ กรุณาลองใหม่";
  }
}

export function mapConfirmReportError(error: unknown): string {
  const code = readErrorCode(error);
  const message = readErrorMessage(error);

  if (
    message?.includes("App Check") ||
    message?.includes("ยังตั้งค่า") ||
    message?.includes("ตั้งค่าไม่ครบ")
  ) {
    return message;
  }

  if (isFirebaseAuthErrorCode(code)) {
    return "เข้าสู่ระบบแบบ anonymous ไม่สำเร็จ: ตรวจว่าเปิด Anonymous Auth ใน Firebase แล้วลองใหม่";
  }

  if (code === "unauthenticated") {
    return "ยังไม่ได้เข้าสู่ระบบ จึงยืนยันรายงานผ่าน Firebase backend ไม่ได้";
  }

  if (code === "already-exists" || message === "duplicate-confirmation") {
    return "คุณยืนยันจุดนี้แล้ว ไม่สามารถยืนยันซ้ำได้";
  }

  if (message === "cannot-confirm-own-report") {
    return "ยืนยันรายงานของตัวเองไม่ได้";
  }

  if (message === "confirming-report-not-owned") {
    return "รายงานที่ใช้ยืนยันต้องเป็นรายงานของบัญชีปัจจุบัน";
  }

  if (
    message === "confirming-report-outside-window" ||
    message === "confirming-report-outside-radius" ||
    message === "cannot-confirm-with-same-report"
  ) {
    return "ต้องสร้างรายงานใกล้จุดนี้ภายใน 60 นาที จึงจะใช้ยืนยันได้";
  }

  if (
    message === "target-report-not-confirmable" ||
    message === "confirming-report-not-confirmable"
  ) {
    return "รายงานนี้ถูกซ่อนหรือถูกปฏิเสธแล้ว จึงยืนยันไม่ได้";
  }

  if (code === "not-found") {
    return "ไม่พบรายงานที่ต้องการยืนยัน กรุณารีเฟรชแล้วลองใหม่";
  }

  if (code === "invalid-argument") {
    return "ข้อมูลยืนยันรายงานไม่ถูกต้อง กรุณารีเฟรชแล้วลองใหม่";
  }

  if (code === "failed-precondition") {
    return "ต้องสร้างรายงานใกล้จุดนี้ก่อน จึงจะใช้ยืนยันได้";
  }

  return message || "ยืนยันรายงานไม่สำเร็จ กรุณาลองใหม่";
}

export function mapFlagReportError(error: unknown): string {
  const code = readErrorCode(error);
  const message = readErrorMessage(error);

  if (
    message?.includes("App Check") ||
    message?.includes("ยังตั้งค่า") ||
    message?.includes("ตั้งค่าไม่ครบ")
  ) {
    return message;
  }

  if (isFirebaseAuthErrorCode(code)) {
    return "เข้าสู่ระบบแบบ anonymous ไม่สำเร็จ: ตรวจว่าเปิด Anonymous Auth ใน Firebase แล้วลองใหม่";
  }

  if (code === "internal" || message === "internal" || message === "Request failed.") {
    return "ยังไม่สามารถส่งเข้าคิวตรวจสอบได้ กรุณาลองใหม่อีกครั้ง";
  }

  if (code === "unauthenticated") {
    return "ยังไม่ได้เข้าสู่ระบบ จึงรายงานข้อมูลไม่ถูกต้องผ่าน Firebase backend ไม่ได้";
  }

  if (code === "already-exists" || message === "duplicate-report-flag") {
    return "คุณเคยรายงานข้อมูลนี้แล้ว ระบบรับไว้ในคิวตรวจสอบแล้ว";
  }

  if (code === "not-found" || message === "report-not-found") {
    return "ไม่พบรายงานนี้แล้ว กรุณารีเฟรชแล้วลองใหม่";
  }

  if (code === "invalid-argument") {
    return "ข้อมูลรายงานที่จะส่งเข้าคิวตรวจสอบไม่ถูกต้อง กรุณารีเฟรชแล้วลองใหม่";
  }

  if (code === "failed-precondition") {
    return "รายงานนี้ไม่สามารถส่งเข้าคิวตรวจสอบได้ในขณะนี้";
  }

  return message || "ส่งรายงานเข้าคิวตรวจสอบไม่สำเร็จ กรุณาลองใหม่";
}

export function mapModerateReportError(error: unknown): string {
  const code = readErrorCode(error);
  const message = readErrorMessage(error);

  if (
    message?.includes("App Check") ||
    message?.includes("ยังตั้งค่า") ||
    message?.includes("ตั้งค่าไม่ครบ")
  ) {
    return message;
  }

  if (isFirebaseAuthErrorCode(code)) {
    return "เข้าสู่ระบบแบบ anonymous ไม่สำเร็จ: ตรวจว่าเปิด Anonymous Auth ใน Firebase แล้วลองใหม่";
  }

  if (code === "permission-denied" || message === "operator-role-required") {
    return "ไม่มีสิทธิ์ตรวจสอบรายงาน";
  }

  if (code === "unauthenticated") {
    return "ยังไม่ได้เข้าสู่ระบบ จึงตรวจสอบรายงานผ่าน Firebase backend ไม่ได้";
  }

  if (code === "not-found" || message === "report-not-found") {
    return "ไม่พบรายงานนี้แล้ว กรุณารีเฟรชแล้วลองใหม่";
  }

  if (code === "invalid-argument" || message === "moderation-action-invalid") {
    return "สถานะที่ส่งมาไม่ถูกต้อง กรุณารีเฟรชแล้วลองใหม่";
  }

  if (code === "internal" || message === "Request failed.") {
    return "ไม่สามารถอัปเดตสถานะได้ กรุณาลองใหม่อีกครั้ง";
  }

  return message || "ไม่สามารถอัปเดตสถานะได้ กรุณาลองใหม่อีกครั้ง";
}
