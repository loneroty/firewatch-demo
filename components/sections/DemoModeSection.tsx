import { HardDrive, RadioTower } from "lucide-react";
import { SectionHeader } from "@/components/ui/SectionHeader";

interface DemoModeSectionProps {
  isBackendMode: boolean;
}

export function DemoModeSection({ isBackendMode }: DemoModeSectionProps) {
  return (
    <section className="bg-smoke-50 px-4 py-12">
      <div className="mx-auto max-w-[1440px]">
        <SectionHeader
          eyebrow="Demo modes"
          title="เลือกโหมดให้ตรงกับสถานการณ์ demo"
          description="หน้าเดียวกันรองรับทั้งการเปิดทดสอบในเครื่องและการแชร์ข้อมูลข้ามอุปกรณ์ผ่าน Firebase backend จริง"
        />
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <article
            className={`rounded-lg border p-5 ${
              isBackendMode
                ? "border-smoke-200 bg-white"
                : "border-ember-100 bg-ember-50"
            }`}
          >
            <div className="flex items-start gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-slate-950 text-white">
                <HardDrive aria-hidden="true" size={22} />
              </span>
              <div>
                <h3 className="text-lg font-bold text-smoke-950">Local demo mode</h3>
                <p className="mt-2 text-sm leading-6 text-smoke-600">
                  ใช้ localStorage และ data URL เหมาะกับการทดสอบบนเครื่องเดียว ไม่ต้องมี Firebase config และไม่แชร์ข้อมูลข้ามอุปกรณ์
                </p>
              </div>
            </div>
          </article>

          <article
            className={`rounded-lg border p-5 ${
              isBackendMode
                ? "border-canopy-500/30 bg-canopy-50"
                : "border-smoke-200 bg-white"
            }`}
          >
            <div className="flex items-start gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-canopy-700 text-white">
                <RadioTower aria-hidden="true" size={22} />
              </span>
              <div>
                <h3 className="text-lg font-bold text-smoke-950">Firebase backend mode</h3>
                <p className="mt-2 text-sm leading-6 text-smoke-600">
                  ใช้ Auth, App Check, Storage, Firestore realtime และ callable Functions เพื่อแชร์รายงานข้ามอุปกรณ์จริง
                </p>
              </div>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
