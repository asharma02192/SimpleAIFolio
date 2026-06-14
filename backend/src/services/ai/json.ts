import type { AiChatMessage, AiChatProvider, AiCompletionResult } from "./provider";

const MAX_REPAIR_RESPONSE_LENGTH = 60_000;

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
  onAttempt,
  maxAttempts = 2,
}: {
  provider: AiChatProvider;
  messages: AiChatMessage[];
  validate: (value: unknown) => value is T;
  onAttempt?: (result: AiCompletionResult, attempt: number) => void | Promise<void>;
  maxAttempts?: number;
}): Promise<T> {
  let lastError: unknown = null;
  let attemptMessages = messages;
  let result: AiCompletionResult | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      result = await provider.complete(attemptMessages);
      await onAttempt?.(result, attempt + 1);
      const parsed = parseAiJson<unknown>(result.text);
      if (!validate(parsed)) {
        throw new Error("Structured AI response did not match the expected schema.");
      }
      return parsed;
    } catch (error) {
      lastError = error;
      const previousResponse = result?.text
        ? result.text.slice(0, MAX_REPAIR_RESPONSE_LENGTH)
        : "No previous response was captured.";
      attemptMessages = [
        ...messages,
        {
          role: "user",
          content: [
            "The previous response was not valid JSON for the required schema.",
            `Parser/schema error: ${error instanceof Error ? error.message : String(error)}`,
            "",
            "Repair the response below into valid JSON matching the schema from the prior request.",
            "Return corrected JSON only, with no markdown fences or extra commentary.",
            "Preserve the article content and all useful fields where possible.",
            "",
            "Previous response:",
            previousResponse,
          ].join("\n"),
        },
      ];
    }
  }

  throw new Error(
    lastError instanceof Error
      ? `AI returned invalid structured data after ${maxAttempts} attempts. ${lastError.message}`
      : `AI returned invalid structured data after ${maxAttempts} attempts.`
  );
}
