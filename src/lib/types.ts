export type RoomState =
  | "waiting"
  | "focusing"
  | "challenge_thinking"
  | "challenge_sharing"
  | "reveal"
  | "discussion"
  | "group_answer"
  | "complete"
  // Idea Clash loop
  | "team_assignment"
  | "brainstorming"
  | "plot_twist"
  | "submission"
  | "judging";

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
  game_started_at: string | null;
  plot_twist_at_seconds: number;
  max_participants: number;
  duration_sec: number;
  paused_accumulated: number;
  is_paused: boolean;
  winning_team_id: string | null;
  reveal_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface Participant {
  id: string;
  room_id: string;
  token: string;
  name: string;
  is_host: boolean;
  is_ready: boolean;
  is_connected: boolean;
  last_seen_at: string;
}

export interface ChatMessage {
  id: string;
  room_id: string;
  participant_token: string;
  sender: string;
  text: string;
  team_id: string | null;
  message_type: "text" | "voice";
  transcript: string | null;
  audio_storage_path: string | null;
  audio_duration_ms: number | null;
  voice_status: string;
  created_at: string;
}

export interface Challenge {
  id: string;
  room_id: string;
  question: string;
  context: string | null;
  status:
    | "thinking"
    | "sharing"
    | "plot_twist"
    | "submission"
    | "judging"
    | "reveal"
    | "agreed"
    | "completed";
  ai_generated: boolean;
  plot_twist: string | null;
  plot_twist_at: string | null;
  brainstorming_started_at: string | null;
  submission_deadline: string | null;
  submissions_locked_at: string | null;
  judging_started_at: string | null;
  judging_completed_at: string | null;
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

// ---------- Idea Clash ----------

export interface Team {
  id: string;
  room_id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface TeamMember {
  team_id: string;
  participant_id: string;
  joined_at: string;
}

export interface InitialIdea {
  id: string;
  room_id: string;
  challenge_id: string;
  participant_id: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface ScratchPage {
  id: string;
  room_id: string;
  challenge_id: string;
  team_id: string;
  title: string;
  content: string;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface TeamProposal {
  id: string;
  challenge_id: string;
  team_id: string;
  content: string;
  submitted_at: string | null;
  locked_at: string | null;
  last_edited_by: string | null;
  updated_at: string;
  created_at: string;
}

export interface JudgingResult {
  id: string;
  challenge_id: string;
  team_id: string;
  originality_score: number;
  feasibility_score: number;
  impact_score: number;
  plot_twist_score: number;
  clarity_score: number;
  total_score: number;
  strengths: string[];
  improvements: string[];
  plot_twist_addressed: boolean;
  judge_explanation: string;
  model_name: string | null;
  created_at: string;
}
