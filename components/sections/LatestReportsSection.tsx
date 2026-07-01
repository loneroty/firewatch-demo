import type { ReactNode } from "react";
import { ListFilter } from "lucide-react";

interface LatestReportsSectionProps {
  hiddenCount: number;
  filters: ReactNode;
  children: ReactNode;
}

export function LatestReportsSection({
  hiddenCount,
  filters,
  children
}: LatestReportsSectionProps) {
  return (
    <section id="latest-reports" className="scroll-mt-28 bg-[#f8f5ee] px-4 py-16 md:py-20">
      <div className="mx-auto max-w-[1440px]">
        <div className="grid gap-6 lg:grid-cols-[minmax(300px,420px)_minmax(0,1fr)]">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <p className="mb-3 text-xs font-black uppercase tracking-[0.22em] text-ember-700">
              Incident log
            </p>
            <h2 className="text-3xl font-black tracking-tight text-smoke-950 md:text-5xl">
              รายงานล่าสุดจากพื้นที่
            </h2>
            <p className="mt-5 text-base leading-7 text-smoke-600">
              รายการนี้ใช้ข้อมูลชุดเดียวกับแผนที่ กดเลือกรายงานเพื่อเลื่อนแผนที่ไปตำแหน่งนั้น
              และยืนยันได้เมื่อมีรายงานของตัวเองอยู่ใกล้ตามเงื่อนไข
            </p>
            {hiddenCount > 0 ? (
              <p className="mt-4 inline-flex rounded-md border border-smoke-200 bg-white px-3 py-2 text-sm font-bold text-smoke-600">
                ซ่อนจากรายการ {hiddenCount} รายงาน
              </p>
            ) : null}
          </div>

          <div className="overflow-hidden rounded-lg border border-smoke-200 bg-white shadow-[0_24px_70px_rgb(15_23_42_/_0.12)]">
            <div className="border-b border-smoke-200 bg-white p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-black text-smoke-950">
                <ListFilter aria-hidden="true" size={18} />
                ตัวกรองสถานะ
              </div>
              {filters}
            </div>
            <div className="max-h-[760px] overflow-y-auto">{children}</div>
          </div>
        </div>
      </div>
    </section>
  );
}
