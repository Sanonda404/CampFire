import { cn } from "@/lib/utils";

const FIELD =
  "w-full rounded-xl border border-line bg-night-soft px-4 py-3 text-sm text-cream placeholder:text-muted/60 focus:outline-none focus:border-ember/70 focus:ring-1 focus:ring-ember/40 transition-colors";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(FIELD, className)} {...props} />;
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(FIELD, "resize-none", className)} {...props} />;
}

export function Select({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(FIELD, "appearance-none cursor-pointer [&>option]:bg-night-soft", className)} {...props}>
      {children}
    </select>
  );
}

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("block text-xs font-semibold uppercase tracking-widest text-muted mb-2", className)} {...props} />;
}

export function FieldError({ children }: { children?: string | null }) {
  if (!children) return null;
  return <p className="mt-1.5 text-xs text-rose-300">{children}</p>;
}
