export interface ChatTurn {
  role: "system" | "user" | "assistant";
  content: string;
}

export function aiConfigured(): boolean {
  return Boolean(process.env.AI_API_KEY);
}

export async function callAI(turns: ChatTurn[]): Promise<string> {
  const key = process.env.AI_API_KEY;
  if (!key) throw new Error("AI_NOT_CONFIGURED");
  const base = (process.env.AI_API_BASE || "https://api.openai.com/v1").replace(/\/$/, "");
  const model = process.env.AI_MODEL || "gpt-4o-mini";

  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({ model, messages: turns, temperature: 0.8, max_tokens: 500 }),
  });
  if (!res.ok) {
    throw new Error(`AI_ERROR ${res.status}`);
  }
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("AI_EMPTY");
  return text;
}
