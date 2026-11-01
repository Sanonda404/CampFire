export interface ChatTurn {
  role: "system" | "user" | "assistant";
  content: string;
}

export function aiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

export async function callAI(turns: ChatTurn[]): Promise<string> {
  const key = process.env.GEMINI_API_KEY;

  if (!key) throw new Error("AI_NOT_CONFIGURED");

  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const base =
    process.env.GEMINI_API_BASE ||
    "https://generativelanguage.googleapis.com/v1beta";

  // Gemini accepts system instructions separately from conversation history.
  const systemInstruction = turns
    .filter((turn) => turn.role === "system")
    .map((turn) => turn.content)
    .join("\n\n");

  const contents = turns
    .filter((turn) => turn.role !== "system")
    .map((turn) => ({
      role: turn.role === "assistant" ? "model" : "user",
      parts: [{ text: turn.content }],
    }));

  const res = await fetch(
    `${base.replace(/\/+$/, "")}/models/${model}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": key,
      },
      body: JSON.stringify({
        ...(systemInstruction
          ? {
              systemInstruction: {
                parts: [{ text: systemInstruction }],
              },
            }
          : {}),
        contents,
        generationConfig: {
          temperature: 0.8,
          maxOutputTokens: 500,
        },
      }),
    }
  );

  if (!res.ok) {
    throw new Error(`AI_ERROR ${res.status}`);
  }

  const data = (await res.json()) as {
    candidates?: {
      content?: {
        parts?: { text?: string }[];
      };
    }[];
  };

  const text = data.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? "")
    .join("")
    .trim();

  if (!text) throw new Error("AI_EMPTY");

  return text;
}