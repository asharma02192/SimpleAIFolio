import dotenv from "dotenv";
import { createResearchService } from "../services/ai/research";

dotenv.config({ quiet: true });

async function main() {
  const provider = process.env.RESEARCH_PROVIDER || "disabled";
  const apiKey = process.env.RESEARCH_API_KEY || "";

  if (provider !== "exa" || !apiKey) {
    console.log("Skipping live research verification. Set RESEARCH_PROVIDER=exa and RESEARCH_API_KEY to run it.");
    return;
  }

  const researchService = createResearchService();
  const result = await researchService.runResearch({
    topic: "AI tools for small business marketing",
    brief: {
      topic: "AI tools for small business marketing",
      audience: "Small business owners",
      goal: "Publish a practical educational guide",
      tone: "Expert but clear",
      primaryKeyword: "ai tools for small business marketing",
      secondaryKeywords: ["ai marketing tools", "small business content marketing"],
      wordCount: 1600,
      contentType: "guide",
      cta: "Book a strategy consultation",
      notes: "Focus on practical workflows.",
    },
    messages: [
      {
        role: "user",
        content: "I need a practical SEO-friendly article for small business owners.",
      },
    ],
    internalLinkSuggestions: [],
  });

  if (!Array.isArray(result.sources) || result.sources.length === 0) {
    throw new Error("Live Exa verification failed: no sources were returned.");
  }

  for (const source of result.sources) {
    if (!source.title || !source.url || !source.publisher || !source.summary) {
      throw new Error("Live Exa verification failed: source shape is incomplete.");
    }
  }

  console.log("Live Exa verification passed.");
  console.log(
    JSON.stringify(
      {
        provider: result.provider,
        sourceCount: result.sources.length,
        firstSource: {
          title: result.sources[0]?.title,
          url: result.sources[0]?.url,
          publisher: result.sources[0]?.publisher,
          publishedDate: result.sources[0]?.publishedDate,
          summary: result.sources[0]?.summary,
        },
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
