import {
  AlertTriangle,
  Clock3,
  ListChecks,
  MapPinned,
  ShieldCheck,
  X
} from "lucide-react";
import type {
  FieldRecommendation,
  IncidentDetail,
  IncidentTimelineEvent,
  IncidentTimelineEventKind
} from "@/lib/incidentDetail";
import { EmergencyHandoffPanel } from "@/components/ui/EmergencyHandoffPanel";
import { buildAlertZoneHandoffSummary } from "@/lib/emergencyHandoff";
import type { RiskLevel } from "@/lib/incidentIntelligence";
import { formatZoneAge } from "@/lib/incidentIntelligence";

interface IncidentDetailPanelProps {
  detail: IncidentDetail;
  onClearAlertZone: () => void;
}

const riskToneClassNames: Record<RiskLevel, string> = {
  "เฝ้าระวัง": "border-sky-200 bg-sky-50 text-sky-700",
  "น่ากังวล": "border-ember-200 bg-ember-50 text-ember-700",
  "ควรตรวจสอบเร่งด่วน": "border-red-200 bg-red-50 text-red-700"
};

const eventToneClassNames: Record<IncidentTimelineEventKind, string> = {
  "new-report": "border-sky-200 bg-sky-50 text-sky-700",
  "high-severity": "border-ember-200 bg-ember-50 text-ember-700",
  "verified-report": "border-canopy-200 bg-canopy-50 text-canopy-700"
};

function formatCoordinate(value: number): string {
  return value.toFixed(4);
}

function getZoneShortName(detail: IncidentDetail): string {
  return detail.zone.primaryAddressLabel || `Zone ${detail.zone.reportIds[0]?.slice(-6) ?? ""}`;
}

