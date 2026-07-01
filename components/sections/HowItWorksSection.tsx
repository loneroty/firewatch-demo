import { Camera, CheckCircle2, MapPinned } from "lucide-react";
import { SectionHeader } from "@/components/ui/SectionHeader";

const steps = [
  {
    title: "ประชาชนแจ้งเหตุ",
    description: "ส่งรูปถ่าย ประเภทเหตุการณ์ ระดับความรุนแรง และพิกัดจาก GPS หรือกรอกเอง",
    icon: Camera
  },
  {
    title: "ตรวจหลักฐานใกล้เคียง",
    description: "รายงานจะน่าเชื่อถือขึ้นเมื่อมีรายงานของคนอื่นอยู่ในรัศมี 500 เมตร ภายใน 60 นาที",
    icon: CheckCircle2
  },
  {
    title: "แสดงบนแผนที่สด",
    description: "ข้อมูลถูกจัดกลุ่มและแสดงสถานะบนแผนที่ เพื่อช่วยประเมินความเสี่ยงในพื้นที่",
    icon: MapPinned
  }
];

export function HowItWorksSection() {
  return (
    <section className="bg-white px-4 py-12">
      <div className="mx-auto max-w-[1440px]">
        <SectionHeader
          eyebrow="How it works"
          title="ระบบยืนยันแบบใช้รายงานใกล้เคียง"
          description="FireWatch ไม่ใช้การโหวตลอย ๆ แต่ผูกการยืนยันกับหลักฐานอีกจุดที่อยู่ใกล้และอยู่ในช่วงเวลาเดียวกัน"
        />
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {steps.map((step, index) => {
            const Icon = step.icon;

            return (
              <article
                key={step.title}
                className="rounded-lg border border-smoke-200 bg-white p-5 shadow-sm"
              >
                <div className="mb-4 flex items-center justify-between gap-3">
                  <span className="grid h-11 w-11 place-items-center rounded-lg bg-slate-950 text-white">
                    <Icon aria-hidden="true" size={22} />
                  </span>
                  <span className="text-sm font-bold text-ember-700">0{index + 1}</span>
                </div>
                <h3 className="text-lg font-bold text-smoke-950">{step.title}</h3>
                <p className="mt-3 text-sm leading-6 text-smoke-600">{step.description}</p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
