interface DemoModeSectionProps {
  isBackendMode: boolean;
}

const modes = [
  {
    name: "Local demo mode",
    label: "เครื่องเดียว",
    description:
      "ใช้ localStorage และ data URL เหมาะกับการซ้อมบนเครื่อง ไม่ต้องมี Firebase config และไม่แชร์ข้อมูลข้ามอุปกรณ์"
  },
  {
    name: "Firebase backend mode",
    label: "แชร์ข้ามอุปกรณ์",
    description:
      "ใช้ Auth, App Check, Storage, Firestore realtime และ callable Functions เพื่อให้หลายคนเห็นรายงานชุดเดียวกัน"
  }
];

export function DemoModeSection({ isBackendMode }: DemoModeSectionProps) {
  const activeMode = isBackendMode ? modes[1].name : modes[0].name;

  return (
    <section className="bg-[#f8f5ee] px-4 py-12">
      <div className="mx-auto max-w-[1440px]">
        <div className="grid gap-5 rounded-lg border border-smoke-200 bg-white p-5 shadow-sm lg:grid-cols-[minmax(260px,360px)_1fr] lg:items-center">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-smoke-500">
              Demo mode note
            </p>
            <h2 className="mt-3 text-2xl font-black tracking-tight text-smoke-950">
              โหมดที่กำลังใช้งาน: {activeMode}
            </h2>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {modes.map((mode) => {
              const isActive = mode.name === activeMode;

              return (
                <article
                  key={mode.name}
                  className={`border-l-4 p-4 ${
                    isActive
                      ? "border-ember-600 bg-ember-50"
                      : "border-smoke-200 bg-smoke-50"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-black text-smoke-950">{mode.name}</h3>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-black ${
                        isActive
                          ? "bg-ember-600 text-white"
                          : "bg-white text-smoke-600"
                      }`}
                    >
                      {mode.label}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-smoke-600">{mode.description}</p>
                </article>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
