import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { rmSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { toJSONSchema, type z } from "zod";

// Text calls run through the Claude Code CLI on the signed-in Claude subscription, never the API.
// There is deliberately no API fallback: it would bill the account this exists to avoid.

const MODEL = "claude-opus-5-5";
/** Long scene runs took minutes on the API, and the CLI retries overloads itself, so this is generous. */
const DEFAULT_TIMEOUT_MS = 30 * 60 * 1000;
const AUTH_TIMEOUT_MS = 30 * 1000;
const KILL_GRACE_MS = 10 * 1000;
/** The CLI's limit on piped stdin. */
const MAX_PROMPT_BYTES = 10 * 1024 * 1024;

const timeoutMs = () => Number(process.env.STUDIO_CLAUDE_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS;

/** Text only: the pipeline sends no images or documents, and `claude -p` here takes one text prompt. */
export type ClaudeMessage = { role: "user" | "assistant"; content: string };

type GenerateOptions<T extends z.ZodType> = {
  /** Shown in logs. */
  label: string;
  schema: T;
  system: string;
  messages: ClaudeMessage[];
  effort?: "low" | "medium" | "high" | "xhigh" | "max";
};

type RunOptions = {
  label: string;
  system: string;
  messages: ClaudeMessage[];
  effort: NonNullable<GenerateOptions<z.ZodType>["effort"]>;
  jsonSchema?: unknown;
};

/** The fields used from `--output-format json`. */
type CliResult = {
  type?: string;
  subtype?: string;
  is_error?: boolean;
  result?: string;
  structured_output?: unknown;
  stop_reason?: string | null;
  terminal_reason?: string;
  api_error_status?: number | null;
  errors?: string[];
  usage?: {
    input_tokens?: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
    output_tokens?: number;
  };
  modelUsage?: Record<string, unknown>;
};

type Finished = { stdout: string; stderr: string; code: number | null; signal: NodeJS.Signals | null; timedOut: boolean };

/**
 * The child's environment. Any of these would move the run off the subscription without saying so:
 * an API key or auth token wins over the login, and with no login the CLI falls back to the
 * `ant auth login` profile, which bills the API. ANTHROPIC_CONFIG_DIR points that lookup at nothing.
 * CLAUDE_CODE_SIMPLE is what --bare sets, and bare mode can't read the subscription login.
 * DISABLE_COMPACT makes a book too big for the context window fail rather than get summarized.
 */
function childEnv(emptyDir: string) {
  const env: NodeJS.ProcessEnv = { ...process.env };
  for (const key of Object.keys(env)) {
    if (key.startsWith("ANTHROPIC_") || key === "CLAUDE_CODE_SIMPLE") delete env[key];
  }
  env.ANTHROPIC_CONFIG_DIR = emptyDir;
  env.DISABLE_COMPACT = "1";
  return env;
}

/**
 * Runs in its own process group, so the worker's first Ctrl-C ("stop after the current job") doesn't
 * reach it through the terminal. If the worker exits, or the timeout passes, the group goes too.
 */
function runCommand(args: string[], options: { cwd: string; env: NodeJS.ProcessEnv; input?: string; timeoutMs: number; onExit?: () => void }) {
  return new Promise<Finished>((resolve, reject) => {
    const child = spawn("claude", args, { cwd: options.cwd, env: options.env, detached: true, stdio: ["pipe", "pipe", "pipe"] });
    const signalGroup = (signal: NodeJS.Signals) => {
      if (!child.pid) return;
      try {
        process.kill(-child.pid, signal);
      } catch {
        // already gone
      }
    };
    const onProcessExit = () => {
      signalGroup("SIGTERM");
      options.onExit?.();
    };
    process.once("exit", onProcessExit);

    let timedOut = false;
    let forceKill: NodeJS.Timeout | undefined;
    const timer = setTimeout(() => {
      timedOut = true;
      signalGroup("SIGTERM");
      forceKill = setTimeout(() => signalGroup("SIGKILL"), KILL_GRACE_MS);
    }, options.timeoutMs);
    const cleanUp = () => {
      clearTimeout(timer);
      clearTimeout(forceKill);
      process.off("exit", onProcessExit);
    };

    const stdout: Buffer[] = [];
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => {
      stderr = (stderr + chunk.toString()).slice(-2000);
    });
    // A child that dies before reading its stdin is reported by its exit, not by this EPIPE
    child.stdin.on("error", () => undefined);
    child.stdin.end(options.input ?? "");

    child.once("error", (err: NodeJS.ErrnoException) => {
      cleanUp();
      if (err.code === "ENOENT") {
        reject(
          new Error(
            `The \`claude\` CLI isn't on this process's PATH. Install Claude Code, run \`claude auth login\`, and start the worker from a shell where \`claude\` works. PATH=${options.env.PATH ?? "(unset)"}`,
          ),
        );
      } else {
        reject(new Error(`Could not run the \`claude\` CLI: ${err.message}`));
      }
    });
    child.once("close", (code, signal) => {
      cleanUp();
      resolve({ stdout: Buffer.concat(stdout).toString(), stderr: stderr.trim(), code, signal, timedOut });
    });
  });
}

const parseJson = <V>(text: string): V | undefined => {
  try {
    return JSON.parse(text) as V;
  } catch {
    return undefined;
  }
};

/**
 * Stops before anything is sent unless the run would use the subscription. This is what makes "not
 * logged in" a clear error, and it catches what stripping the environment can't, like an apiKeyHelper
 * or a Console login. `claude auth status` exits non-zero when logged out, with its JSON on stdout.
 */
async function requireSubscriptionLogin(label: string, cwd: string, env: NodeJS.ProcessEnv) {
  const out = await runCommand(["auth", "status"], { cwd, env, timeoutMs: AUTH_TIMEOUT_MS });
  const status = parseJson<{ loggedIn?: boolean; authMethod?: string; apiProvider?: string }>(out.stdout);
  if (!status) {
    throw new Error(`Could not read \`claude auth status\` (${label}), so nothing was sent: ${out.stderr || out.stdout.slice(0, 500) || `exit ${out.code}`}`);
  }
  if (!status.loggedIn) {
    throw new Error(`The \`claude\` CLI is not logged in (${label}). Run \`claude auth login\` with your Claude subscription as the user running the worker.`);
  }
  // "oauth_token" is CLAUDE_CODE_OAUTH_TOKEN from `claude setup-token`, which is also the subscription
  const subscription = status.authMethod === "claude.ai" || (status.authMethod === "oauth_token" && Boolean(env.CLAUDE_CODE_OAUTH_TOKEN));
  if (!subscription || status.apiProvider !== "firstParty") {
    throw new Error(
      `The \`claude\` CLI would not use the Claude subscription (${label}): auth method "${status.authMethod}", provider "${status.apiProvider}". Nothing was sent. Run \`claude auth login\` with your subscription, and remove any apiKeyHelper or provider setting.`,
    );
  }
}

/**
 * `claude -p` takes one prompt, so a multi-turn conversation becomes one transcript. The tag has a
 * random suffix because earlier turns can quote book text, which must not be able to fake a turn.
 * A single message goes through untouched. Anything but text is refused rather than dropped.
 */
export function messagesToPrompt(messages: ClaudeMessage[]) {
  for (const message of messages) {
    if (typeof message.content !== "string") {
      throw new Error("Only text message content is supported: the Claude CLI path can't send images or documents.");
    }
  }
  const last = messages[messages.length - 1];
  if (!last || last.role !== "user") throw new Error("The conversation must end with a user message.");
  if (messages.length === 1) return last.content;

  const tag = `turn-${randomBytes(4).toString("hex")}`;
  const turns = messages.map((m) => `<${tag} role="${m.role}">\n${m.content}\n</${tag}>`).join("\n\n");
  return `This is the conversation so far, oldest first, with each turn in a <${tag}> tag. The assistant turns are your own earlier replies. Respond now to the final user turn only, in the form the system prompt asks for, with no tags.\n\n${turns}`;
}

/** Throws with the reason unless the run ended normally. */
function throwIfFailed(label: string, out: Finished, result: CliResult) {
  const message = result.result?.trim() || result.errors?.join("; ") || out.stderr || "no detail";
  if (result.stop_reason === "refusal") throw new Error(`Claude declined (${label}): ${message}`);
  if (result.stop_reason === "max_tokens") throw new Error(`Claude ran out of output tokens (${label})`);

  const failed = result.is_error === true || (result.subtype !== undefined && result.subtype !== "success") || out.code !== 0;
  if (!failed) return;

  // The text is only matched on a failed run: on a good one it's the reply, which can say anything
  if (/unable to respond to this request|can't help with this|safeguards flagged|blocked by content filtering/i.test(message)) {
    throw new Error(`Claude declined (${label}): ${message}`);
  }
  if (/exceeded the \d+ output token maximum/.test(message)) throw new Error(`Claude ran out of output tokens (${label})`);
  if (result.api_error_status === 429 || /^(You've hit your|You've reached your|You're out of usage credits|Your org is out of usage)/.test(message)) {
    throw new Error(`Claude subscription usage limit reached (${label}): ${message}`);
  }
  if (result.api_error_status === 401 || /not logged in|login expired|authentication required|please run \/login/i.test(message)) {
    throw new Error(`The \`claude\` CLI is not logged in (${label}): ${message}. Run \`claude auth login\` with your Claude subscription.`);
  }
  if (result.subtype === "error_max_structured_output_retries") {
    throw new Error(`Claude returned no parseable output (${label}): ${message}`);
  }
  const reason = result.terminal_reason ?? result.subtype;
  throw new Error(`Claude failed (${label}): ${message}${reason ? ` [${reason}]` : ""}`);
}

/** One isolated `claude -p` run. Failures inside a run are printed on stdout, so that is read before the exit code. */
async function runClaude({ label, system, messages, effort, jsonSchema }: RunOptions) {
  const prompt = messagesToPrompt(messages);
  const promptBytes = Buffer.byteLength(prompt);
  if (promptBytes > MAX_PROMPT_BYTES) {
    throw new Error(`The prompt is ${(promptBytes / 1024 / 1024).toFixed(1)} MB, over the Claude CLI's 10 MB stdin limit (${label}).`);
  }

  const root = await mkdtemp(path.join(os.tmpdir(), "mintsy-claude-"));
  const cwd = path.join(root, "cwd");
  const systemFile = path.join(root, "system-prompt.txt");
  const env = childEnv(path.join(root, "no-anthropic-config"));
  try {
    await mkdir(cwd);
    await writeFile(systemFile, system);
    await requireSubscriptionLogin(label, cwd, env);

    // Not --bare, which never reads the subscription login. No flag opts out of it, so if bare becomes
    // the default for -p these runs will fail as "not logged in". With keys stripped they can't bill the API.
    // Without bare a run discovers the user's setup, so the rest of these flags and the empty cwd turn it off.
    const args = [
      "-p",
      "--safe-mode",
      "--setting-sources",
      "",
      "--strict-mcp-config",
      "--disable-slash-commands",
      "--no-session-persistence",
      "--tools",
      "",
      "--model",
      MODEL,
      "--effort",
      effort,
      // A file because argv is limited and the collage system prompt carries a JSON Schema
      "--system-prompt-file",
      systemFile,
      "--output-format",
      "json",
    ];
    if (jsonSchema) args.push("--json-schema", JSON.stringify(jsonSchema));

    const started = Date.now();
    const limit = timeoutMs();
    const out = await runCommand(args, { cwd, env, input: prompt, timeoutMs: limit, onExit: () => rmSync(root, { recursive: true, force: true }) });
    if (out.timedOut) {
      throw new Error(`Claude timed out after ${(limit / 1000).toFixed(0)}s and was killed (${label}). STUDIO_CLAUDE_TIMEOUT_MS sets the limit.`);
    }

    const result = parseJson<CliResult>(out.stdout.trim());
    if (!result || result.type !== "result") {
      const detail = out.stderr || out.stdout.slice(0, 500) || "no output";
      throw new Error(`The \`claude\` CLI ${out.signal ? `was stopped by ${out.signal}` : `exited with code ${out.code}`} without a result (${label}): ${detail}`);
    }

    const usage = result.usage ?? {};
    // input_tokens alone leaves out the prompt, because the CLI caches it
    const inputTokens = (usage.input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0);
    const outputTokens = usage.output_tokens ?? 0;
    if (inputTokens > 0 || outputTokens > 0) {
      const seconds = ((Date.now() - started) / 1000).toFixed(0);
      console.log(`  claude ${label}: ${inputTokens} in / ${outputTokens} out tokens, ${seconds}s`);
    }
    // The CLI can re-run a flagged request on another model, so say when the reply isn't from MODEL
    const otherModels = Object.keys(result.modelUsage ?? {}).filter((model) => model !== MODEL);
    if (otherModels.length > 0) console.warn(`  claude ${label}: also answered by ${otherModels.join(", ")}`);

    throwIfFailed(label, out, result);
    return result;
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

/** One structured-output call to Claude; returns the parsed object or throws with the reason. */
export async function generate<T extends z.ZodType>({
  label,
  schema,
  system,
  messages,
  effort = "high",
}: GenerateOptions<T>): Promise<z.infer<T>> {
  // The CLI rejects zod's `$schema` line: "no schema with key or ref .../draft/2020-12/schema"
  const { $schema: _draft, ...jsonSchema } = toJSONSchema(schema);
  const result = await runClaude({ label, system, messages, effort, jsonSchema });

  // Absent when the run ended without valid structured output, usually a decline in plain text
  if (result.structured_output === undefined) {
    throw new Error(`Claude declined (${label}): it ended without structured output: ${result.result?.trim() || "no explanation"}`);
  }
  const parsed = schema.safeParse(result.structured_output);
  if (!parsed.success) {
    const problems = parsed.error.issues.slice(0, 20).map((issue) => `At ${issue.path.join(".") || "(root)"}: ${issue.message}`);
    throw new Error(`Claude returned no parseable output (${label}):\n${problems.join("\n")}`);
  }
  return parsed.data;
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
  const jsonSchema = JSON.stringify(toJSONSchema(schema));
  const result = await runClaude({
    label,
    system: `${system}\n\nReply with only a JSON object (no prose, no code fences) that matches this JSON Schema:\n${jsonSchema}`,
    messages,
    effort,
  });

  const raw = (result.result ?? "").trim().replace(/^```(?:json)?\s*|\s*```$/g, "");
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
