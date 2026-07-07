import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";

type ButtonTone = "primary" | "secondary" | "danger" | "ghost" | "dark";
type ButtonSize = "sm" | "md";

interface BaseButtonProps {
  children: ReactNode;
  className?: string;
  size?: ButtonSize;
  tone?: ButtonTone;
}

type ButtonProps = BaseButtonProps & ButtonHTMLAttributes<HTMLButtonElement>;
type ButtonLinkProps = BaseButtonProps & AnchorHTMLAttributes<HTMLAnchorElement>;

const toneClassNames: Record<ButtonTone, string> = {
  primary:
    "border-ember-600 bg-ember-600 text-white shadow-[0_14px_30px_rgb(234_88_12_/_0.18)] hover:border-ember-700 hover:bg-ember-700",
  secondary:
    "border-smoke-200 bg-white text-smoke-950 hover:border-smoke-400 hover:bg-smoke-50",
  danger:
    "border-red-600 bg-red-600 text-white hover:border-red-700 hover:bg-red-700",
  ghost:
    "border-transparent bg-transparent text-smoke-700 hover:bg-smoke-100 hover:text-smoke-950",
  dark:
    "border-white/10 bg-white/[0.06] text-white hover:border-white/20 hover:bg-white/[0.1]"
};

const sizeClassNames: Record<ButtonSize, string> = {
  sm: "min-h-10 px-3 py-2 text-xs",
  md: "min-h-12 px-4 py-3 text-sm"
};

export function getButtonClassName({
  className = "",
  size = "md",
  tone = "primary"
}: {
  className?: string;
  size?: ButtonSize;
  tone?: ButtonTone;
}): string {
  return [
    "hover-lift inline-flex items-center justify-center gap-2 rounded-md border font-black transition disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ember-500",
    toneClassNames[tone],
    sizeClassNames[size],
    className
  ]
    .filter(Boolean)
    .join(" ");
}

export function Button({
  children,
  className,
  size,
  tone,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      className={getButtonClassName({ className, size, tone })}
      type={type}
      {...props}
    >
      {children}
    </button>
  );
}

export function ButtonLink({
  children,
  className,
  size,
  tone,
  ...props
}: ButtonLinkProps) {
  return (
    <a className={getButtonClassName({ className, size, tone })} {...props}>
      {children}
    </a>
  );
}
