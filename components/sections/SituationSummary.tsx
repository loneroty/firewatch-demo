import { AlertTriangle, CheckCircle2, Clock3, RadioTower } from "lucide-react";
import { MetricCard } from "@/components/ui/MetricCard";
import { SectionHeader } from "@/components/ui/SectionHeader";

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
  return (
    <section className="bg-smoke-50 px-4 py-12">
      <div className="mx-auto max-w-[1440px]">
        <SectionHeader
          eyebrow="Situation summary"
          title="ภาพรวมสถานการณ์"
          description="ตัวเลขหลักสำหรับประเมินความเคลื่อนไหวของรายงานในพื้นที่ ทั้งรายงานใหม่ รายงานที่รอหลักฐาน และจุดที่ผ่านการยืนยันแล้ว"
        />
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label="รายงานทั้งหมด"
            value={totalReports}
            detail="รายงานที่มองเห็นได้ในระบบปัจจุบัน"
            icon={RadioTower}
            tone="neutral"
          />
          <MetricCard
            label="รอการยืนยัน"
            value={pendingCount}
            detail="รอรายงานใกล้เคียงช่วยยืนยัน"
            icon={AlertTriangle}
            tone="alert"
          />
          <MetricCard
            label="ยืนยันแล้ว"
            value={confirmedCount}
            detail="ผ่านเงื่อนไขยืนยันจากรายงานใกล้เคียง"
            icon={CheckCircle2}
            tone="verified"
          />
          <MetricCard
            label="ชั่วโมงล่าสุด"
            value={recentReportsCount}
            detail="รายงานที่เกิดขึ้นใน 60 นาทีที่ผ่านมา"
            icon={Clock3}
            tone="info"
          />
        </div>
      </div>
    </section>
  );
}
