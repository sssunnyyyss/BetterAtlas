import { env } from "../config/env.js";

export type OpenAiChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type OpenAiResponseFormat = { type: "json_object" };

function tryParseJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function extractJsonObject(text: string) {
  const trimmed = text.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return trimmed;
  }

  // Best-effort recovery if the model adds extra text.
  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) {
    return trimmed.slice(first, last + 1);
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
}: {
  messages: OpenAiChatMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: OpenAiResponseFormat;
  timeoutMs?: number;
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

  const jsonText = extractJsonObject(raw);
  if (!jsonText) {
    throw new Error("OpenAI response did not contain a JSON object");
  }

  try {
    return { raw, parsed: JSON.parse(jsonText) };
  } catch {
    throw new Error("Failed to parse JSON from OpenAI response");
  }
}
