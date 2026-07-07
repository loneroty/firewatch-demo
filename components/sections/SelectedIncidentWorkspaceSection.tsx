import { ClipboardList, MapPinned, PhoneCall, Wind } from "lucide-react";
import { EmergencyHandoffPanel } from "@/components/ui/EmergencyHandoffPanel";
import { EmptyState } from "@/components/ui/EmptyState";
import { ButtonLink } from "@/components/ui/Button";
import { IncidentCommandBriefPanel } from "@/components/ui/IncidentCommandBriefPanel";
import { IncidentDetailPanel } from "@/components/sections/IncidentDetailPanel";
import { SmokeSimulationPanel } from "@/components/sections/SmokeSimulationPanel";
import type { EmergencyHandoffSummary } from "@/lib/emergencyHandoff";
import type { IncidentBrief } from "@/lib/incidentBrief";
import type { IncidentDetail } from "@/lib/incidentDetail";
import type { AlertZone } from "@/lib/incidentIntelligence";
import type {
  SmokePlume,
  SmokePlumeOptions,
  WindSpeedLevel
} from "@/lib/smokePlume";

interface SelectedIncidentWorkspaceSectionProps {
  brief: IncidentBrief | null;
  detail: IncidentDetail | null;
  onClearAlertZone: () => void;
  onEnabledChange: (enabled: boolean) => void;
  onWindDirectionChange: (degrees: number) => void;
  onWindSpeedLevelChange: (level: WindSpeedLevel) => void;
  plume: SmokePlume | null;
  reportHandoffSummary: EmergencyHandoffSummary | null;
  selectedZone: AlertZone | null;
  settings: SmokePlumeOptions;
}

const workflowSteps = [
  "เลือกพื้นที่เสี่ยง",
  "อ่านหลักฐาน",
  "จำลองแนวควัน",
  "ส่งต่อข้อมูล"
];

export function SelectedIncidentWorkspaceSection({
  brief,
  detail,
  onClearAlertZone,
  onEnabledChange,
  onWindDirectionChange,
  onWindSpeedLevelChange,
  plume,
  reportHandoffSummary,
  selectedZone,
  settings
}: SelectedIncidentWorkspaceSectionProps) {
  const hasSelection = Boolean(detail || reportHandoffSummary || brief);

  return (
    <section
      id="handoff"
      className="incident-brief-section scroll-mt-28 bg-[#07111f] px-4 py-14 text-white md:py-20"
    >
      <div className="selected-workspace-shell mx-auto max-w-[1440px]">
        <div
          className="mb-6 grid gap-4 lg:grid-cols-[minmax(0,0.8fr)_minmax(320px,0.45fr)] lg:items-end"
          data-print-hidden="true"
        >
          <div>
            <p className="mb-3 text-xs font-black uppercase tracking-[0.22em] text-ember-100">
              Selected incident workspace
            </p>
            <h2 className="max-w-4xl text-3xl font-black tracking-tight md:text-5xl">
              อ่านหลักฐาน จำลองแนวควัน และเตรียมข้อมูลส่งต่อในที่เดียว
            </h2>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300 md:text-base">
              เลือก alert zone หรือรายงานจากแผนที่/รายการ แล้ว workspace นี้จะจัดข้อมูลภาคสนามให้เป็นลำดับงานที่ใช้ demo และใช้สื่อสารต่อได้ง่ายขึ้น
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 rounded-lg border border-white/10 bg-white/[0.04] p-3 text-xs text-slate-300 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
            {workflowSteps.map((step, index) => (
              <div key={step} className="rounded-md border border-white/10 bg-[#07111f] p-3">
                <p className="font-mono font-black text-ember-300">0{index + 1}</p>
                <p className="mt-1 font-bold text-white">{step}</p>
              </div>
            ))}
          </div>
        </div>

        {!hasSelection ? (
          <EmptyState
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <ButtonLink href="#live-map" size="sm" tone="dark">
                  <MapPinned aria-hidden="true" size={15} />
                  ไปที่แผนที่
                </ButtonLink>
                <ButtonLink href="#report" size="sm" tone="primary">
                  แจ้งเหตุใหม่
                </ButtonLink>
              </div>
            }
            body="เลือกพื้นที่เสี่ยงจาก Priority board, คลิกวง alert zone บนแผนที่ หรือเลือกรายงานล่าสุดเพื่อดูรายละเอียดภาคสนาม"
            icon={ClipboardList}
            title="เลือกพื้นที่เสี่ยงหรือรายงานเพื่อดูรายละเอียด"
            tone="dark"
          />
        ) : (
          <div className="grid gap-5 xl:grid-cols-[minmax(0,0.98fr)_minmax(360px,0.56fr)]">
            <div className="space-y-5" data-print-hidden="true">
              {detail ? (
                <IncidentDetailPanel
                  detail={detail}
                  onClearAlertZone={onClearAlertZone}
                />
              ) : null}

              {!detail && reportHandoffSummary ? (
                <EmergencyHandoffPanel summary={reportHandoffSummary} tone="dark" />
              ) : null}

              {selectedZone ? (
                <SmokeSimulationPanel
                  plume={plume}
                  selectedZone={selectedZone}
                  settings={settings}
                  onEnabledChange={onEnabledChange}
                  onWindDirectionChange={onWindDirectionChange}
                  onWindSpeedLevelChange={onWindSpeedLevelChange}
                />
              ) : (
                <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
                  <p className="flex items-center gap-2 text-sm font-black text-ember-100">
                    <Wind aria-hidden="true" size={16} />
                    Smoke simulation
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-300">
                    เลือก alert zone เพื่อเปิดตัวควบคุมจำลองแนวควัน ส่วนรายงานเดี่ยวจะแสดง handoff และ brief โดยไม่สร้าง plume
                  </p>
                </div>
              )}
            </div>

            <div className="incident-brief-host">
              {brief ? (
                <IncidentCommandBriefPanel brief={brief} embedded />
              ) : (
                <EmptyState
                  body="เมื่อเลือก report หรือ alert zone ระบบจะสร้าง brief สำหรับคัดลอก แชร์ พิมพ์ หรือใช้ประกอบการโทร 199"
                  icon={PhoneCall}
                  title="ยังไม่มี brief สำหรับส่งต่อ"
                  tone="dark"
                />
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
