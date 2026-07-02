import { Reveal } from "@/components/ui/Reveal";

interface SituationSummaryProps {
  totalReports: number;
  pendingCount: number;
  confirmedCount: number;
  recentReportsCount: number;
}

export function SituationSummary({
  totalReports,
  pendingCount,
  confirmedCount,
  recentReportsCount
}: SituationSummaryProps) {
  const verifiedPercent =
    totalReports > 0 ? Math.round((confirmedCount / totalReports) * 100) : 0;
  const watchCopy =
    pendingCount > 0
      ? "มีจุดที่ยังรอหลักฐานใกล้เคียง ควรดูตำแหน่งบนแผนที่สด"
      : "ยังไม่มีจุดค้างยืนยันในชุดข้อมูลปัจจุบัน";

  return (
    <section className="bg-[#07111f] px-4 pb-14">
      <div className="mx-auto max-w-[1440px]">
        <Reveal className="grid overflow-hidden rounded-lg border border-white/10 bg-[#f8f5ee] text-smoke-950 shadow-[0_24px_70px_rgb(0_0_0_/_0.28)] lg:grid-cols-[minmax(0,0.95fr)_minmax(420px,1.05fr)]">
          <div className="border-b border-smoke-200 p-5 md:p-7 lg:border-b-0 lg:border-r">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-ember-700">
              Situation board
            </p>
            <div className="mt-8 flex items-end gap-4">
              <span className="text-7xl font-black leading-none tracking-tight md:text-8xl">
                {pendingCount}
              </span>
              <div className="pb-2">
                <p className="text-xl font-black leading-tight md:text-2xl">
                  รายงานที่ต้องติดตาม
                </p>
                <p className="mt-2 max-w-md text-sm leading-6 text-smoke-600">
                  {watchCopy}
                </p>
              </div>
            </div>
            <div className="mt-8 h-2 overflow-hidden rounded-full bg-smoke-200">
              <div
                className="h-full rounded-full bg-canopy-700 transition-[width] duration-700 ease-out"
                style={{ width: `${verifiedPercent}%` }}
              />
            </div>
            <p className="mt-3 text-sm text-smoke-600">
              {verifiedPercent}% ของรายงานที่มองเห็นได้ผ่านการยืนยันแล้ว
            </p>
          </div>

          <div className="grid divide-y divide-smoke-200 md:grid-cols-3 md:divide-x md:divide-y-0">
            <div className="p-5 transition-colors duration-200 hover:bg-white/55 md:p-6">
              <p className="text-sm font-bold text-smoke-600">รายงานทั้งหมด</p>
              <p className="mt-4 text-4xl font-black tracking-tight">{totalReports}</p>
              <p className="mt-3 text-sm leading-6 text-smoke-600">
                จุดที่แสดงในระบบตอนนี้ รวมทั้งรอยืนยันและยืนยันแล้ว
              </p>
            </div>
            <div className="p-5 transition-colors duration-200 hover:bg-canopy-50/55 md:p-6">
              <p className="text-sm font-bold text-smoke-600">ยืนยันแล้ว</p>
              <p className="mt-4 text-4xl font-black tracking-tight text-canopy-700">
                {confirmedCount}
              </p>
              <p className="mt-3 text-sm leading-6 text-smoke-600">
                ผ่านเงื่อนไขรายงานใกล้เคียงในระยะ 500 เมตร / 60 นาที
              </p>
            </div>
            <div className="p-5 transition-colors duration-200 hover:bg-sky-50/70 md:p-6">
              <p className="text-sm font-bold text-smoke-600">ชั่วโมงล่าสุด</p>
              <p className="mt-4 text-4xl font-black tracking-tight text-sky-700">
                {recentReportsCount}
              </p>
              <p className="mt-3 text-sm leading-6 text-smoke-600">
                รายงานใหม่ที่ช่วยบอกทิศทางสถานการณ์ล่าสุดในพื้นที่
              </p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
