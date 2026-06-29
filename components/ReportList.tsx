"use client";

import { CheckCircle2, Flag, MapPin } from "lucide-react";
import { getCategoryLabel, getSeverityLabel } from "@/lib/reportLabels";
import type { Report } from "@/lib/types";

interface ReportListProps {
  reports: readonly Report[];
  selectedReportId: string | null;
  onSelectReport: (reportId: string) => void;
  onFlagReport: (reportId: string) => void;
  onConfirmReport: (reportId: string) => void | Promise<void>;
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "short"
  }).format(new Date(value));
}

function getStatusClassName(report: Report): string {
  if (report.verificationStatus === "ยืนยันแล้ว") {
    return "bg-canopy-50 text-canopy-700";
  }

  if (report.verificationStatus === "ถูกปฏิเสธ") {
    return "bg-smoke-100 text-smoke-600";
  }

  return "bg-ember-50 text-ember-700";
}

export function ReportList({
  reports,
  selectedReportId,
  onSelectReport,
  onFlagReport,
  onConfirmReport
}: ReportListProps) {
  if (reports.length === 0) {
    return (
      <div className="grid min-h-40 place-items-center p-6 text-center text-sm text-smoke-600">
        ไม่มีรายงานในตัวกรองนี้
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-3">
      <div className="space-y-3">
        {reports.map((report) => (
          <article
            key={report.id}
            className={`rounded-lg border p-3 transition ${
              selectedReportId === report.id
                ? "border-smoke-950 bg-smoke-50"
                : "border-smoke-200 bg-white"
            }`}
          >
            <button
              className="grid w-full grid-cols-[72px_1fr] gap-3 text-left"
              type="button"
              onClick={() => onSelectReport(report.id)}
            >
              <img
                className="h-18 w-18 aspect-square rounded-md object-cover"
                src={report.photoURL}
                alt={`รูปประกอบรายงาน ${getCategoryLabel(report.category)}`}
              />
              <span className="min-w-0">
                <span className="mb-2 flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusClassName(
                      report
                    )}`}
                  >
                    {report.verificationStatus}
                  </span>
                  {report.isThrottled ? (
                    <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700">
                      จำกัดความน่าเชื่อถือ
                    </span>
                  ) : null}
                </span>
                <span className="block truncate font-semibold text-smoke-950">
                  {getCategoryLabel(report.category)} · {getSeverityLabel(report.severity)}
                </span>
                <span className="mt-1 flex items-center gap-1 text-sm text-smoke-600">
                  <MapPin aria-hidden="true" size={15} />
                  <span className="truncate">{report.addressLabel}</span>
                </span>
                <span className="mt-1 block text-xs text-smoke-600">
                  {formatTime(report.createdAt)}
                </span>
              </span>
            </button>
            {report.notes ? (
              <p className="mt-3 line-clamp-2 text-sm text-smoke-700">{report.notes}</p>
            ) : null}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-smoke-100 pt-3">
              <span className="text-xs text-smoke-600">
                ยืนยันโดย {report.confirmedByReportIds.length} รายงาน
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  className="inline-flex items-center gap-1 rounded-md border border-canopy-200 px-2.5 py-1.5 text-xs font-semibold text-canopy-700 hover:border-canopy-400"
                  type="button"
                  onClick={() => {
                    void onConfirmReport(report.id);
                  }}
                >
                  <CheckCircle2 aria-hidden="true" size={14} />
                  ยืนยันจุดนี้
                </button>
                <button
                  className="inline-flex items-center gap-1 rounded-md border border-smoke-200 px-2.5 py-1.5 text-xs font-semibold text-smoke-700 hover:border-smoke-400"
                  type="button"
                  onClick={() => onFlagReport(report.id)}
                >
                  <Flag aria-hidden="true" size={14} />
                  ไม่เหมาะสม {report.flaggedCount > 0 ? report.flaggedCount : ""}
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
