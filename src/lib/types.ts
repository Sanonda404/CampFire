export type RoomState =
  | "waiting"
  | "focusing"
  | "challenge_thinking"
  | "challenge_sharing"
  | "reveal"
  | "discussion"
  | "group_answer"
  | "complete";

export interface Room {
  id: string;
  code: string;
  name: string;
  activity_type: string;
  session_type: string;
  description: string | null;
  host_token: string;
  state: RoomState;
  current_challenge_id: string | null;
  started_at: string | null;
  duration_sec: number;
  paused_accumulated: number;
  is_paused: boolean;
  created_at: string;
}

export interface Participant {
  id: string;
  room_id: string;
  token: string;
  name: string;
  is_host: boolean;
  last_seen_at: string;
}

export interface ChatMessage {
  id: string;
  room_id: string;
  participant_token: string;
  sender: string;
  text: string;
  created_at: string;
}

export interface Challenge {
  id: string;
  room_id: string;
  question: string;
  context: string | null;
  status: "thinking" | "sharing" | "reveal" | "agreed" | "completed";
  ai_generated: boolean;
  created_at: string;
}

export interface Submission {
  id: string;
  challenge_id: string;
  participant_token: string;
  answer: string;
  reasoning: string | null;
  created_at: string;
}

export interface Conclusion {
  id: string;
  challenge_id: string;
  participant_token: string;
  final_answer: string;
  ai_explanation: string | null;
  created_at: string;
}

export interface SessionRecap {
  id: string;
  room_id: string;
  summary: string | null;
  duration_sec: number;
  participant_count: number;
  challenges_completed: number;
  created_at: string;
}

export const PHASES: { key: RoomState; label: string }[] = [
  { key: "waiting", label: "Lobby" },
  { key: "challenge_thinking", label: "Think" },
  { key: "challenge_sharing", label: "Share" },
  { key: "reveal", label: "Reveal" },
  { key: "group_answer", label: "Agree" },
  { key: "complete", label: "Complete" },
];
