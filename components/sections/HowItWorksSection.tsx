import { Reveal } from "@/components/ui/Reveal";

const steps = [
  {
    label: "รับรายงาน",
    title: "ประชาชนส่งรูปและพิกัดจากจุดเกิดเหตุ",
    description:
      "รายงานหนึ่งรายการต้องมีประเภทเหตุการณ์ ความรุนแรง รูปถ่าย และตำแหน่ง เพื่อให้ข้อมูลมีน้ำหนักมากกว่าข้อความแจ้งเตือนทั่วไป"
  },
  {
    label: "เทียบหลักฐาน",
    title: "ยืนยันด้วยรายงานใกล้เคียง ไม่ใช่การโหวตลอย ๆ",
    description:
      "รายงานเป้าหมายจะยืนยันได้เมื่อมีรายงานของอีกคนอยู่ภายใน 500 เมตร และเกิดในช่วง 60 นาทีเดียวกัน"
  },
  {
    label: "ใช้ร่วมกัน",
    title: "ข้อมูลเดียวกันขึ้นทั้งแผนที่และ incident log",
    description:
      "backend mode แชร์ข้อมูลผ่าน Firestore realtime เพื่อให้หลายอุปกรณ์เห็นสถานการณ์เดียวกันระหว่าง demo หรือการลงพื้นที่"
  }
];

export function HowItWorksSection() {
  return (
    <section className="bg-white px-4 py-16 md:py-20">
      <div className="mx-auto max-w-[1440px]">
        <div className="grid gap-8 lg:grid-cols-[minmax(280px,420px)_1fr]">
          <Reveal>
            <p className="mb-3 text-xs font-black uppercase tracking-[0.22em] text-ember-700">
              Verification model
            </p>
            <h2 className="text-3xl font-black tracking-tight text-smoke-950 md:text-5xl">
              วิธีทำให้รายงานมีหลักฐานพอเชื่อได้
            </h2>
            <p className="mt-5 text-base leading-7 text-smoke-600">
              FireWatch ตั้งใจให้การยืนยันผูกกับเหตุการณ์จริงในพื้นที่
              จึงใช้รายงานใกล้เคียงเป็นหลักฐานประกอบแทนการกดโหวตทั่วไป
            </p>
          </Reveal>

          <Reveal delayMs={120} className="relative">
            <div className="absolute bottom-0 left-[23px] top-0 hidden w-px bg-smoke-200 md:block" />
            <div className="grid gap-5">
              {steps.map((step, index) => (
                <article
                  key={step.label}
                  className="hover-lift relative grid gap-4 rounded-lg border border-smoke-200 bg-[#f8f5ee] p-5 md:grid-cols-[48px_1fr]"
                  style={{ transitionDelay: `${index * 55}ms` }}
                >
                  <div className="relative z-10 grid h-12 w-12 place-items-center rounded-md border border-smoke-200 bg-white font-mono text-sm font-black text-ember-700">
                    0{index + 1}
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-smoke-500">
                      {step.label}
                    </p>
                    <h3 className="mt-2 text-xl font-black leading-snug text-smoke-950">
                      {step.title}
                    </h3>
                    <p className="mt-3 text-sm leading-6 text-smoke-600">
                      {step.description}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
