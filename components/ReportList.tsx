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
    return "border-canopy-500/30 bg-canopy-50 text-canopy-700";
  }

  if (report.verificationStatus === "ถูกปฏิเสธ") {
    return "border-smoke-200 bg-smoke-100 text-smoke-600";
  }

  return "border-ember-200 bg-ember-50 text-ember-700";
}

function getStatusRailClassName(report: Report): string {
  if (report.verificationStatus === "ยืนยันแล้ว") {
    return "bg-canopy-700";
  }

  if (report.verificationStatus === "ถูกปฏิเสธ") {
    return "bg-smoke-500";
  }

  return "bg-ember-600";
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
      <div className="grid min-h-52 place-items-center bg-white p-8 text-center">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.18em] text-smoke-500">
            No active reports
          </p>
          <p className="mt-3 text-sm leading-6 text-smoke-600">
            ยังไม่มีรายงานในตัวกรองนี้ ลองเปลี่ยนสถานะหรือสร้างรายงานใหม่จากฟอร์มแจ้งเหตุ
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-0 bg-white">
      <div className="divide-y divide-smoke-200">
        {reports.map((report, index) => (
          <article
            key={report.id}
            className={`motion-fade-up group relative transition duration-200 ${
              selectedReportId === report.id
                ? "bg-ember-50/70 shadow-[inset_0_0_0_1px_rgb(234_88_12_/_0.18)]"
                : "bg-white hover:-translate-y-0.5 hover:bg-smoke-50 hover:shadow-[0_14px_32px_rgb(15_23_42_/_0.08)]"
            }`}
            style={{ animationDelay: `${Math.min(index, 6) * 45}ms` }}
          >
            <span
              className={`absolute bottom-0 left-0 top-0 w-1 transition-[width] duration-200 group-hover:w-1.5 ${getStatusRailClassName(report)}`}
              aria-hidden="true"
            />
            <div className="p-4 pl-5">
              <button
                className="grid w-full grid-cols-[82px_1fr] gap-4 text-left sm:grid-cols-[104px_1fr]"
                type="button"
                onClick={() => onSelectReport(report.id)}
              >
                <img
                  className="aspect-square h-[82px] w-[82px] rounded-md border border-smoke-200 object-cover sm:h-[104px] sm:w-[104px]"
                  src={report.photoURL}
                  alt={`รูปประกอบรายงาน ${getCategoryLabel(report.category)}`}
                  onError={(event) => {
                    if (!event.currentTarget.src.endsWith("/report-placeholder.svg")) {
                      event.currentTarget.src = "/report-placeholder.svg";
                    }
                  }}
                />
                <span className="min-w-0">
                  <span className="mb-2 flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full border px-2.5 py-1 text-xs font-black ${getStatusClassName(
                        report
                      )}`}
                    >
                      {report.verificationStatus}
                    </span>
                    {report.isThrottled ? (
                      <span className="rounded-sm bg-red-50 px-2.5 py-1 text-xs font-black text-red-700">
                        จำกัดความน่าเชื่อถือ
                      </span>
                    ) : null}
                    <span className="text-xs font-semibold text-smoke-500">
                      #{report.id.slice(-6)}
                    </span>
                  </span>
                  <span className="block text-lg font-black leading-tight text-smoke-950">
                    {getCategoryLabel(report.category)}
                  </span>
                  <span className="mt-1 block text-sm font-semibold text-ember-700">
                    {getSeverityLabel(report.severity)}
                  </span>
                  <span className="mt-3 flex min-w-0 items-center gap-1 text-sm text-smoke-600">
                    <MapPin aria-hidden="true" size={15} />
                    <span className="truncate">{report.addressLabel}</span>
                  </span>
                  <span className="mt-1 block text-xs font-semibold text-smoke-500">
                    {formatTime(report.createdAt)}
                  </span>
                </span>
              </button>

              {report.notes ? (
                <p className="mt-4 line-clamp-2 border-l border-smoke-200 pl-3 text-sm leading-6 text-smoke-700">
                  {report.notes}
                </p>
              ) : null}

              <div className="mt-4 flex flex-col gap-3 border-t border-smoke-200 pt-3 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-xs font-semibold text-smoke-600">
                  ยืนยันโดย {report.confirmedByReportIds.length} รายงานใกล้เคียง
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    className="group/confirm hover-lift inline-flex min-h-10 items-center gap-1.5 rounded-md bg-canopy-700 px-3 py-2 text-xs font-black text-white hover:bg-canopy-500"
                    type="button"
                    onClick={() => {
                      void onConfirmReport(report.id);
                    }}
                  >
                    <CheckCircle2 aria-hidden="true" className="transition-transform duration-200 group-hover/confirm:scale-110" size={14} />
                    ยืนยันจุดนี้
                  </button>
                  <button
                    className="hover-lift inline-flex min-h-10 items-center gap-1.5 rounded-md border border-smoke-200 bg-white px-3 py-2 text-xs font-bold text-smoke-700 hover:border-smoke-400 hover:bg-smoke-50"
                    type="button"
                    onClick={() => onFlagReport(report.id)}
                  >
                    <Flag aria-hidden="true" size={14} />
                    ไม่เหมาะสม {report.flaggedCount > 0 ? report.flaggedCount : ""}
                  </button>
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
