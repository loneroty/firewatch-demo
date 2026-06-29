import type {
  ModerationStatus,
  ReportCategory,
  Severity,
  VerificationStatus
} from "@/lib/types";

export const categoryOptions: ReadonlyArray<{
  value: ReportCategory;
  label: string;
}> = [
  { value: "open_burning", label: "เผาในที่โล่ง" },
  { value: "wildfire_smoke", label: "ควัน/ไฟป่า" },
  { value: "industrial_smoke", label: "ควันโรงงาน" },
  { value: "other", label: "อื่น ๆ" }
];

export const severityOptions: ReadonlyArray<{
  value: Severity;
  label: string;
}> = [
  { value: 1, label: "เบา" },
  { value: 2, label: "กลาง" },
  { value: 3, label: "รุนแรง" }
];

export const verificationStatusLabels: Record<VerificationStatus, string> = {
  "รอการยืนยัน": "รอการยืนยัน",
  "ยืนยันแล้ว": "ยืนยันแล้ว",
  "ถูกปฏิเสธ": "ถูกปฏิเสธ"
};

export const moderationStatusLabels: Record<ModerationStatus, string> = {
  "ปกติ": "ปกติ",
  "ถูกซ่อน": "ถูกซ่อน",
  "รอตรวจสอบ": "รอตรวจสอบ"
};

export function getCategoryLabel(category: ReportCategory): string {
  return categoryOptions.find((option) => option.value === category)?.label ?? "อื่น ๆ";
}

export function getSeverityLabel(severity: Severity): string {
  return severityOptions.find((option) => option.value === severity)?.label ?? "ไม่ระบุ";
}
