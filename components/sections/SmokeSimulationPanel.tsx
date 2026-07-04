import { Compass, Info, Wind } from "lucide-react";
import type { AlertZone } from "@/lib/incidentIntelligence";
import {
  SMOKE_PLUME_DISCLAIMER,
  getWindDirectionLabel,
  type SmokePlume,
  type SmokePlumeOptions,
  type WindSpeedLevel
} from "@/lib/smokePlume";

interface SmokeSimulationPanelProps {
  selectedZone: AlertZone | null;
  plume: SmokePlume | null;
  settings: SmokePlumeOptions;
  onEnabledChange: (enabled: boolean) => void;
  onWindDirectionChange: (degrees: number) => void;
  onWindSpeedLevelChange: (level: WindSpeedLevel) => void;
}

const windDirectionOptions = [0, 45, 90, 135, 180, 225, 270, 315] as const;
const windSpeedOptions: readonly WindSpeedLevel[] = ["เบา", "ปานกลาง", "แรง"];

function formatMeters(value: number): string {
  return value >= 1_000 ? `${(value / 1_000).toFixed(1)} km` : `${value} m`;
}

export function SmokeSimulationPanel({
  selectedZone,
  plume,
  settings,
  onEnabledChange,
  onWindDirectionChange,
  onWindSpeedLevelChange
}: SmokeSimulationPanelProps) {
  const isControlDisabled = !selectedZone;

  return (
    <section className="bg-[#07111f] px-4 pb-16 text-white md:pb-20">
      <div className="mx-auto max-w-[1440px] rounded-lg border border-white/10 bg-[#0b1728] p-4 shadow-[0_24px_70px_rgb(0_0_0_/_0.18)] md:p-5">
        <div className="grid gap-5 lg:grid-cols-[minmax(280px,0.45fr)_minmax(0,1fr)] lg:items-start">
          <div>
            <p className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-[0.22em] text-ember-100">
              <Wind aria-hidden="true" size={16} />
              Wind / smoke simulation
            </p>
            <h2 className="text-2xl font-black tracking-tight text-white md:text-3xl">
              จำลองแนวควันจากพื้นที่ที่เลือก
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              เลือกทิศทางที่ควันอาจเคลื่อนไปและระดับลมเพื่อวาด plume บนแผนที่
              โดยไม่บันทึกข้อมูลนี้ลง backend
            </p>
            <p className="mt-4 rounded-md border border-ember-300/20 bg-ember-300/10 p-3 text-sm leading-6 text-ember-50">
              {SMOKE_PLUME_DISCLAIMER}
            </p>
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(280px,0.48fr)]">
            <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-black text-white">เปิดแบบจำลอง plume</p>
                  <p className="mt-1 text-sm text-slate-400">
                    ใช้เฉพาะบนเครื่องผู้ใช้ ไม่กระทบข้อมูลรายงานจริง
                  </p>
                </div>
                <label className="inline-flex cursor-pointer items-center gap-3 self-start rounded-full border border-white/10 bg-[#07111f] px-3 py-2 text-sm font-black text-white sm:self-auto">
                  <input
                    checked={settings.enabled}
                    className="h-4 w-4 accent-ember-500"
                    disabled={isControlDisabled}
                    type="checkbox"
                    onChange={(event) => onEnabledChange(event.target.checked)}
                  />
                  {settings.enabled ? "เปิด" : "ปิด"}
                </label>
              </div>

              <div className="mt-5">
                <p className="mb-2 flex items-center gap-2 text-sm font-black text-slate-200">
                  <Compass aria-hidden="true" size={16} />
                  ทิศทางที่ควันอาจเคลื่อนไป
                </p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {windDirectionOptions.map((degrees) => {
                    const isSelected = settings.windDirectionDegrees === degrees;

                    return (
                      <button
                        key={degrees}
                        className={`min-h-11 rounded-md border px-3 py-2 text-sm font-bold transition duration-200 ${
                          isSelected
                            ? "border-ember-300 bg-ember-300 text-slate-950"
                            : "border-white/10 bg-[#07111f] text-slate-300 hover:border-ember-200/70 hover:text-white"
                        } disabled:cursor-not-allowed disabled:opacity-45`}
                        disabled={isControlDisabled}
                        type="button"
                        onClick={() => onWindDirectionChange(degrees)}
                      >
                        {degrees}° · {getWindDirectionLabel(degrees)}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mt-5">
                <p className="mb-2 text-sm font-black text-slate-200">ระดับลม</p>
                <div className="grid grid-cols-3 gap-2">
                  {windSpeedOptions.map((level) => {
                    const isSelected = settings.windSpeedLevel === level;

                    return (
                      <button
                        key={level}
                        className={`min-h-11 rounded-md border px-3 py-2 text-sm font-bold transition duration-200 ${
                          isSelected
                            ? "border-sky-200 bg-sky-200 text-slate-950"
                            : "border-white/10 bg-[#07111f] text-slate-300 hover:border-sky-200/70 hover:text-white"
                        } disabled:cursor-not-allowed disabled:opacity-45`}
                        disabled={isControlDisabled}
                        type="button"
                        onClick={() => onWindSpeedLevelChange(level)}
                      >
                        {level}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-white/10 bg-[#07111f] p-4">
              <p className="flex items-center gap-2 text-sm font-black text-ember-100">
                <Info aria-hidden="true" size={16} />
                Downwind watch summary
              </p>
              {selectedZone ? (
                <div className="mt-4 space-y-3 text-sm leading-6 text-slate-300">
                  <p>
                    พื้นที่อ้างอิง:{" "}
                    <span className="font-black text-white">
                      {selectedZone.primaryAddressLabel || selectedZone.id}
                    </span>
                  </p>
                  {plume ? (
                    <>
                      <p>{plume.watchSummary}</p>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded-md border border-white/10 bg-white/[0.04] p-3">
                          <p className="text-slate-500">แนวปลายลม</p>
                          <p className="mt-1 font-black text-white">
                            {plume.windDirectionDegrees}° · {plume.windDirectionLabel}
                          </p>
                        </div>
                        <div className="rounded-md border border-white/10 bg-white/[0.04] p-3">
                          <p className="text-slate-500">ระยะ plume</p>
                          <p className="mt-1 font-black text-white">
                            {formatMeters(plume.lengthMeters)} / กว้าง {formatMeters(plume.widthMeters)}
                          </p>
                        </div>
                      </div>
                    </>
                  ) : (
                    <p>เปิดแบบจำลอง plume เพื่อดูแนวปลายลมที่ควรเฝ้าระวังบนแผนที่</p>
                  )}
                </div>
              ) : (
                <p className="mt-4 text-sm leading-6 text-slate-300">
                  เลือกพื้นที่เสี่ยงจาก Priority board หรือวง alert zone บนแผนที่ก่อน
                  เพื่อจำลองแนวควัน
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
