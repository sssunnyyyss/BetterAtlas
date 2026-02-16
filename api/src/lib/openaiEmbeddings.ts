import { env } from "../config/env.js";

function tryParseJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function openAiEmbedText({
  input,
  model = (process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small").trim(),
  timeoutMs = 15_000,
}: {
  input: string | string[];
  model?: string;
  timeoutMs?: number;
}): Promise<number[] | number[][]> {
  if (!env.openaiApiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model, input }),
      signal: controller.signal,
    });

    const bodyText = await res.text();
    if (!res.ok) {
      throw new Error(`OpenAI embeddings error (${res.status}): ${bodyText}`);
    }

    const data = tryParseJson(bodyText);
    const list = Array.isArray(data?.data) ? (data.data as any[]) : null;
    if (!list) {
      throw new Error("OpenAI embeddings response missing data list");
    }

    const embeddings = list
      .map((d) => ({ index: Number(d?.index ?? 0), embedding: d?.embedding }))
      .sort((a, b) => a.index - b.index)
      .map((d) => d.embedding)
      .filter((e) => Array.isArray(e));

    if (typeof input === "string") {
      const first = embeddings[0];
      if (!Array.isArray(first)) throw new Error("OpenAI embeddings response missing embedding");
      return first as number[];
    }

    if (embeddings.length !== input.length) {
      throw new Error(
        `OpenAI embeddings response count mismatch: expected ${input.length}, got ${embeddings.length}`
      );
    }

    return embeddings as number[][];
  } catch (e: any) {
    if (e?.name === "AbortError") {
      throw new Error(`OpenAI embeddings request timed out after ${timeoutMs}ms`);
    }
    throw e;
  } finally {
    clearTimeout(t);
  }
}

