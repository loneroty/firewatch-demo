export const reportCategories = [
  "open_burning",
  "wildfire_smoke",
  "industrial_smoke",
  "other"
] as const;

export type ReportCategory = (typeof reportCategories)[number];

export type Severity = 1 | 2 | 3;

export type VerificationStatus =
  | "รอการยืนยัน"
  | "ยืนยันแล้ว"
  | "ถูกปฏิเสธ";

export type ModerationStatus = "ปกติ" | "ถูกซ่อน" | "รอตรวจสอบ";

export interface Report {
  id: string;
  lat: number;
  lng: number;
  geohash: string;
  photoURL: string;
  category: ReportCategory;
  severity: Severity;
  createdAt: string;
  userId: string;
  verificationStatus: VerificationStatus;
  confirmedByReportIds: string[];
  isThrottled: boolean;
  flaggedCount: number;
  moderationStatus: ModerationStatus;
  addressLabel: string;
  notes: string;
}

export interface ReportImageMetadata {
  contentType: "image/jpeg" | "image/png" | "image/webp";
  sizeBytes: number;
  width?: number;
  height?: number;
}

export interface UserProfile {
  id: string;
  authProvider: "anonymous" | "line" | "phone";
  displayName: string;
  reputationScore: number;
  reportsCount: number;
  verifiedReportsCount: number;
  rejectedReportsCount: number;
  homeGeohash: string;
  isSuspended: boolean;
  createdAt: string;
}

export interface AdminProfile {
  uid: string;
  role: "moderator" | "superadmin";
}

export interface ReportDraft {
  lat: number;
  lng: number;
  category: ReportCategory;
  severity: Severity;
  photoURL: string;
  photoBlob?: Blob;
  imageMetadata?: ReportImageMetadata;
  notes: string;
  addressLabel: string;
}
