import { cn } from "@/lib/utils";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-line bg-surface/80 backdrop-blur-sm p-6",
        className
      )}
      {...props}
    />
  );
}
