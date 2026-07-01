import type { ReactNode } from "react";
import { MapPinned } from "lucide-react";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { StatusLegend } from "@/components/ui/StatusLegend";

interface LiveMapSectionProps {
  children: ReactNode;
}

export function LiveMapSection({ children }: LiveMapSectionProps) {
  return (
    <section id="live-map" className="bg-white px-4 py-12">
      <div className="mx-auto max-w-[1440px]">
        <SectionHeader
          eyebrow="Live map"
          title="แผนที่สดสำหรับเฝ้าระวัง"
          description="จุดรายงานถูกจัดกลุ่มบนแผนที่และใช้สัญลักษณ์ต่างกันตามสถานะ เพื่อช่วยสแกนสถานการณ์ได้เร็วบนจอใหญ่และมือถือ"
          action={
            <span className="inline-flex items-center gap-2 rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white">
              <MapPinned aria-hidden="true" size={16} />
              Realtime reports
            </span>
          }
        />
        <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="h-[460px] overflow-hidden rounded-lg border border-smoke-200 bg-white shadow-panel md:h-[560px] lg:h-[680px]">
            {children}
          </div>
          <aside className="space-y-4">
            <StatusLegend />
            <div className="rounded-lg border border-smoke-200 bg-smoke-50 p-4">
              <h3 className="font-semibold text-smoke-950">อ่านแผนที่อย่างไร</h3>
              <p className="mt-2 text-sm leading-6 text-smoke-600">
                หมุดสีส้มคือรายงานที่ยังรอหลักฐานใกล้เคียง หมุดสีเขียวคือรายงานที่ยืนยันแล้ว และหมุดสีเทาคือรายงานที่ถูกปฏิเสธหรือไม่ควรใช้ประกอบการตัดสินใจ
              </p>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
