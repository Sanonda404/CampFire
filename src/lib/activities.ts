export interface ActivityType {
  key: string;
  label: string;
  blurb: string;
}

export interface SessionType {
  key: string;
  label: string;
  minutes: number;
}

export const ACTIVITY_TYPES: ActivityType[] = [
  { key: "focus", label: "Deep Focus", blurb: "Heads-down work sprints" },
  { key: "study", label: "Study Circle", blurb: "Learn together, quiz each other" },
  { key: "writing", label: "Writing Room", blurb: "Drafts, edits and word counts" },
  { key: "brainstorm", label: "Brainstorm", blurb: "Ideas under the stars" },
  { key: "debugging", label: "Debug Squad", blurb: "Hunt bugs as a pack" },
];

export const SESSION_TYPES: SessionType[] = [
  { key: "quick", label: "Quick Spark (15 min)", minutes: 15 },
  { key: "pomodoro", label: "Pomodoro (25 min)", minutes: 25 },
  { key: "deep", label: "Deep Dive (50 min)", minutes: 50 },
];

export function activityLabel(key: string): string {
  return ACTIVITY_TYPES.find((a) => a.key === key)?.label ?? key;
}

export function sessionMinutes(key: string): number {
  return SESSION_TYPES.find((s) => s.key === key)?.minutes ?? 25;
}

export const PREDEFINED_CHALLENGES: Record<string, { question: string; context: string }[]> = {
  focus: [
    {
      question: "What is the single smallest next action that would make your current task feel 10% lighter?",
      context: "Share the task you're focused on and the concrete next step you'll take.",
    },
    {
      question: "Which distraction has the best chance of stealing your next focus block — and what's your counter-move?",
      context: "Name the distraction honestly and one concrete defence against it.",
    },
  ],
  study: [
    {
      question: "Explain the concept you just studied as if teaching it to a curious 12-year-old.",
      context: "The Feynman test: if you can't simplify it, you've found your next study target.",
    },
    {
      question: "What is one thing you believed about today's material that turned out to be wrong?",
      context: "Misconceptions are gold — surface them before they calcify.",
    },
  ],
  writing: [
    {
      question: "Read your last paragraph aloud in your head: which single sentence is doing the least work?",
      context: "Cut or rewrite it. Share the before and after if you like.",
    },
    {
      question: "If your piece could only keep one sentence, which one would carry the whole idea?",
      context: "Finding your strongest line shows you where the piece truly lives.",
    },
  ],
  brainstorm: [
    {
      question: "What would the laziest possible solution to our problem look like — and does it secretly work?",
      context: "Minimum-effort ideas often reveal what actually matters.",
    },
    {
      question: "How would this problem be solved by a restaurant kitchen, an orchestra, or an ant colony?",
      context: "Borrow a system from a totally different world and see what transfers.",
    },
  ],
  debugging: [
    {
      question: "State your current best theory of the bug in one sentence, plus the one experiment that would kill it.",
      context: "A theory you can't test is just a mood. Design the falsifier.",
    },
    {
      question: "What did this bug teach you about the system that you didn't know an hour ago?",
      context: "Every reproducible bug is a map of a misunderstanding.",
    },
  ],
};

export const FALLBACK_CHALLENGE = {
  question: "What is one thing you each want to walk away with by the end of this session?",
  context: "Set an intention everyone can see and hold you to.",
};
