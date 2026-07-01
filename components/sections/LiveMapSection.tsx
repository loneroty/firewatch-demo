import type { ReactNode } from "react";
import { MapPinned } from "lucide-react";
import { StatusLegend } from "@/components/ui/StatusLegend";

interface LiveMapSectionProps {
  children: ReactNode;
}

export function LiveMapSection({ children }: LiveMapSectionProps) {
  return (
    <section id="live-map" className="scroll-mt-28 bg-[#f8f5ee] px-4 py-16 md:py-20">
      <div className="mx-auto max-w-[1440px]">
        <div className="mb-7 grid gap-5 lg:grid-cols-[minmax(0,0.85fr)_minmax(320px,0.35fr)] lg:items-end">
          <div>
            <p className="mb-3 text-xs font-black uppercase tracking-[0.22em] text-ember-700">
              Live map
            </p>
            <h2 className="max-w-3xl text-3xl font-black tracking-tight text-smoke-950 md:text-5xl">
              แผนที่คือโต๊ะปฏิบัติการของ FireWatch
            </h2>
          </div>
          <p className="text-base leading-7 text-smoke-600">
            จุดรายงานใช้ข้อมูลชุดเดียวกับรายการล่าสุด เลือกหมุดเพื่อดูตำแหน่ง
            และแยกสถานะด้วยรูปทรง/สีเพื่ออ่านได้เร็วบนจอใหญ่และมือถือ
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="overflow-hidden rounded-lg border border-slate-900/10 bg-[#07111f] p-3 shadow-[0_28px_80px_rgb(15_23_42_/_0.22)]">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3 px-1 text-xs text-slate-300">
              <span className="inline-flex items-center gap-2 font-bold uppercase tracking-[0.18em]">
                <MapPinned aria-hidden="true" size={15} />
                Realtime watch board
              </span>
              <span className="text-slate-500">OpenStreetMap / clustered reports</span>
            </div>
            <div className="h-[480px] overflow-hidden rounded-md border border-white/10 bg-smoke-100 md:h-[600px] lg:h-[700px]">
              {children}
            </div>
          </div>

          <aside className="grid gap-4 lg:grid-rows-[auto_1fr]">
            <div className="rounded-lg border border-smoke-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-smoke-500">
                Map legend
              </p>
              <div className="mt-4">
                <StatusLegend />
              </div>
            </div>
            <div className="rounded-lg border border-smoke-200 bg-white p-5 shadow-sm">
              <p className="text-lg font-black text-smoke-950">อ่านแผนที่แบบทีมภาคสนาม</p>
              <div className="mt-4 space-y-4 text-sm leading-6 text-smoke-600">
                <p>
                  หมุดสีส้มคือจุดที่ต้องการรายงานใกล้เคียงเพิ่ม ส่วนหมุดสีเขียวคือจุดที่มีหลักฐานอีกตำแหน่งช่วยยืนยันแล้ว
                </p>
                <p>
                  ใน backend mode ข้อมูลนี้แชร์ข้ามอุปกรณ์ผ่าน Firestore realtime โดย client ไม่ได้เขียนสถานะยืนยันเอง
                </p>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
