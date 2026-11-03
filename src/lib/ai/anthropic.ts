import Anthropic from "@anthropic-ai/sdk";
import { z, type ZodTypeAny } from "zod";

// Minimal server-only Anthropic client. Explicit cost tracking, Zod-validated
// JSON responses, and a single typed `generateStructured()` entry point so
// every AI feature uses the same validation + logging surface.

const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5-5";

export class AIConfigError extends Error {
  constructor() {
    super(
      "ANTHROPIC_API_KEY is not set. Add it to the environment to enable AI features.",
    );
    this.name = "AIConfigError";
  }
}

export function isAIConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

let singleton: Anthropic | null = null;
function client(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) throw new AIConfigError();
  if (!singleton) singleton = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return singleton;
}

export type GenerationResult<T> = {
  value: T;
  model: string;
  inputTokens: number;
  outputTokens: number;
};

type StructuredArgs<T extends ZodTypeAny> = {
  system: string;
  user: string;
  schema: T;
  // Short description of the structured shape — included in the prompt as guidance.
  schemaName: string;
  model?: string;
  maxTokens?: number;
};

// Ask the model to respond as a single JSON object matching `schema`. We parse
// the first ```json fenced block if present, otherwise the whole message.
// Retries once on validation failure with the error attached to the next prompt.
export async function generateStructured<T extends ZodTypeAny>(
  args: StructuredArgs<T>,
): Promise<GenerationResult<z.infer<T>>> {
  const model = args.model ?? DEFAULT_MODEL;
  const maxTokens = args.maxTokens ?? 1024;

  const baseSystem = `${args.system}

Respond with a single JSON object that validates against the schema named "${args.schemaName}".
Return ONLY JSON — no prose, no markdown fences, no explanation.`;

  let lastError: string | null = null;
  let input = 0;
  let output = 0;

  for (let attempt = 0; attempt < 2; attempt++) {
    const userContent = lastError
      ? `${args.user}\n\nThe previous attempt failed validation: ${lastError}\nReturn a corrected JSON object now.`
      : args.user;

    const resp = await client().messages.create({
      model,
      max_tokens: maxTokens,
      system: baseSystem,
      messages: [{ role: "user", content: userContent }],
    });

    input += resp.usage?.input_tokens ?? 0;
    output += resp.usage?.output_tokens ?? 0;

    const text = resp.content
      .filter((b): b is { type: "text"; text: string } => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    const json = extractJson(text);
    const parsed = args.schema.safeParse(json);
    if (parsed.success) {
      return {
        value: parsed.data as z.infer<T>,
        model,
        inputTokens: input,
        outputTokens: output,
      };
    }
    lastError = parsed.error.issues
      .slice(0, 4)
      .map((i) => `${i.path.join(".") || "root"}: ${i.message}`)
      .join("; ");
  }

  throw new Error(`AI response failed validation after retry: ${lastError ?? "unknown"}`);
}

function extractJson(text: string): unknown {
  // Prefer the first ```json ... ``` block.
  const fenced = text.match(/```json\s*([\s\S]*?)```/i) ?? text.match(/```\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1]!.trim() : text;
  try {
    return JSON.parse(candidate);
  } catch {
    // Try to find a JSON object substring.
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(candidate.slice(start, end + 1));
      } catch {
        /* fall through */
      }
    }
    throw new Error("Model did not return parseable JSON.");
  }
}
