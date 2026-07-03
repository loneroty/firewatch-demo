import { AlertTriangle, Crosshair, RadioTower } from "lucide-react";
import { Reveal } from "@/components/ui/Reveal";
import type { AlertZone, RiskLevel } from "@/lib/incidentIntelligence";
import { formatZoneAge } from "@/lib/incidentIntelligence";

interface IncidentIntelligenceSectionProps {
  zones: readonly AlertZone[];
}

const riskToneClassNames: Record<RiskLevel, string> = {
  "เฝ้าระวัง": "border-sky-200 bg-sky-50 text-sky-700",
  "น่ากังวล": "border-ember-200 bg-ember-50 text-ember-700",
  "ควรตรวจสอบเร่งด่วน": "border-red-200 bg-red-50 text-red-700"
};

function formatCoordinate(value: number): string {
  return value.toFixed(4);
}

export function IncidentIntelligenceSection({
  zones
}: IncidentIntelligenceSectionProps) {
  const priorityZones = zones.slice(0, 3);

  return (
    <section className="bg-[#07111f] px-4 pb-16 text-white md:pb-20">
      <div className="mx-auto max-w-[1440px]">
        <div className="grid gap-6 lg:grid-cols-[minmax(300px,420px)_minmax(0,1fr)]">
          <Reveal>
            <p className="mb-3 text-xs font-black uppercase tracking-[0.22em] text-ember-100">
              Incident intelligence
            </p>
            <h2 className="text-3xl font-black tracking-tight md:text-5xl">
              พื้นที่ที่ควรตรวจสอบก่อน
            </h2>
            <p className="mt-5 text-base leading-7 text-slate-300">
              ระบบนี้ไม่ได้สร้างข้อมูลใหม่ใน backend แต่สรุปจากรายงานที่มีอยู่แล้ว:
              จุดใกล้กันในระยะ 500 เมตร ความรุนแรง สถานะยืนยัน และความสดของรายงาน
            </p>
            <div className="mt-6 grid grid-cols-2 gap-3 border-y border-white/10 py-4 text-sm">
              <div>
                <p className="font-black text-white">{zones.length}</p>
                <p className="mt-1 text-slate-400">alert zones ที่ตรวจพบ</p>
              </div>
              <div>
                <p className="font-black text-white">{priorityZones.length}</p>
                <p className="mt-1 text-slate-400">พื้นที่แนะนำบน panel นี้</p>
              </div>
            </div>
          </Reveal>

          <Reveal delayMs={120}>
            <div className="overflow-hidden rounded-lg border border-white/10 bg-white/[0.04] shadow-[0_24px_70px_rgb(0_0_0_/_0.24)]">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 p-4">
                <div className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.18em] text-slate-300">
                  <RadioTower aria-hidden="true" size={17} />
                  Priority board
                </div>
                <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs font-bold text-slate-300">
                  client-side derived
                </span>
              </div>

              {priorityZones.length > 0 ? (
                <div className="divide-y divide-white/10">
                  {priorityZones.map((zone, index) => (
                    <article
                      key={zone.id}
                      className="group grid gap-4 p-4 transition-colors duration-200 hover:bg-white/[0.04] md:grid-cols-[76px_1fr]"
                    >
                      <div className="flex items-start gap-3 md:block">
                        <span className="grid h-12 w-12 place-items-center rounded-md border border-white/10 bg-[#07111f] font-mono text-sm font-black text-ember-200">
                          0{index + 1}
                        </span>
                        <span className="mt-2 hidden h-px w-full bg-white/10 md:block" />
                      </div>

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                              {zone.primaryAddressLabel}
                            </p>
                            <h3 className="mt-2 text-xl font-black leading-tight text-white">
                              Zone {zone.reportIds[0]?.slice(-6) ?? index + 1}
                            </h3>
                          </div>
                          <span
                            className={`rounded-full border px-3 py-1 text-xs font-black ${riskToneClassNames[zone.riskLevel]}`}
                          >
                            {zone.riskLevel}
                          </span>
                        </div>

                        <div className="mt-4 grid gap-3 text-sm text-slate-300 sm:grid-cols-2 lg:grid-cols-4">
                          <div className="border-l border-white/10 pl-3">
                            <p className="text-xs text-slate-500">รายงาน</p>
                            <p className="mt-1 font-black text-white">{zone.reportCount}</p>
                          </div>
                          <div className="border-l border-white/10 pl-3">
                            <p className="text-xs text-slate-500">Severity</p>
                            <p className="mt-1 font-black text-white">
                              สูงสุด {zone.maxSeverity} / เฉลี่ย {zone.averageSeverity}
                            </p>
                          </div>
                          <div className="border-l border-white/10 pl-3">
                            <p className="text-xs text-slate-500">ล่าสุด</p>
                            <p className="mt-1 font-black text-white">
                              {formatZoneAge(zone.latestReportAgeMinutes)}
                            </p>
                          </div>
                          <div className="border-l border-white/10 pl-3">
                            <p className="text-xs text-slate-500">พิกัดกลาง</p>
                            <p className="mt-1 font-black text-white">
                              {formatCoordinate(zone.centerLat)}, {formatCoordinate(zone.centerLng)}
                            </p>
                          </div>
                        </div>

                        <div className="mt-4 rounded-md border border-white/10 bg-[#07111f]/70 p-3">
                          <p className="flex items-center gap-2 text-sm font-black text-ember-100">
                            <AlertTriangle aria-hidden="true" size={16} />
                            เหตุผลที่ควรดู
                          </p>
                          <p className="mt-2 text-sm leading-6 text-slate-300">
                            {zone.riskFactors.join(" · ")}
                          </p>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="grid min-h-56 place-items-center p-6 text-center">
                  <div>
                    <span className="mx-auto grid h-12 w-12 place-items-center rounded-md border border-white/10 bg-white/[0.04] text-ember-200">
                      <Crosshair aria-hidden="true" size={22} />
                    </span>
                    <p className="mt-4 text-lg font-black text-white">
                      ยังไม่มี alert zone ที่ต้องจัดลำดับ
                    </p>
                    <p className="mt-2 max-w-md text-sm leading-6 text-slate-300">
                      เมื่อมีรายงานที่มองเห็นได้ ระบบจะจัดกลุ่มพื้นที่ใกล้กันและคำนวณความเสี่ยงอัตโนมัติบนเครื่องผู้ใช้
                    </p>
                  </div>
                </div>
              )}
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
