import { env } from "../config/env.js";

export type OpenAiChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

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
}: {
  messages: OpenAiChatMessage[];
  model?: string;
  temperature?: number;
}): Promise<{ raw: string; parsed: unknown }> {
  if (!env.openaiApiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  async function doRequest(payload: any) {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const bodyText = await res.text();
    return { res, bodyText };
  }

  const payload: any = { model, messages };
  if (temperature !== undefined) payload.temperature = temperature;

  let { res, bodyText } = await doRequest(payload);

  // Some models only support the default temperature and reject explicit values.
  if (!res.ok && res.status === 400 && payload.temperature !== undefined) {
    const err = tryParseJson(bodyText);
    const param = err?.error?.param;
    const code = err?.error?.code;
    const msg = String(err?.error?.message || "");
    if (param === "temperature" || (code === "unsupported_value" && msg.toLowerCase().includes("temperature"))) {
      delete payload.temperature;
      ({ res, bodyText } = await doRequest(payload));
    }
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
