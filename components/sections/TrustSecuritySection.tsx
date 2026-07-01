const securityLayers = [
  {
    layer: "Client app",
    detail: "รับรูป พิกัด และ payload จากผู้ใช้ แต่ไม่เขียนสถานะสำคัญลง reports โดยตรง"
  },
  {
    layer: "Firebase Auth + App Check",
    detail: "ใช้ anonymous session และบังคับ request มาจากแอปที่ตั้งค่าไว้ใน backend mode"
  },
  {
    layer: "Storage Rules",
    detail: "ให้ผู้ใช้ upload รูปได้เฉพาะ path ของตัวเอง และจำกัดชนิดไฟล์/ขนาดสำหรับ MVP"
  },
  {
    layer: "Cloud Functions",
    detail: "createReport และ confirmReport ตรวจ payload, owner, distance/time และ rate limit ฝั่ง server"
  },
  {
    layer: "Firestore Rules",
    detail: "เปิดอ่านรายงานได้ แต่ปิดทาง client เขียน reports หรือแก้ verificationStatus โดยตรง"
  }
];

const guardrails = [
  "Rate limit 10 reports ต่อชั่วโมงด้วย hourly bucket และ transaction",
  "confirmReport ต้องใช้ report ของผู้ยืนยันที่อยู่ใน 500m / 60 นาที",
  "client ตั้ง confirmedByReportIds, verificationStatus หรือ admin fields เองไม่ได้",
  "local demo แยกจาก backend mode ชัดเจน ไม่ต้องใช้ secret หรือ Firebase config"
];

export function TrustSecuritySection() {
  return (
    <section id="security" className="scroll-mt-28 bg-[#07111f] px-4 py-16 text-white md:py-20">
      <div className="mx-auto max-w-[1440px]">
        <div className="grid gap-8 lg:grid-cols-[minmax(300px,460px)_1fr]">
          <div>
            <p className="mb-3 text-xs font-black uppercase tracking-[0.22em] text-ember-100">
              Trust architecture
            </p>
            <h2 className="text-3xl font-black tracking-tight md:text-5xl">
              จุดที่ควบคุม abuse อยู่หลัง server
            </h2>
            <p className="mt-5 text-base leading-7 text-slate-300">
              สำหรับกรรมการสายเทคนิค: production path ไม่ให้ browser ตัดสินความน่าเชื่อถือเอง
              แต่ส่งผ่าน Firebase Rules และ Cloud Functions ที่ตรวจ payload ด้วย transaction
            </p>
          </div>

          <div className="grid gap-4">
            <div className="overflow-hidden rounded-lg border border-white/10 bg-white/[0.04]">
              {securityLayers.map((item, index) => (
                <div
                  key={item.layer}
                  className="grid gap-3 border-b border-white/10 p-4 last:border-b-0 md:grid-cols-[92px_180px_1fr] md:items-start"
                >
                  <span className="font-mono text-xs font-black text-ember-500">
                    Layer {index + 1}
                  </span>
                  <span className="font-bold text-white">{item.layer}</span>
                  <span className="text-sm leading-6 text-slate-300">{item.detail}</span>
                </div>
              ))}
            </div>

            <div className="rounded-lg border border-ember-500/20 bg-ember-500/10 p-5">
              <p className="text-sm font-black uppercase tracking-[0.18em] text-ember-100">
                Demo guardrails
              </p>
              <ul className="mt-4 grid gap-3 text-sm leading-6 text-slate-200 md:grid-cols-2">
                {guardrails.map((item) => (
                  <li key={item} className="flex gap-3">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-ember-500" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
