import type { AiChatMessage, AiChatProvider } from "./provider";

function extractJsonCandidate(raw: string) {
  const trimmed = raw.trim();

  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    return trimmed;
  }

  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedMatch?.[1]) {
    return fencedMatch[1].trim();
  }

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return trimmed.slice(start, end + 1);
  }

  const arrayStart = trimmed.indexOf("[");
  const arrayEnd = trimmed.lastIndexOf("]");
  if (arrayStart >= 0 && arrayEnd > arrayStart) {
    return trimmed.slice(arrayStart, arrayEnd + 1);
  }

  return trimmed;
}

export function parseAiJson<T>(raw: string): T {
  return JSON.parse(extractJsonCandidate(raw)) as T;
}

export async function requestStructuredJson<T>({
  provider,
  messages,
  validate,
}: {
  provider: AiChatProvider;
  messages: AiChatMessage[];
  validate: (value: unknown) => value is T;
}): Promise<T> {
  let lastError: unknown = null;
  let attemptMessages = messages;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const raw = await provider.complete(attemptMessages);
      const parsed = parseAiJson<unknown>(raw);
      if (!validate(parsed)) {
        throw new Error("Structured AI response did not match the expected schema.");
      }
      return parsed;
    } catch (error) {
      lastError = error;
      attemptMessages = [
        ...messages,
        {
          role: "user",
          content:
            "The previous response was not valid JSON for the required schema. Return corrected JSON only, with no markdown fences or extra commentary.",
        },
      ];
    }
  }

  throw new Error(
    lastError instanceof Error
      ? `AI returned invalid structured data. ${lastError.message}`
      : "AI returned invalid structured data."
  );
}
