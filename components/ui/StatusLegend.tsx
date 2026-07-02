const legendItems = [
  {
    label: "รอการยืนยัน",
    description: "มีรายงานแล้ว รอหลักฐานใกล้เคียง",
    markerClassName: "bg-ember-600"
  },
  {
    label: "ยืนยันแล้ว",
    description: "มีรายงานใกล้เคียงใน 500m/60 นาที",
    markerClassName: "bg-canopy-700"
  },
  {
    label: "ถูกปฏิเสธ",
    description: "ถูกคัดออกจากการเฝ้าระวัง",
    markerClassName: "bg-smoke-600"
  }
];

export function StatusLegend() {
  return (
    <div className="grid gap-0 divide-y divide-smoke-200 border-y border-smoke-200">
      {legendItems.map((item) => (
        <div
          key={item.label}
          className="grid grid-cols-[18px_1fr] gap-3 py-3 transition-transform duration-200 hover:translate-x-1"
        >
          <span
            className={`motion-pulse-soft mt-1.5 h-3 w-3 shrink-0 rounded-full shadow-sm ${item.markerClassName}`}
          />
          <span>
            <span className="block text-sm font-semibold text-smoke-950">{item.label}</span>
            <span className="mt-0.5 block text-xs leading-5 text-smoke-600">
              {item.description}
            </span>
          </span>
        </div>
      ))}
    </div>
  );
}
