import {
  ExternalLink,
  Eye,
  EyeOff,
  Flag,
  MapPin,
  ShieldCheck
} from "lucide-react";
import { getCategoryLabel, getSeverityLabel } from "@/lib/reportLabels";
import type { Report } from "@/lib/types";

type ModerateReportAction = "hide" | "restore";
type OperatorRole = "moderator" | "superadmin" | "local-demo" | null;

interface ModerationQueueSectionProps {
  canModerate: boolean;
  isBackendMode: boolean;
  moderatingReportKeys: readonly string[];
  operatorRole: OperatorRole;
  reports: readonly Report[];
  selectedReportId: string | null;
  onModerateReport: (reportId: string, action: ModerateReportAction) => void | Promise<void>;
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

function formatCoordinate(value: number): string {
  return value.toFixed(5);
}

function buildGoogleMapsUrl(report: Report): string {
  return `https://www.google.com/maps/search/?api=1&query=${report.lat},${report.lng}`;
}

function getModerationTone(report: Report): string {
  if (report.moderationStatus === "ถูกซ่อน") {
    return "border-red-200 bg-red-50 text-red-700";
  }

  if (report.moderationStatus === "รอตรวจสอบ") {
    return "border-ember-200 bg-ember-50 text-ember-800";
  }

  return "border-smoke-200 bg-white text-smoke-700";
}

function getOperatorLabel(role: OperatorRole, isBackendMode: boolean): string {
  if (!isBackendMode) {
    return "Local demo operator";
  }

  if (role === "moderator") {
    return "Moderator";
  }

  if (role === "superadmin") {
    return "Superadmin";
  }

  return "Read-only";
}

export function ModerationQueueSection({
  canModerate,
  isBackendMode,
  moderatingReportKeys,
  operatorRole,
  reports,
  selectedReportId,
  onModerateReport,
  onSelectReport
}: ModerationQueueSectionProps) {
  return (
    <section className="bg-[#f8f5ee] px-4 py-10">
      <div className="mx-auto max-w-[1440px] overflow-hidden rounded-lg border border-smoke-200 bg-white shadow-sm">
        <div className="grid gap-4 border-b border-smoke-200 p-4 md:grid-cols-[minmax(0,1fr)_minmax(280px,0.38fr)] md:p-5">
          <div>
            <p className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-ember-700">
              <ShieldCheck aria-hidden="true" size={15} />
              Operator moderation
            </p>
            <h2 className="text-2xl font-black tracking-tight text-smoke-950 md:text-3xl">
              คิวตรวจสอบรายงาน
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-smoke-600">
              รายงานที่ถูก flag หรือถูกซ่อนจะอยู่ในคิวนี้เพื่อให้ operator ตรวจสอบหลักฐานก่อนตัดสินใจ
              การซ่อนรายงานเป็นการนำออกจากแผนที่สาธารณะ ไม่ใช่การลบข้อมูลถาวร
            </p>
          </div>
          <div className="grid gap-3 rounded-lg border border-smoke-200 bg-smoke-50 p-4">
            <div>
              <p className="text-sm font-black text-smoke-950">สถานะ operator</p>
              <p className="mt-1 text-sm font-semibold text-smoke-600">
                {getOperatorLabel(operatorRole, isBackendMode)}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-smoke-500">
                  Queue
                </p>
                <p className="mt-1 text-3xl font-black text-ember-700">{reports.length}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-smoke-500">
                  Mode
                </p>
                <p className="mt-2 text-sm font-black text-smoke-950">
                  {isBackendMode ? "Firebase" : "Local demo"}
                </p>
              </div>
            </div>
            {!canModerate ? (
              <p className="rounded-md border border-smoke-200 bg-white p-3 text-xs leading-5 text-smoke-600">
                โหมดนี้เป็น read-only สำหรับผู้ใช้ทั่วไป ปุ่มซ่อน/กู้คืนจะแสดงเฉพาะบัญชีใน admins ที่มี role moderator หรือ superadmin
              </p>
            ) : null}
          </div>
        </div>

        {reports.length === 0 ? (
          <div className="grid min-h-48 place-items-center p-6 text-center">
            <div>
              <p className="text-sm font-black text-smoke-950">ยังไม่มีรายงานในคิวตรวจสอบ</p>
              <p className="mt-2 text-sm leading-6 text-smoke-600">
                เมื่อมีคนรายงานข้อมูลไม่ถูกต้อง หรือ operator ซ่อนรายงานไว้ รายการจะมาแสดงที่นี่
              </p>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 p-4 lg:grid-cols-2">
            {reports.map((report) => {
              const hideKey = `${report.id}:hide`;
              const restoreKey = `${report.id}:restore`;
              const isHiding = moderatingReportKeys.includes(hideKey);
              const isRestoring = moderatingReportKeys.includes(restoreKey);
              const isModerating = isHiding || isRestoring;
              const canHideReport = canModerate && report.moderationStatus !== "ถูกซ่อน";
              const canRestoreReport = canModerate && report.moderationStatus === "ถูกซ่อน";
              const mapsUrl = buildGoogleMapsUrl(report);

              return (
                <article
                  key={report.id}
                  className={`min-w-0 rounded-lg border bg-white p-4 transition ${
                    selectedReportId === report.id
                      ? "border-ember-500 shadow-[0_0_0_1px_rgb(234_88_12_/_0.16)]"
                      : "border-smoke-200"
                  }`}
                >
                  <div className="grid gap-4 sm:grid-cols-[112px_minmax(0,1fr)]">
                    <button
                      className="group relative aspect-[4/3] min-h-[112px] overflow-hidden rounded-md border border-smoke-200 bg-smoke-100 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ember-500"
                      type="button"
                      onClick={() => onSelectReport(report.id)}
                    >
                      <img
                        className="h-full w-full object-cover transition duration-200 group-hover:scale-[1.03]"
                        src={report.photoURL}
                        alt={`รูปหลักฐานรายงาน ${getCategoryLabel(report.category)}`}
                        onError={(event) => {
                          if (!event.currentTarget.src.endsWith("/report-placeholder.svg")) {
                            event.currentTarget.src = "/report-placeholder.svg";
                          }
                        }}
                      />
                    </button>

                    <div className="min-w-0">
                      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <button
                          className="min-w-0 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ember-500"
                          type="button"
                          onClick={() => onSelectReport(report.id)}
                        >
                          <span className="block text-base font-black leading-tight text-smoke-950">
                            {getCategoryLabel(report.category)}
                          </span>
                          <span className="mt-1 block text-xs font-semibold text-smoke-500">
                            #{report.id.slice(-6)} / {formatTime(report.createdAt)}
                          </span>
                        </button>
                        <span
                          className={`w-fit shrink-0 rounded-full border px-2.5 py-1 text-xs font-black ${getModerationTone(report)}`}
                        >
                          {report.moderationStatus}
                        </span>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <span className="rounded-md border border-ember-200 bg-ember-50 px-2.5 py-1 text-xs font-black text-ember-800">
                          {getSeverityLabel(report.severity)}
                        </span>
                        <span className="rounded-md border border-smoke-200 bg-smoke-50 px-2.5 py-1 text-xs font-bold text-smoke-700">
                          {report.verificationStatus}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-md border border-smoke-200 bg-white px-2.5 py-1 text-xs font-bold text-smoke-700">
                          <Flag aria-hidden="true" size={13} />
                          {report.flaggedCount} flag
                        </span>
                      </div>

                      <div className="mt-4 grid gap-2 text-sm leading-6 text-smoke-700">
                        <p className="min-w-0 break-words">
                          <span className="font-black text-smoke-950">พื้นที่:</span>{" "}
                          {report.addressLabel || "ไม่ระบุพื้นที่"}
                        </p>
                        {report.notes ? (
                          <p className="min-w-0 break-words">
                            <span className="font-black text-smoke-950">หมายเหตุ:</span>{" "}
                            {report.notes}
                          </p>
                        ) : null}
                        <p className="flex min-w-0 flex-wrap items-center gap-2 text-smoke-600">
                          <MapPin aria-hidden="true" size={15} />
                          <span>
                            {formatCoordinate(report.lat)}, {formatCoordinate(report.lng)}
                          </span>
                          <a
                            className="inline-flex items-center gap-1 font-bold text-ember-700 underline-offset-4 hover:underline"
                            href={mapsUrl}
                            rel="noreferrer"
                            target="_blank"
                          >
                            เปิดแผนที่
                            <ExternalLink aria-hidden="true" size={13} />
                          </a>
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-col gap-2 border-t border-smoke-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs leading-5 text-smoke-500">
                      ซ่อนรายงานจะนำออกจากรายการสาธารณะ แต่ไม่ลบข้อมูลหรือหลักฐานเดิม
                    </p>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <button
                        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs font-black text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                        type="button"
                        disabled={!canHideReport || isModerating}
                        onClick={() => {
                          void onModerateReport(report.id, "hide");
                        }}
                      >
                        <EyeOff aria-hidden="true" size={14} />
                        {isHiding ? "กำลังซ่อน" : "ซ่อนรายงาน"}
                      </button>
                      <button
                        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-canopy-200 bg-canopy-50 px-3 py-2 text-xs font-black text-canopy-700 hover:bg-canopy-100 disabled:cursor-not-allowed disabled:opacity-50"
                        type="button"
                        disabled={!canRestoreReport || isModerating}
                        onClick={() => {
                          void onModerateReport(report.id, "restore");
                        }}
                      >
                        <Eye aria-hidden="true" size={14} />
                        {isRestoring ? "กำลังกู้คืน" : "กู้คืนเป็นปกติ"}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
