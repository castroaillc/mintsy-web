import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { toJSONSchema, type z } from "zod";

// Credentials come from ANTHROPIC_API_KEY or the active `ant auth login` profile
const client = new Anthropic();

const MODEL = "claude-opus-5-5";

type GenerateOptions<T extends z.ZodType> = {
  /** Shown in logs. */
  label: string;
  schema: T;
  system: string;
  messages: Anthropic.Beta.BetaMessageParam[];
  effort?: "low" | "medium" | "high" | "xhigh" | "max";
};

/** One structured-output call to Claude; returns the parsed object or throws with the reason. */
export async function generate<T extends z.ZodType>({
  label,
  schema,
  system,
  messages,
  effort = "high",
}: GenerateOptions<T>): Promise<z.infer<T>> {
  const started = Date.now();
  const response = await client.beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    // On a safety decline, the API retries on a fallback model it picks by refusal category
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort, format: betaZodOutputFormat(schema) },
    system,
    messages,
  });

  const { input_tokens, output_tokens } = response.usage;
  const seconds = ((Date.now() - started) / 1000).toFixed(0);
  console.log(
    `  claude ${label}: ${input_tokens} in / ${output_tokens} out tokens, ${seconds}s`,
  );

  if (response.stop_reason === "refusal") {
    throw new Error(
      `Claude declined (${label}): ${response.stop_details?.explanation ?? "no explanation"}`,
    );
  }
  if (response.stop_reason === "max_tokens") {
    throw new Error(`Claude ran out of output tokens (${label})`);
  }
  if (!response.parsed_output)
    throw new Error(`Claude returned no parseable output (${label})`);
  return response.parsed_output;
}

/**
 * Like `generate`, for schemas too nested for constrained decoding: the JSON Schema goes in the
 * prompt and the reply is validated here. Returns the parsed object, or the problems to send back.
 */
export async function generateJson<T extends z.ZodType>({
  label,
  schema,
  system,
  messages,
  effort = "high",
}: GenerateOptions<T>): Promise<
  { data: z.infer<T>; raw: string } | { problems: string[]; raw: string }
> {
  const started = Date.now();
  const jsonSchema = JSON.stringify(toJSONSchema(schema));
  // Streamed because long replies would hit the SDK's non-streaming timeout guard
  const response = await client.beta.messages
    .stream({
      model: MODEL,
      max_tokens: 32000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort },
      system: `${system}\n\nReply with only a JSON object (no prose, no code fences) that matches this JSON Schema:\n${jsonSchema}`,
      messages,
    })
    .finalMessage();

  const { input_tokens, output_tokens } = response.usage;
  const seconds = ((Date.now() - started) / 1000).toFixed(0);
  console.log(
    `  claude ${label}: ${input_tokens} in / ${output_tokens} out tokens, ${seconds}s`,
  );
  if (response.stop_reason === "refusal") {
    throw new Error(
      `Claude declined (${label}): ${response.stop_details?.explanation ?? "no explanation"}`,
    );
  }
  if (response.stop_reason === "max_tokens")
    throw new Error(`Claude ran out of output tokens (${label})`);

  const raw = response.content
    .flatMap((block) => (block.type === "text" ? [block.text] : []))
    .join("")
    .trim()
    .replace(/^```(?:json)?\s*|\s*```$/g, "");
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (err) {
    return {
      problems: [`The reply was not valid JSON: ${(err as Error).message}`],
      raw,
    };
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return {
      problems: parsed.error.issues
        .slice(0, 20)
        .map(
          (issue) => `At ${issue.path.join(".") || "(root)"}: ${issue.message}`,
        ),
      raw,
    };
  }
  return { data: parsed.data, raw };
}
