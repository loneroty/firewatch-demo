import { Flag, ShieldCheck } from "lucide-react";
import { getCategoryLabel, getSeverityLabel } from "@/lib/reportLabels";
import type { Report } from "@/lib/types";

interface ModerationQueueSectionProps {
  reports: readonly Report[];
  selectedReportId: string | null;
  onSelectReport: (reportId: string) => void;
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "short"
  }).format(new Date(value));
}

function getModerationTone(report: Report): string {
  if (report.moderationStatus === "รอตรวจสอบ") {
    return "border-ember-200 bg-ember-50 text-ember-800";
  }

  return "border-smoke-200 bg-white text-smoke-700";
}

export function ModerationQueueSection({
  reports,
  selectedReportId,
  onSelectReport
}: ModerationQueueSectionProps) {
  return (
    <section className="bg-[#f8f5ee] px-4 py-10">
      <div className="mx-auto max-w-[1440px] rounded-lg border border-smoke-200 bg-white shadow-sm">
        <div className="grid gap-4 border-b border-smoke-200 p-4 md:grid-cols-[minmax(0,1fr)_minmax(280px,0.42fr)] md:p-5">
          <div>
            <p className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-ember-700">
              <ShieldCheck aria-hidden="true" size={15} />
              Trust & moderation
            </p>
            <h2 className="text-2xl font-black tracking-tight text-smoke-950 md:text-3xl">
              คิวตรวจสอบรายงาน
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-smoke-600">
              การรายงานข้อมูลไม่ถูกต้องจะส่งเข้าคิวตรวจสอบ ไม่ได้ลบรายงานทันที
              และยังไม่มีปุ่มซ่อนหรือลบสำหรับผู้ใช้ทั่วไปในรอบนี้
            </p>
          </div>
          <div className="rounded-lg border border-smoke-200 bg-smoke-50 p-4">
            <p className="text-sm font-black text-smoke-950">สถานะคิวเบื้องต้น</p>
            <p className="mt-2 text-3xl font-black text-ember-700">{reports.length}</p>
            <p className="mt-1 text-sm leading-6 text-smoke-600">
              รายงานที่มี flag หรืออยู่ในสถานะรอตรวจสอบ
            </p>
          </div>
        </div>

        {reports.length === 0 ? (
          <div className="p-5 text-sm leading-6 text-smoke-600">
            ยังไม่มีรายงานที่ถูกส่งเข้าคิวตรวจสอบ
          </div>
        ) : (
          <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
            {reports.slice(0, 6).map((report) => (
              <button
                key={report.id}
                className={`min-w-0 rounded-lg border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgb(15_23_42_/_0.08)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ember-500 ${
                  selectedReportId === report.id
                    ? "border-ember-500 bg-ember-50"
                    : "border-smoke-200 bg-white"
                }`}
                type="button"
                onClick={() => onSelectReport(report.id)}
              >
                <span className="flex min-w-0 items-start justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-black text-smoke-950">
                      {getCategoryLabel(report.category)}
                    </span>
                    <span className="mt-1 block text-xs font-semibold text-smoke-500">
                      #{report.id.slice(-6)} / {formatTime(report.createdAt)}
                    </span>
                  </span>
                  <span
                    className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-black ${getModerationTone(report)}`}
                  >
                    {report.moderationStatus}
                  </span>
                </span>

                <span className="mt-3 grid gap-2 text-sm text-smoke-700">
                  <span className="flex items-center gap-2">
                    <Flag aria-hidden="true" className="text-ember-700" size={15} />
                    {report.flaggedCount} flag
                  </span>
                  <span>{getSeverityLabel(report.severity)}</span>
                  <span className="truncate text-smoke-500">{report.addressLabel}</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
