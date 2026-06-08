export type AiProviderName = "disabled" | "mock" | "openai-compatible";
export type ResearchProviderName = "disabled" | "mock" | "exa";

export interface AiChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AiProviderConfig {
  provider: AiProviderName;
  apiKey: string | null;
  baseUrl: string | null;
  model: string | null;
  temperature: number;
  maxTokens: number;
  rateLimitWindowMs: number;
  rateLimitMax: number;
  researchProvider: ResearchProviderName;
  researchApiKey: string | null;
}

export interface AiChatProvider {
  readonly providerName: AiProviderName;
  isConfigured(): boolean;
  getUnavailableReason(): string | null;
  complete(messages: AiChatMessage[], options?: { temperature?: number; maxTokens?: number }): Promise<string>;
}

function normalizeNumber(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function usesMaxCompletionTokens(model: string | null) {
  if (!model) return false;
  return /^gpt-5(\b|[\.-])/i.test(model.trim());
}

export function getAiProviderConfig(): AiProviderConfig {
  const provider = (process.env.AI_PROVIDER?.trim() || "disabled") as AiProviderName;
  const researchProvider = (process.env.RESEARCH_PROVIDER?.trim() || "disabled") as ResearchProviderName;

  return {
    provider,
    apiKey: process.env.AI_API_KEY?.trim() || null,
    baseUrl: process.env.AI_BASE_URL?.trim().replace(/\/$/, "") || null,
    model: process.env.AI_MODEL?.trim() || null,
    temperature: normalizeNumber(process.env.AI_TEMPERATURE, 0.7),
    maxTokens: normalizeNumber(process.env.AI_MAX_TOKENS, 6000),
    rateLimitWindowMs: normalizeNumber(process.env.AI_RATE_LIMIT_WINDOW_MS, 60_000),
    rateLimitMax: normalizeNumber(process.env.AI_RATE_LIMIT_MAX, 20),
    researchProvider,
    researchApiKey: process.env.RESEARCH_API_KEY?.trim() || null,
  };
}

class DisabledAiProvider implements AiChatProvider {
  readonly providerName = "disabled" as const;

  isConfigured() {
    return false;
  }

  getUnavailableReason() {
    return "AI Blog Studio is disabled. Set AI_PROVIDER to enable it.";
  }

  async complete(): Promise<string> {
    throw new Error(this.getUnavailableReason() || "AI Blog Studio is disabled.");
  }
}

class MockAiProvider implements AiChatProvider {
  readonly providerName = "mock" as const;

  isConfigured() {
    return true;
  }

  getUnavailableReason() {
    return null;
  }

  async complete(messages: AiChatMessage[]): Promise<string> {
    const lastUserMessage = [...messages].reverse().find((message) => message.role === "user")?.content || "";
    return `Mock AI response: ${lastUserMessage}`.trim();
  }
}

class OpenAiCompatibleProvider implements AiChatProvider {
  readonly providerName = "openai-compatible" as const;

  constructor(private readonly config: AiProviderConfig) {}

  isConfigured() {
    return Boolean(this.config.apiKey && this.config.baseUrl && this.config.model);
  }

  getUnavailableReason() {
    if (this.isConfigured()) return null;
    return "AI Blog Studio is not configured. Set AI_API_KEY, AI_BASE_URL, and AI_MODEL on the backend.";
  }

  async complete(messages: AiChatMessage[], options?: { temperature?: number; maxTokens?: number }): Promise<string> {
    if (!this.isConfigured()) {
      throw new Error(this.getUnavailableReason() || "AI provider is not configured.");
    }

    const maxTokens = options?.maxTokens ?? this.config.maxTokens;
    const payload: Record<string, unknown> = {
      model: this.config.model,
      messages,
      temperature: options?.temperature ?? this.config.temperature,
    };

    if (usesMaxCompletionTokens(this.config.model)) {
      payload.max_completion_tokens = maxTokens;
    } else {
      payload.max_tokens = maxTokens;
    }

    const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    const rawText = await response.text();
    let data: unknown = null;

    try {
      data = rawText ? JSON.parse(rawText) : null;
    } catch {
      data = rawText;
    }

    if (!response.ok) {
      let message = `AI request failed with status ${response.status}`;
      if (typeof data === "object" && data && "error" in data) {
        const errorValue = (data as { error?: unknown }).error;
        if (typeof errorValue === "string" && errorValue.trim()) {
          message = errorValue;
        } else if (
          errorValue &&
          typeof errorValue === "object" &&
          "message" in errorValue &&
          typeof (errorValue as { message?: unknown }).message === "string"
        ) {
          message = String((errorValue as { message: string }).message);
        }
      }

      throw new Error(message);
    }

    const content = extractContentFromCompletionResponse(data);
    if (!content) {
      throw new Error("AI response did not include any message content.");
    }

    return content;
  }
}

function extractContentFromCompletionResponse(data: unknown) {
  if (!data || typeof data !== "object") {
    return null;
  }

  const record = data as {
    choices?: Array<{
      message?: {
        content?: string | Array<{ type?: string; text?: string }>;
      };
    }>;
  };

  const content = record.choices?.[0]?.message?.content;
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part?.text === "string" ? part.text : ""))
      .join("")
      .trim();
  }

  return null;
}

export function createAiChatProvider(config = getAiProviderConfig()): AiChatProvider {
  switch (config.provider) {
    case "mock":
      return new MockAiProvider();
    case "openai-compatible":
      return new OpenAiCompatibleProvider(config);
    case "disabled":
    default:
      return new DisabledAiProvider();
  }
}
