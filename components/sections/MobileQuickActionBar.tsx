import { MapPinned, PhoneCall, Send } from "lucide-react";

const actions = [
  {
    href: "#report",
    icon: Send,
    label: "แจ้งเหตุ"
  },
  {
    href: "#live-map",
    icon: MapPinned,
    label: "แผนที่"
  },
  {
    href: "tel:199",
    icon: PhoneCall,
    label: "โทร 199"
  }
];

export function MobileQuickActionBar() {
  return (
    <nav
      aria-label="ทางลัดหลัก"
      className="print-hidden fixed bottom-3 left-3 right-3 z-[2500] rounded-xl border border-slate-900/10 bg-white/95 p-2 text-smoke-950 shadow-[0_18px_50px_rgb(15_23_42_/_0.22)] backdrop-blur md:hidden"
    >
      <div className="grid grid-cols-3 gap-1">
        {actions.map((action) => {
          const Icon = action.icon;

          return (
            <a
              key={action.href}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg px-2 text-xs font-black transition hover:bg-ember-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ember-500"
              href={action.href}
            >
              <Icon aria-hidden="true" size={17} />
              {action.label}
            </a>
          );
        })}
      </div>
    </nav>
  );
}
