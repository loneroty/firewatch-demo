import type { ReactNode } from "react";
import { MapPinned } from "lucide-react";
import { Reveal } from "@/components/ui/Reveal";
import { StatusLegend } from "@/components/ui/StatusLegend";

interface LiveMapSectionProps {
  children: ReactNode;
  controls?: ReactNode;
}

export function LiveMapSection({ children, controls }: LiveMapSectionProps) {
  return (
    <section id="live-map" className="relative z-0 isolate scroll-mt-28 bg-[#f8f5ee] px-4 py-16 md:py-20">
      <div className="mx-auto max-w-[1440px]">
        <Reveal className="mb-7 grid gap-5 lg:grid-cols-[minmax(0,0.85fr)_minmax(320px,0.35fr)] lg:items-end">
          <div>
            <p className="mb-3 text-xs font-black uppercase tracking-[0.22em] text-ember-700">
              Operations workspace
            </p>
            <h2 className="max-w-3xl text-3xl font-black tracking-tight text-smoke-950 md:text-5xl">
              ดูสถานการณ์บนแผนที่ก่อนตัดสินใจขั้นต่อไป
            </h2>
          </div>
          <p className="text-base leading-7 text-smoke-600">
            จุดรายงาน alert zone และ plume overlay ใช้ข้อมูลจากรายงานชุดเดียวกัน เลือกหมุดหรือวงพื้นที่เพื่อเปิด workspace ภาคสนามด้านล่าง
          </p>
        </Reveal>

        {controls}

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          <Reveal className="relative z-0 isolate overflow-hidden rounded-lg border border-slate-900/10 bg-[#07111f] p-3 shadow-[0_28px_80px_rgb(15_23_42_/_0.22)]">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3 px-1 text-xs text-slate-300">
              <span className="inline-flex items-center gap-2 font-bold uppercase tracking-[0.18em]">
                <MapPinned aria-hidden="true" size={15} />
                Realtime watch board
              </span>
              <span className="text-slate-500">Markers / heat / zones / plume</span>
            </div>
            <div className="relative z-0 isolate h-[480px] overflow-hidden rounded-md border border-white/10 bg-smoke-100 transition-shadow duration-300 hover:shadow-[0_0_0_1px_rgb(249_115_22_/_0.22)] md:h-[600px] lg:h-[700px]">
              {children}
            </div>
          </Reveal>

          <aside className="grid gap-4 lg:grid-rows-[auto_1fr]">
            <Reveal delayMs={120} className="rounded-lg border border-smoke-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-smoke-500">
                Map legend
              </p>
              <div className="mt-4">
                <StatusLegend />
              </div>
            </Reveal>
            <Reveal delayMs={190} className="rounded-lg border border-smoke-200 bg-white p-5 shadow-sm">
              <p className="text-lg font-black text-smoke-950">อ่านแผนที่ให้เร็ว</p>
              <div className="mt-4 space-y-3 text-sm leading-6 text-smoke-600">
                <p>
                  <span className="font-black text-smoke-950">หมุด</span> คือรายงานเดี่ยว เลือกเพื่อดูรายงานและเตรียม handoff
                </p>
                <p>
                  <span className="font-black text-smoke-950">วงพื้นที่</span> คือ alert zone จากรายงานใกล้กันในระยะ 500 เมตร
                </p>
                <p>
                  <span className="font-black text-smoke-950">แนว plume</span> คือแบบจำลองช่วยประเมินเบื้องต้นเมื่อเลือกพื้นที่เสี่ยง
                </p>
                <p>
                  <span className="font-black text-smoke-950">Heatmap</span> แสดงความหนาแน่นแบบถ่วงน้ำหนักจาก severity และสถานะยืนยัน
                </p>
                <p className="rounded-md border border-smoke-200 bg-smoke-50 p-3 text-xs leading-5">
                  backend mode แชร์ข้อมูลข้ามอุปกรณ์ผ่าน Firestore realtime โดย client ไม่เขียนสถานะยืนยันเอง
                </p>
              </div>
            </Reveal>
          </aside>
        </div>
      </div>
    </section>
  );
}