function RecommendationBlock({
  recommendation
}: {
  recommendation: FieldRecommendation;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
      <div className="flex items-center gap-2 text-sm font-black text-ember-100">
        <ShieldCheck aria-hidden="true" size={17} />
        Field recommendation
      </div>
      <h3 className="mt-3 text-xl font-black text-white">{recommendation.title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-300">{recommendation.detail}</p>
      <ul className="mt-4 space-y-2 text-sm leading-6 text-slate-300">
        {recommendation.steps.map((step) => (
          <li key={step} className="grid grid-cols-[18px_1fr] gap-2">
            <ListChecks aria-hidden="true" className="mt-1 text-ember-200" size={15} />
            <span>{step}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TimelineEventItem({ event }: { event: IncidentTimelineEvent }) {
  return (
    <li className="grid grid-cols-[16px_1fr] gap-3">
      <span
        aria-hidden="true"
        className={`mt-1.5 h-3 w-3 rounded-full border ${eventToneClassNames[event.kind]}`}
      />
      <div className="border-b border-white/10 pb-4">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-black text-white">{event.title}</p>
          {event.isOldReport ? (
            <span className="rounded-sm border border-slate-600 bg-slate-900 px-2 py-0.5 text-xs font-bold text-slate-300">
              ข้อมูลเก่า
            </span>
          ) : null}
        </div>
        <p className="mt-1 text-sm leading-6 text-slate-300">{event.detail}</p>
        <p className="mt-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
          #{event.reportId.slice(-6)} · {event.verificationStatus}
        </p>
      </div>
    </li>
  );
}

export function IncidentDetailPanel({
  detail,
  onClearAlertZone
}: IncidentDetailPanelProps) {
  const zone = detail.zone;
  const handoffSummary = buildAlertZoneHandoffSummary(zone);

  return (
    <div
      aria-labelledby="incident-detail-title"
      className="text-white"
    >
      <div className="rounded-lg border border-white/10 bg-[#0b1728] shadow-[0_24px_80px_rgb(0_0_0_/_0.22)]">
        <div className="flex flex-col gap-4 border-b border-white/10 p-4 md:flex-row md:items-start md:justify-between md:p-5">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-ember-100">
              Incident detail
            </p>
            <h2
              id="incident-detail-title"
              className="mt-2 text-2xl font-black tracking-tight text-white md:text-4xl"
            >
              {getZoneShortName(detail)}
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
              แผงนี้สรุปจากรายงานใน alert zone ที่เลือกเท่านั้น เพื่อช่วยอ่านหลักฐานและลำดับความสำคัญก่อนตรวจสอบภาคสนาม
            </p>
          </div>
          <button
            className="hover-lift inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-white/10 bg-white/[0.06] px-3 py-2 text-sm font-black text-white hover:bg-white/[0.1] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ember-300"
            type="button"
            onClick={onClearAlertZone}
          >
            <X aria-hidden="true" size={16} />
            ปิดรายละเอียด
          </button>
        </div>

        <div className="grid gap-5 p-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(320px,0.55fr)] lg:p-5">
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                  Risk
                </p>
                <span
                  className={`mt-3 inline-flex rounded-full border px-3 py-1 text-xs font-black ${riskToneClassNames[zone.riskLevel]}`}
                >
                  {zone.riskLevel}
                </span>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                  Reports
                </p>
                <p className="mt-2 text-2xl font-black text-white">{zone.reportCount}</p>
                <p className="mt-1 text-xs text-slate-400">
                  ยืนยันแล้ว {zone.verifiedReportCount} รายงาน
                </p>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                  Severity
                </p>
                <p className="mt-2 text-2xl font-black text-white">{zone.maxSeverity}</p>
                <p className="mt-1 text-xs text-slate-400">
                  เฉลี่ย {zone.averageSeverity}
                </p>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                  Latest
                </p>
                <p className="mt-2 text-lg font-black text-white">
                  {formatZoneAge(zone.latestReportAgeMinutes)}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  {formatCoordinate(zone.centerLat)}, {formatCoordinate(zone.centerLng)}
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
              <div className="flex items-center gap-2 text-sm font-black text-ember-100">
                <AlertTriangle aria-hidden="true" size={17} />
                เหตุผลที่ zone นี้สำคัญ
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {zone.riskFactors.map((factor) => (
                  <span
                    key={factor}
                    className="rounded-full border border-white/10 bg-[#07111f] px-3 py-1.5 text-sm font-semibold text-slate-300"
                  >
                    {factor}
                  </span>
                ))}
              </div>
              {detail.missingReportIds.length > 0 ? (
                <p className="mt-4 text-sm leading-6 text-slate-400">
                  มี {detail.missingReportIds.length} รายงานใน zone ที่ยังไม่พบในชุดข้อมูลฝั่ง client ตอนนี้ อาจเกิดจากข้อมูล realtime กำลังอัปเดต
                </p>
              ) : null}
            </div>
          </div>

          <div className="space-y-5">
            <RecommendationBlock recommendation={detail.recommendation} />
            <EmergencyHandoffPanel summary={handoffSummary} tone="dark" />
          </div>
        </div>

        <div className="border-t border-white/10 p-4 lg:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="flex items-center gap-2 text-sm font-black text-ember-100">
                <Clock3 aria-hidden="true" size={17} />
                Evidence timeline
              </p>
              <p className="mt-1 text-sm text-slate-400">
                เรียงตามเวลาที่รายงานเข้ามา โดยใช้เฉพาะรายงานที่พบใน zone นี้
              </p>
            </div>
            <p className="flex items-center gap-2 text-sm font-bold text-slate-400">
              <MapPinned aria-hidden="true" size={16} />
              {detail.reports.length} evidence items
            </p>
          </div>

          {detail.timeline.length > 0 ? (
            <ol className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {detail.timeline.map((event) => (
                <TimelineEventItem key={event.id} event={event} />
              ))}
            </ol>
          ) : (
            <div className="rounded-lg border border-dashed border-white/15 bg-white/[0.03] p-6 text-center">
              <p className="font-black text-white">ยังไม่มีหลักฐานที่แสดงเป็น timeline ได้</p>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                zone นี้มีรหัสรายงาน แต่ข้อมูลรายงานยังไม่อยู่ในชุดข้อมูลฝั่ง client ตอนนี้
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
