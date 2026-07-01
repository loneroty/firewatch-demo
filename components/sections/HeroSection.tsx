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
  return (
    <section id="top" className="bg-slate-950 px-4 py-12 text-white md:py-16">
      <div className="mx-auto grid max-w-[1440px] gap-10 lg:grid-cols-[minmax(0,1fr)_460px] lg:items-center">
        <div className="max-w-4xl">
          <div className="mb-5 inline-flex items-center gap-2 rounded-md border border-ember-500/30 bg-ember-500/10 px-3 py-2 text-sm font-semibold text-ember-100">
            <RadioTower aria-hidden="true" size={16} />
            ระบบรายงานควัน ไฟป่า และจุดเผาแบบ real-time
          </div>
          <h1 className="text-4xl font-bold leading-tight md:text-6xl">
            FireWatch
            <span className="mt-3 block text-2xl font-semibold text-slate-300 md:text-3xl">
              เฝ้าระวังเหตุควันและไฟจากรายงานของประชาชน
            </span>
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-300">
            รวมพิกัด รูปถ่าย และสถานะยืนยันจากรายงานใกล้เคียง ช่วยให้ชุมชนและผู้ดูแลพื้นที่เห็นสถานการณ์เร็วขึ้นจากข้อมูลภาคสนามจริง
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a
              className="inline-flex items-center justify-center gap-2 rounded-md bg-ember-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-ember-700"
              href="#report"
            >
              แจ้งเหตุทันที
              <ArrowRight aria-hidden="true" size={18} />
            </a>
            <a
              className="inline-flex items-center justify-center gap-2 rounded-md border border-white/15 bg-white/10 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/15"
              href="#live-map"
            >
              ดูแผนที่สด
              <MapPinned aria-hidden="true" size={18} />
            </a>
          </div>
        </div>

        <div className="grid gap-3 rounded-lg border border-white/10 bg-white/5 p-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div>
              <p className="text-sm font-semibold text-slate-300">สถานะระบบ</p>
              <p className="mt-1 text-xl font-bold text-white">
                {isBackendMode ? "Firebase shared backend" : "Local demo mode"}
              </p>
            </div>
            <span className="grid h-12 w-12 place-items-center rounded-lg bg-ember-600 text-white">
              <Flame aria-hidden="true" size={24} />
            </span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="border-l border-white/10 pl-3">
              <p className="text-xs text-slate-400">ทั้งหมด</p>
              <p className="mt-2 text-2xl font-bold">{totalReports}</p>
            </div>
            <div className="border-l border-white/10 pl-3">
              <p className="text-xs text-slate-400">ยืนยันแล้ว</p>
              <p className="mt-2 text-2xl font-bold text-canopy-500">{confirmedCount}</p>
            </div>
            <div className="border-l border-white/10 pl-3">
              <p className="text-xs text-slate-400">รอ</p>
              <p className="mt-2 text-2xl font-bold text-ember-500">{pendingCount}</p>
            </div>
          </div>
          <p className="border-t border-white/10 pt-3 text-sm leading-6 text-slate-300">
            {isBackendMode
              ? "โหมดนี้แชร์ข้อมูลข้ามอุปกรณ์ผ่าน Firestore realtime และส่งรายงานผ่าน Cloud Functions"
              : "โหมดนี้ใช้ localStorage สำหรับสาธิตบนเครื่องเดียว ไม่ต้องใช้ Firebase config"}
          </p>
        </div>
      </div>
    </section>
  );
}
