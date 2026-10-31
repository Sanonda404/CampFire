export function cn(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function generateRoomCode(): string {
  let out = "";
  for (let i = 0; i < 6; i++) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return out;
}

export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

export function formatSeconds(total: number): string {
  const s = Math.max(0, Math.floor(total));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

const AVATAR_COLORS = [
  "bg-ember/80 text-night",
  "bg-lilac/80 text-night",
  "bg-teal-400/80 text-night",
  "bg-rose-400/80 text-night",
  "bg-amber-300/80 text-night",
  "bg-sky-400/80 text-night",
];

export function avatarColor(token: string): string {
  let hash = 0;
  for (const ch of token) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

let serverOffsetMs = 0;

export function setServerOffset(serverNowMs: number, observedAtMs: number = Date.now()) {
  serverOffsetMs = serverNowMs - observedAtMs;
}

export function serverNow(): number {
  return Date.now() + serverOffsetMs;
}

export function remainingSeconds(room: {
  started_at: string | null;
  duration_sec: number;
  paused_accumulated: number;
  is_paused: boolean;
}): number {
  const elapsed =
    room.paused_accumulated +
    (room.started_at && !room.is_paused ? (serverNow() - new Date(room.started_at).getTime()) / 1000 : 0);
  return room.duration_sec - elapsed;
}
