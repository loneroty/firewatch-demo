import { Database, Gauge, LockKeyhole, ShieldCheck, UploadCloud, Zap } from "lucide-react";
import { SectionHeader } from "@/components/ui/SectionHeader";

const securityItems = [
  {
    title: "Firebase Auth",
    description: "ใช้ anonymous session เป็นตัวตนหลักของผู้ส่งรายงานใน backend mode",
    icon: ShieldCheck
  },
  {
    title: "App Check",
    description: "ลดความเสี่ยงจาก script ที่ยิง callable function ตรงนอกแอป",
    icon: LockKeyhole
  },
  {
    title: "Storage Rules",
    description: "บังคับ upload รูปเฉพาะ path ของผู้ใช้และจำกัดชนิดไฟล์/ขนาด",
    icon: UploadCloud
  },
  {
    title: "Firestore Rules",
    description: "อ่านรายงานได้ แต่ client สร้าง report หรือแก้ field ยืนยันตรงไม่ได้",
    icon: Database
  },
  {
    title: "Cloud Functions",
    description: "สร้างและยืนยัน report ผ่าน server-side validation และ transaction",
    icon: Zap
  },
  {
    title: "Rate limit",
    description: "จำกัด 10 reports ต่อชั่วโมงด้วย counter ฝั่ง server",
    icon: Gauge
  }
];

export function TrustSecuritySection() {
  return (
    <section id="security" className="bg-slate-950 px-4 py-12 text-white">
      <div className="mx-auto max-w-[1440px]">
        <SectionHeader
          eyebrow="Trust and security"
          title="ออกแบบให้ demo ได้จริงและคุม abuse ฝั่ง server"
          description="ส่วนสำคัญของ production path อยู่หลัง Cloud Functions และ Firebase Rules เพื่อไม่ให้ client ตั้งสถานะสำคัญเอง"
          inverse
        />
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {securityItems.map((item) => {
            const Icon = item.icon;

            return (
              <article
                key={item.title}
                className="rounded-lg border border-white/10 bg-white/5 p-5"
              >
                <span className="grid h-11 w-11 place-items-center rounded-lg bg-white/10 text-ember-200">
                  <Icon aria-hidden="true" size={22} />
                </span>
                <h3 className="mt-4 text-lg font-bold text-white">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-300">{item.description}</p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
