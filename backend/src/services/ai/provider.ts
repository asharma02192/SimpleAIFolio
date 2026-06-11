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

export interface AiCompletionUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  estimatedCostUsd?: number;
}

export interface AiCompletionResult {
  text: string;
  provider: AiProviderName;
  model: string | null;
  latencyMs: number;
  usage?: AiCompletionUsage;
  rawFinishReason?: string | null;
}

export interface AiChatProvider {
  readonly providerName: AiProviderName;
  isConfigured(): boolean;
  getUnavailableReason(): string | null;
  complete(messages: AiChatMessage[], options?: { temperature?: number; maxTokens?: number }): Promise<AiCompletionResult>;
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

  async complete(): Promise<AiCompletionResult> {
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

  async complete(messages: AiChatMessage[]): Promise<AiCompletionResult> {
    const lastUserMessage = [...messages].reverse().find((message) => message.role === "user")?.content || "";
    const promptTokens = Math.max(1, Math.ceil(messages.map((message) => message.content.length).join("").length / 4));
    const completionTokens = Math.max(1, Math.ceil(lastUserMessage.length / 6));
    return {
      text: `Mock AI response: ${lastUserMessage}`.trim(),
      provider: this.providerName,
      model: "mock",
      latencyMs: 0,
      usage: {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
      },
      rawFinishReason: "stop",
    };
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

  async complete(messages: AiChatMessage[], options?: { temperature?: number; maxTokens?: number }): Promise<AiCompletionResult> {
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

    const startedAt = Date.now();
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

    const usage = extractUsageFromCompletionResponse(data);
    return {
      text: content,
      provider: this.providerName,
      model: this.config.model,
      latencyMs: Date.now() - startedAt,
      usage: usage ? estimateOpenAiCompatibleCost(this.config.model, usage) : undefined,
      rawFinishReason: extractFinishReason(data),
    };
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

function extractFinishReason(data: unknown) {
  if (!data || typeof data !== "object") return null;
  const record = data as { choices?: Array<{ finish_reason?: unknown }> };
  return typeof record.choices?.[0]?.finish_reason === "string"
    ? record.choices?.[0]?.finish_reason
    : null;
}

function extractUsageFromCompletionResponse(data: unknown): AiCompletionUsage | null {
  if (!data || typeof data !== "object") {
    return null;
  }

  const record = data as {
    usage?: {
      prompt_tokens?: unknown;
      completion_tokens?: unknown;
      total_tokens?: unknown;
      input_tokens?: unknown;
      output_tokens?: unknown;
    };
  };

  const promptTokens = normalizeUsageNumber(record.usage?.prompt_tokens ?? record.usage?.input_tokens);
  const completionTokens = normalizeUsageNumber(record.usage?.completion_tokens ?? record.usage?.output_tokens);
  const totalTokens = normalizeUsageNumber(record.usage?.total_tokens)
    ?? (promptTokens !== undefined || completionTokens !== undefined
      ? (promptTokens || 0) + (completionTokens || 0)
      : undefined);

  if (promptTokens === undefined && completionTokens === undefined && totalTokens === undefined) {
    return null;
  }

  return {
    promptTokens,
    completionTokens,
    totalTokens,
  };
}

function normalizeUsageNumber(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? Math.round(numeric) : undefined;
}

function estimateOpenAiCompatibleCost(model: string | null, usage: AiCompletionUsage): AiCompletionUsage {
  const totalTokens = usage.totalTokens
    ?? ((usage.promptTokens || 0) + (usage.completionTokens || 0));
  const estimatedCostUsd = estimateModelCostUsd(model, usage.promptTokens || 0, usage.completionTokens || 0);
  return {
    ...usage,
    totalTokens,
    estimatedCostUsd,
  };
}

function estimateModelCostUsd(model: string | null, promptTokens: number, completionTokens: number) {
  if (!model) return undefined;
  const normalized = model.toLowerCase();

  const pricing = normalized.startsWith("gpt-5.4")
    ? { inputPer1M: 2.5, outputPer1M: 10 }
    : normalized.startsWith("gpt-5")
      ? { inputPer1M: 2.5, outputPer1M: 10 }
      : normalized.startsWith("gpt-4.1")
        ? { inputPer1M: 2, outputPer1M: 8 }
        : null;

  if (!pricing) {
    return undefined;
  }

  const promptCost = (promptTokens / 1_000_000) * pricing.inputPer1M;
  const completionCost = (completionTokens / 1_000_000) * pricing.outputPer1M;
  return Number((promptCost + completionCost).toFixed(6));
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
