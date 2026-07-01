import type { ReactNode } from "react";
import { AlertTriangle, Send } from "lucide-react";
import { SectionHeader } from "@/components/ui/SectionHeader";

interface ReportFormSectionProps {
  systemMessage: string | null;
  children: ReactNode;
}

export function ReportFormSection({ systemMessage, children }: ReportFormSectionProps) {
  return (
    <section id="report" className="bg-slate-950 px-4 py-12 text-white">
      <div className="mx-auto grid max-w-[1440px] gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(360px,520px)] lg:items-start">
        <div>
          <SectionHeader
            eyebrow="Report station"
            title="แจ้งเหตุพร้อมพิกัดและหลักฐาน"
            description="ฟอร์มนี้ใช้ flow เดิมทั้งหมด: local demo จะบันทึกในเครื่อง ส่วน Firebase backend mode จะอัปโหลดรูปไป Storage แล้วเรียก Cloud Function เพื่อสร้างรายงาน"
            inverse
            action={
              <span className="inline-flex items-center gap-2 rounded-md bg-ember-600 px-3 py-2 text-sm font-semibold text-white">
                <Send aria-hidden="true" size={16} />
                Create report
              </span>
            }
          />
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <div className="border-l border-white/10 pl-4">
              <p className="text-sm font-semibold text-white">รูปถ่าย</p>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                บีบอัดก่อนส่งเพื่อลดขนาด payload
              </p>
            </div>
            <div className="border-l border-white/10 pl-4">
              <p className="text-sm font-semibold text-white">พิกัด</p>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                ใช้ GPS หรือกรอก lat/lng เองได้
              </p>
            </div>
            <div className="border-l border-white/10 pl-4">
              <p className="text-sm font-semibold text-white">ตรวจสอบ</p>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                server ตรวจ payload และ rate limit ใน backend mode
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-white/10 bg-white p-4 text-smoke-950 shadow-panel">
          {systemMessage ? (
            <div className="mb-4 flex items-start gap-3 rounded-lg border border-ember-100 bg-ember-50 p-3 text-sm text-ember-700">
              <AlertTriangle aria-hidden="true" className="mt-0.5 shrink-0" size={18} />
              <span>{systemMessage}</span>
            </div>
          ) : null}
          {children}
        </div>
      </div>
    </section>
  );
}
