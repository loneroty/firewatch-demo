import type { ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { Reveal } from "@/components/ui/Reveal";

interface ReportFormSectionProps {
  systemMessage: string | null;
  children: ReactNode;
}

const intakeNotes = [
  {
    label: "01",
    title: "เลือกตำแหน่งเหตุ",
    body: "ใช้ GPS เป็นจุดเริ่มต้น แล้วลากหมุดไปยังจุดควัน/ไฟที่เห็นจริง"
  },
  {
    label: "02",
    title: "ระบุประเภท",
    body: "เลือกประเภทและความรุนแรงเพื่อให้แผนที่และ alert zone อ่านง่าย"
  },
  {
    label: "03",
    title: "เพิ่มหลักฐาน",
    body: "แนบรูปและบันทึกสั้น ๆ เพื่อช่วยให้คนอื่นตรวจสอบรายงานได้"
  },
  {
    label: "04",
    title: "ส่งเข้าระบบ",
    body: "local demo บันทึกในเครื่อง ส่วน backend mode จะผ่าน Storage และ callable function"
  }
];

export function ReportFormSection({ systemMessage, children }: ReportFormSectionProps) {
  return (
    <section id="report" className="scroll-mt-28 bg-[#07111f] px-4 py-16 text-white md:py-20">
      <div className="mx-auto grid max-w-[1440px] gap-8 lg:grid-cols-[minmax(0,0.82fr)_minmax(380px,540px)] lg:items-start">
        <Reveal>
          <p className="mb-3 text-xs font-black uppercase tracking-[0.22em] text-ember-100">
            Report intake
          </p>
          <h2 className="max-w-3xl text-3xl font-black tracking-tight md:text-5xl">
            แจ้งเหตุเป็นขั้นตอน ไม่ต้องเดาว่าต้องทำอะไรก่อน
          </h2>
          <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300">
            ฟอร์มนี้เน้นตำแหน่งเหตุเป็นหลัก: ผู้แจ้งไม่จำเป็นต้องยืนตรงจุดไฟ แต่ต้องเลือกหมุดให้ตรงกับจุดควัน/ไฟที่เห็น
          </p>

          <div className="mt-8 divide-y divide-white/10 border-y border-white/10">
            {intakeNotes.map((item) => (
              <div key={item.label} className="grid gap-3 py-5 transition-colors duration-200 hover:bg-white/[0.03] sm:grid-cols-[64px_1fr]">
                <span className="font-mono text-sm font-bold text-ember-500">
                  {item.label}
                </span>
                <div>
                  <p className="font-bold text-white">{item.title}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{item.body}</p>
                </div>
              </div>
            ))}
          </div>
        </Reveal>

        <Reveal delayMs={120} className="rounded-lg border border-white/10 bg-[#f8f5ee] p-3 text-smoke-950 shadow-[0_28px_80px_rgb(0_0_0_/_0.28)] md:p-4">
          <div className="border-b border-smoke-200 px-2 pb-3 md:px-3">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-smoke-500">
              Field report form
            </p>
            <p className="mt-2 text-sm leading-6 text-smoke-600">
              ใส่ข้อมูลเท่าที่จำเป็น ระบบจะตรวจ payload อีกครั้งใน backend mode
            </p>
          </div>
          {systemMessage ? (
            <div className="motion-fade-up mx-2 my-4 flex items-start gap-3 rounded-md border border-ember-100 bg-ember-50 p-3 text-sm text-ember-700 md:mx-3">
              <AlertTriangle aria-hidden="true" className="mt-0.5 shrink-0" size={18} />
              <span>{systemMessage}</span>
            </div>
          ) : null}
          <div className="p-2 pt-4 md:p-3 md:pt-4">{children}</div>
        </Reveal>
      </div>
    </section>
  );
}
