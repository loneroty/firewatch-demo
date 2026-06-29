"use client";

import { logger } from "@/lib/logger";
import { createSeedReports } from "@/lib/seedReports";
import {
  reportCategories,
  type ModerationStatus,
  type Report,
  type ReportCategory,
  type Severity,
  type VerificationStatus
} from "@/lib/types";

const REPORT_STORAGE_KEY = "firewatch.reports.v1";
const USER_STORAGE_KEY = "firewatch.localUserId.v1";

const verificationStatuses: readonly VerificationStatus[] = [
  "รอการยืนยัน",
  "ยืนยันแล้ว",
  "ถูกปฏิเสธ"
];

const moderationStatuses: readonly ModerationStatus[] = [
  "ปกติ",
  "ถูกซ่อน",
  "รอตรวจสอบ"
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isReportCategory(value: unknown): value is ReportCategory {
  return (
    typeof value === "string" &&
    reportCategories.includes(value as ReportCategory)
  );
}

function isSeverity(value: unknown): value is Severity {
  return value === 1 || value === 2 || value === 3;
}

function isReport(value: unknown): value is Report {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.lat === "number" &&
    typeof value.lng === "number" &&
    typeof value.geohash === "string" &&
    typeof value.photoURL === "string" &&
    isReportCategory(value.category) &&
    isSeverity(value.severity) &&
    typeof value.createdAt === "string" &&
    typeof value.userId === "string" &&
    typeof value.verificationStatus === "string" &&
    verificationStatuses.includes(value.verificationStatus as VerificationStatus) &&
    Array.isArray(value.confirmedByReportIds) &&
    value.confirmedByReportIds.every((id) => typeof id === "string") &&
    typeof value.isThrottled === "boolean" &&
    typeof value.flaggedCount === "number" &&
    typeof value.moderationStatus === "string" &&
    moderationStatuses.includes(value.moderationStatus as ModerationStatus) &&
    typeof value.addressLabel === "string" &&
    typeof value.notes === "string"
  );
}

export function loadStoredReports(): Report[] {
  if (typeof window === "undefined") {
    return createSeedReports();
  }

  const raw = window.localStorage.getItem(REPORT_STORAGE_KEY);
  if (!raw) {
    return createSeedReports();
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.every(isReport)) {
      return parsed;
    }
  } catch (error) {
    logger.warn("Failed to parse stored reports", {
      reason: error instanceof Error ? error.message : "unknown"
    });
  }

  return createSeedReports();
}

export function saveStoredReports(reports: readonly Report[]): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(REPORT_STORAGE_KEY, JSON.stringify(reports));
  } catch (error) {
    logger.warn("Failed to save reports", {
      reason: error instanceof Error ? error.message : "unknown"
    });
  }
}

export function getOrCreateLocalUserId(): string {
  if (typeof window === "undefined") {
    return "local-demo-user";
  }

  const existing = window.localStorage.getItem(USER_STORAGE_KEY);
  if (existing) {
    return existing;
  }

  const generated =
    globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
  const userId = `local-${generated}`;
  window.localStorage.setItem(USER_STORAGE_KEY, userId);
  return userId;
}
