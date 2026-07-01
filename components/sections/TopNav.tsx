import { Flame } from "lucide-react";

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
    <header className="sticky top-0 z-[3000] border-b border-white/10 bg-[#07111f]/95 px-4 py-3 text-white shadow-[0_1px_0_rgb(255_255_255_/_0.04)] backdrop-blur">
      <nav className="mx-auto flex max-w-[1440px] flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center justify-between gap-4">
          <a className="group flex min-w-0 items-center gap-3" href="#top" aria-label="FireWatch home">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-ember-100/20 bg-ember-600 text-white shadow-[inset_0_1px_0_rgb(255_255_255_/_0.18)]">
              <Flame aria-hidden="true" size={21} />
            </span>
            <span className="min-w-0">
              <span className="block text-lg font-bold leading-tight tracking-tight">FireWatch</span>
              <span className="block truncate text-xs text-slate-400">
                ศูนย์รับรายงานควันและจุดเผาจากประชาชน
              </span>
            </span>
          </a>

          <div className="flex items-center gap-2 text-xs lg:hidden">
            <span className="h-2 w-2 rounded-full bg-canopy-500" aria-hidden="true" />
            <span className="font-semibold text-slate-200">{runtimeModeLabel}</span>
          </div>
        </div>

        <div className="flex items-center gap-3 border-t border-white/10 pt-3 lg:border-0 lg:pt-0">
          <div className="grid w-full grid-cols-4 gap-1 lg:flex lg:w-auto lg:shrink-0 lg:items-center">
            {navItems.map((item) => (
              <a
                key={item.href}
                className="rounded-md px-2 py-2 text-center text-xs font-semibold text-slate-300 transition hover:bg-white/[0.08] hover:text-white sm:text-sm lg:px-3"
                href={item.href}
              >
                {item.label}
              </a>
            ))}
          </div>

          <div className="ml-auto hidden shrink-0 items-center gap-3 border-l border-white/10 pl-4 text-xs lg:flex">
            <span className="inline-flex items-center gap-2 text-slate-300">
              <span className="h-2 w-2 rounded-full bg-canopy-500" aria-hidden="true" />
              {runtimeModeLabel}
            </span>
            <span className="text-slate-500">/</span>
            <span className="font-semibold text-slate-200">
              Reputation {reputationScore}
            </span>
          </div>
        </div>
      </nav>
    </header>
  );
}
