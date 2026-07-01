import { ArrowRight, Flame, MapPinned, RadioTower } from "lucide-react";

interface HeroSectionProps {
  totalReports: number;
  confirmedCount: number;
  pendingCount: number;
  isBackendMode: boolean;
}

export function HeroSection({
  totalReports,
  confirmedCount,
  pendingCount,
  isBackendMode
}: HeroSectionProps) {
  const modeLabel = isBackendMode ? "Shared backend live" : "Local desk demo";
  const modeDescription = isBackendMode
    ? "รายงานถูกส่งผ่าน Storage + Cloud Functions และแชร์ขึ้น Firestore realtime"
    : "ทดสอบครบ flow บนเครื่องเดียวด้วย localStorage โดยไม่ต้องมี Firebase config";

  return (
    <section
      id="top"
      className="field-grid overflow-hidden bg-[#07111f] px-4 py-12 text-white md:py-14"
    >
      <div className="mx-auto grid max-w-[1440px] gap-8 lg:grid-cols-[minmax(0,1fr)_480px] lg:items-center">
        <div className="max-w-5xl">
          <div className="mb-6 flex flex-wrap items-center gap-3 text-xs font-bold uppercase tracking-[0.18em] text-ember-100">
            <span className="h-px w-10 bg-ember-500" aria-hidden="true" />
            FireWatch field operations
          </div>
          <h1 className="max-w-4xl text-4xl font-black leading-[1.05] tracking-tight md:text-5xl lg:text-6xl">
            เห็นควันเร็วขึ้น
            <span className="block text-slate-300">ก่อนจุดเล็กกลายเป็นวิกฤต</span>
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-7 text-slate-300 md:text-xl md:leading-8">
            FireWatch รวมรายงานควัน ไฟป่า และจุดเผาจากประชาชน พร้อมรูปถ่าย
            พิกัด และการยืนยันจากรายงานใกล้เคียง
            เพื่อให้คนในพื้นที่เห็นสถานการณ์เดียวกันแบบทันเวลา
          </p>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <a
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-ember-600 px-5 py-3 text-sm font-bold text-white shadow-[0_18px_40px_rgb(234_88_12_/_0.28)] transition hover:bg-ember-700"
              href="#report"
            >
              แจ้งเหตุ
              <ArrowRight aria-hidden="true" size={18} />
            </a>
            <a
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-white/15 bg-white/[0.06] px-5 py-3 text-sm font-bold text-white transition hover:bg-white/10"
              href="#live-map"
            >
              ดูแผนที่สด
              <MapPinned aria-hidden="true" size={18} />
            </a>
          </div>

          <div className="mt-8 grid grid-cols-3 gap-2 border-y border-white/10 py-3 text-slate-300">
            <div>
              <p className="text-xs font-bold leading-5 text-white sm:text-sm">หลักฐานภาคสนาม</p>
              <p className="mt-1 hidden text-sm leading-6 sm:block">รูปถ่าย + พิกัดจากมือถือ</p>
            </div>
            <div>
              <p className="text-xs font-bold leading-5 text-white sm:text-sm">ยืนยัน 500m / 60 นาที</p>
              <p className="mt-1 hidden text-sm leading-6 sm:block">ต้องมีรายงานใกล้เคียงช่วยยืนยัน</p>
            </div>
            <div>
              <p className="text-xs font-bold leading-5 text-white sm:text-sm">คุม abuse ฝั่ง server</p>
              <p className="mt-1 hidden text-sm leading-6 sm:block">rate limit, rules, App Check</p>
            </div>
          </div>
        </div>

        <div className="relative hidden overflow-hidden rounded-lg border border-white/10 bg-[#0a1627] shadow-[0_30px_90px_rgb(0_0_0_/_0.35)] md:block">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgb(249_115_22_/_0.18),transparent_28%),linear-gradient(135deg,rgb(255_255_255_/_0.08)_1px,transparent_1px)] bg-[length:auto,28px_28px]" />
          <div className="relative border-b border-white/10 p-4">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                  Incident desk
                </p>
                <p className="mt-1 text-xl font-bold">{modeLabel}</p>
              </div>
              <span className="grid h-11 w-11 place-items-center rounded-md border border-ember-100/20 bg-ember-600 text-white">
                <Flame aria-hidden="true" size={22} />
              </span>
            </div>
            <p className="text-sm leading-6 text-slate-300">{modeDescription}</p>
          </div>

          <div className="relative p-4">
            <div className="grid grid-cols-3 border border-white/10 bg-slate-950/35">
              <div className="p-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">
                  Reports
                </p>
                <p className="mt-3 text-3xl font-black">{totalReports}</p>
              </div>
              <div className="border-l border-white/10 p-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">
                  Verified
                </p>
                <p className="mt-3 text-3xl font-black text-canopy-500">
                  {confirmedCount}
                </p>
              </div>
              <div className="border-l border-white/10 p-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">
                  Pending
                </p>
                <p className="mt-3 text-3xl font-black text-ember-500">
                  {pendingCount}
                </p>
              </div>
            </div>

            <div className="mt-4 overflow-hidden rounded-md border border-white/10 bg-slate-950/55 p-4">
              <div className="mb-4 flex items-center justify-between text-xs text-slate-400">
                <span className="inline-flex items-center gap-2">
                  <RadioTower aria-hidden="true" size={15} />
                  Live watch area
                </span>
                <span>CM / North grid</span>
              </div>
              <div className="relative h-44 overflow-hidden rounded-sm border border-white/10 bg-[linear-gradient(90deg,rgb(148_163_184_/_0.14)_1px,transparent_1px),linear-gradient(0deg,rgb(148_163_184_/_0.14)_1px,transparent_1px)] bg-[length:34px_34px]">
                <span className="absolute left-[16%] top-[22%] h-3 w-3 rounded-full bg-ember-500 shadow-[0_0_0_8px_rgb(249_115_22_/_0.12)]" />
                <span className="absolute left-[52%] top-[46%] h-3 w-3 rounded-full bg-canopy-500 shadow-[0_0_0_8px_rgb(16_185_129_/_0.12)]" />
                <span className="absolute left-[72%] top-[28%] h-2.5 w-2.5 rounded-full bg-sky-400 shadow-[0_0_0_7px_rgb(56_189_248_/_0.12)]" />
                <span className="absolute bottom-5 left-5 right-5 border-t border-dashed border-ember-500/50" />
                <div className="absolute bottom-3 left-3 right-3 rounded-sm border border-white/10 bg-[#07111f]/85 px-3 py-2 text-xs text-slate-300 sm:right-auto">
                  จุดสีส้มรอหลักฐานใกล้เคียง · สีเขียวยืนยันแล้ว
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
