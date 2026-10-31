import { avatarColor, cn, initialsOf } from "@/lib/utils";

export function Avatar({
  token,
  name,
  online = true,
  isHost = false,
  size = "md",
}: {
  token: string;
  name: string;
  online?: boolean;
  isHost?: boolean;
  size?: "sm" | "md" | "lg";
}) {
  const sizes = {
    sm: "h-7 w-7 text-[10px]",
    md: "h-9 w-9 text-xs",
    lg: "h-12 w-12 text-sm",
  };
  return (
    <span className="relative inline-flex shrink-0">
      <span
        className={cn(
          "inline-flex items-center justify-center rounded-full font-bold",
          avatarColor(token),
          sizes[size]
        )}
        aria-hidden
      >
        {initialsOf(name)}
      </span>
      <span
        className={cn(
          "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-night",
          online ? "bg-emerald-400" : "bg-gray-600"
        )}
        title={online ? "Online" : "Away"}
      />
      {isHost && (
        <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[10px]" title="Host">
          👑
        </span>
      )}
    </span>
  );
}
