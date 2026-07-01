import type { ReactNode } from "react";
import { ListFilter } from "lucide-react";
import { SectionHeader } from "@/components/ui/SectionHeader";

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
    <section id="latest-reports" className="bg-smoke-50 px-4 py-12">
      <div className="mx-auto max-w-[1440px]">
        <SectionHeader
          eyebrow="Latest reports"
          title="รายงานล่าสุดจากพื้นที่"
          description="รายการนี้ใช้ข้อมูลชุดเดียวกับแผนที่ กดเลือกรายงานเพื่อเลื่อนแผนที่ไปยังตำแหน่ง และกดยืนยันได้เมื่อมีรายงานของตัวเองอยู่ใกล้ตามเงื่อนไข"
          action={
            hiddenCount > 0 ? (
              <span className="rounded-md border border-smoke-200 bg-white px-3 py-2 text-sm font-semibold text-smoke-600">
                ซ่อน {hiddenCount}
              </span>
            ) : null
          }
        />
        <div className="mt-6 rounded-lg border border-smoke-200 bg-white shadow-panel">
          <div className="border-b border-smoke-200 p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-smoke-950">
              <ListFilter aria-hidden="true" size={18} />
              ตัวกรองสถานะ
            </div>
            {filters}
          </div>
          <div className="max-h-[720px] overflow-y-auto">{children}</div>
        </div>
      </div>
    </section>
  );
}
