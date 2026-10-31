import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-ember text-night hover:bg-ember-soft shadow-[0_0_24px_rgba(255,146,46,0.35)] disabled:shadow-none",
  secondary: "bg-surface border border-line text-cream hover:border-ember/60 hover:text-ember",
  ghost: "bg-transparent text-muted hover:text-cream hover:bg-white/5",
  danger: "bg-transparent text-rose-300 border border-rose-400/40 hover:bg-rose-400/10",
};

const SIZES: Record<Size, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-5 py-2.5 text-sm",
  lg: "px-7 py-3.5 text-base",
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full font-semibold tracking-wide transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-ember cursor-pointer",
        VARIANTS[variant],
        SIZES[size],
        className
      )}
      {...props}
    />
  );
}
