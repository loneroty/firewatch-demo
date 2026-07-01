import { Flame, Gauge, RadioTower } from "lucide-react";

interface TopNavProps {
  runtimeModeLabel: string;
  reputationScore: number;
}

const navItems = [
  { label: "แผนที่สด", href: "#live-map" },
  { label: "แจ้งเหตุ", href: "#report" },
  { label: "รายงานล่าสุด", href: "#latest-reports" },
  { label: "ความปลอดภัย", href: "#security" }
];

export function TopNav({ runtimeModeLabel, reputationScore }: TopNavProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/95 px-4 py-3 text-white shadow-sm backdrop-blur">
      <nav className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3">
        <a className="flex min-w-0 items-center gap-3" href="#top" aria-label="FireWatch home">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-ember-600 text-white">
            <Flame aria-hidden="true" size={22} />
          </span>
          <span className="min-w-0">
            <span className="block text-lg font-bold leading-tight">FireWatch</span>
            <span className="block truncate text-xs text-slate-300">
              Crowdsource smoke and wildfire watch
            </span>
          </span>
        </a>

        <div className="hidden flex-wrap items-center gap-1 md:flex">
          {navItems.map((item) => (
            <a
              key={item.href}
              className="rounded-md px-3 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/10 hover:text-white"
              href={item.href}
            >
              {item.label}
            </a>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/10 px-3 py-2 text-slate-100">
            <RadioTower aria-hidden="true" size={16} />
            {runtimeModeLabel}
          </span>
          <span className="inline-flex items-center gap-2 rounded-md bg-canopy-50 px-3 py-2 font-semibold text-canopy-700">
            <Gauge aria-hidden="true" size={16} />
            Reputation {reputationScore}
          </span>
        </div>
      </nav>
    </header>
  );
}
