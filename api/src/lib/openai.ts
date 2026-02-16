import { env } from "../config/env.js";

export type OpenAiChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type OpenAiJsonSchema = {
  name: string;
  schema: Record<string, unknown>;
  strict?: boolean;
};
type OpenAiResponseFormat =
  | { type: "json_object" }
  | { type: "json_schema"; json_schema: OpenAiJsonSchema };

function tryParseJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function normalizeCandidateJson(text: string) {
  return text
    .replace(/^\uFEFF/, "")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'");
}

function stripTrailingCommas(text: string) {
  return text.replace(/,\s*([}\]])/g, "$1");
}

function extractJsonFenceBlocks(text: string) {
  const out: string[] = [];
  const re = /```(?:json)?\s*([\s\S]*?)```/gi;
  let m: RegExpExecArray | null = null;
  while ((m = re.exec(text)) !== null) {
    const block = String(m[1] ?? "").trim();
    if (block) out.push(block);
  }
  return out;
}

function extractBalancedJsonObjects(text: string) {
  const out: string[] = [];
  const n = text.length;

  for (let i = 0; i < n; i++) {
    if (text[i] !== "{") continue;

    let depth = 0;
    let inString = false;
    let escaping = false;

    for (let j = i; j < n; j++) {
      const ch = text[j];

      if (inString) {
        if (escaping) {
          escaping = false;
        } else if (ch === "\\") {
          escaping = true;
        } else if (ch === '"') {
          inString = false;
        }
        continue;
      }

      if (ch === '"') {
        inString = true;
        continue;
      }
      if (ch === "{") {
        depth += 1;
        continue;
      }
      if (ch === "}") {
        depth -= 1;
        if (depth === 0) {
          out.push(text.slice(i, j + 1));
          break;
        }
        if (depth < 0) break;
      }
    }
  }

  return out;
}

function extractJsonCandidates(text: string) {
  const trimmed = text.trim();
  const seeds = [trimmed, ...extractJsonFenceBlocks(trimmed)];
  const out: string[] = [];
  const seen = new Set<string>();

  for (const seed of seeds) {
    const normalizedSeed = normalizeCandidateJson(seed).trim();
    if (!normalizedSeed) continue;

    if (normalizedSeed.startsWith("{") && normalizedSeed.endsWith("}")) {
      if (!seen.has(normalizedSeed)) {
        seen.add(normalizedSeed);
        out.push(normalizedSeed);
      }
    }

    const balanced = extractBalancedJsonObjects(normalizedSeed);
    for (const chunk of balanced) {
      const c = normalizeCandidateJson(chunk).trim();
      if (!c || seen.has(c)) continue;
      seen.add(c);
      out.push(c);
    }
  }

  return out;
}

function tryParseJsonCandidates(raw: string): unknown | null {
  const candidates = extractJsonCandidates(raw);
  if (candidates.length === 0) return null;

  // Prefer bigger candidates first, then fallback to small fragments.
  const sorted = [...candidates].sort((a, b) => b.length - a.length);

  for (const candidate of sorted) {
    const attempts = [candidate, stripTrailingCommas(candidate)];
    for (const attempt of attempts) {
      const parsed = tryParseJson(attempt);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed;
      }
    }
  }

  return null;
}

export async function openAiChatJson({
  messages,
  model = env.openaiModel,
  temperature,
  maxTokens,
  responseFormat,
  timeoutMs = 35_000,
  enableRepairRetry = true,
}: {
  messages: OpenAiChatMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: OpenAiResponseFormat;
  timeoutMs?: number;
  enableRepairRetry?: boolean;
}): Promise<{ raw: string; parsed: unknown }> {
  if (!env.openaiApiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  async function doRequest(payload: any) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.openaiApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      const bodyText = await res.text();
      return { res, bodyText };
    } catch (e: any) {
      if (e?.name === "AbortError") {
        throw new Error(`OpenAI request timed out after ${timeoutMs}ms`);
      }
      throw e;
    } finally {
      clearTimeout(t);
    }
  }

  const payload: any = { model, messages };
  if (temperature !== undefined) payload.temperature = temperature;
  if (maxTokens !== undefined) payload.max_tokens = maxTokens;
  if (responseFormat) payload.response_format = responseFormat;

  let { res, bodyText } = await doRequest(payload);

  function isUnsupportedParam(paramName: string) {
    const err = tryParseJson(bodyText);
    const param = err?.error?.param;
    const code = err?.error?.code;
    const msg = String(err?.error?.message || "").toLowerCase();
    return (
      param === paramName ||
      (code === "unsupported_value" && msg.includes(paramName.replace("_", " "))) ||
      (code === "unknown_parameter" && msg.includes(paramName))
    );
  }

  // Some models reject optional parameters; retry without them.
  if (!res.ok && res.status === 400 && payload.temperature !== undefined && isUnsupportedParam("temperature")) {
    delete payload.temperature;
    ({ res, bodyText } = await doRequest(payload));
  }

  if (!res.ok && res.status === 400 && payload.response_format && isUnsupportedParam("response_format")) {
    delete payload.response_format;
    ({ res, bodyText } = await doRequest(payload));
  }

  if (!res.ok && res.status === 400 && payload.max_tokens !== undefined && isUnsupportedParam("max_tokens")) {
    delete payload.max_tokens;
    ({ res, bodyText } = await doRequest(payload));
  }

  if (!res.ok) {
    throw new Error(`OpenAI error (${res.status}): ${bodyText}`);
  }

  let data: any;
  try {
    data = JSON.parse(bodyText);
  } catch {
    throw new Error("OpenAI returned invalid JSON response envelope");
  }

  const raw: string | undefined = data?.choices?.[0]?.message?.content;
  if (!raw || typeof raw !== "string") {
    throw new Error("OpenAI response missing message content");
  }

  const parsed = tryParseJsonCandidates(raw);
  if (parsed !== null) {
    return { raw, parsed };
  }

  if (enableRepairRetry) {
    const repairMessages: OpenAiChatMessage[] = [
      ...messages,
      {
        role: "assistant",
        content: raw,
      },
      {
        role: "user",
        content:
          "Return ONLY one valid JSON object. No markdown. No prose. No code fences. Keep the exact same schema and intent.",
      },
    ];

    const repairPayload: any = {
      ...payload,
      messages: repairMessages,
    };
    if (payload.temperature !== undefined) repairPayload.temperature = 0;
    if (payload.max_tokens !== undefined) repairPayload.max_tokens = payload.max_tokens;
    if (payload.response_format !== undefined) repairPayload.response_format = payload.response_format;

    ({ res, bodyText } = await doRequest(repairPayload));
    if (res.ok) {
      const repairEnvelope = tryParseJson(bodyText);
      const repairRaw: string | undefined = repairEnvelope?.choices?.[0]?.message?.content;
      if (repairRaw && typeof repairRaw === "string") {
        const repairParsed = tryParseJsonCandidates(repairRaw);
        if (repairParsed !== null) {
          return { raw: repairRaw, parsed: repairParsed };
        }
      }
    }
  }

  throw new Error("Failed to parse JSON from OpenAI response");
}
