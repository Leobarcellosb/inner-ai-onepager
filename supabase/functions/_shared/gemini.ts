const MAX_RETRIES = 2;
const RETRY_DELAYS = [2000, 5000]; // ms

/**
 * Call Gemini API with automatic retry on 503/429.
 */
export async function callGemini(
  model: string,
  apiKey: string,
  payload: Record<string, unknown>,
  timeoutMs = 50_000,
): Promise<Record<string, unknown>> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const delay = RETRY_DELAYS[attempt - 1] ?? 5000;
      console.log(`[gemini] Retry ${attempt}/${MAX_RETRIES} after ${delay}ms`);
      await new Promise((r) => setTimeout(r, delay));
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    let res: Response;
    try {
      res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          signal: controller.signal,
          headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
          body: JSON.stringify(payload),
        },
      );
    } catch (err: any) {
      clearTimeout(timeout);
      if (err?.name === "AbortError") {
        lastError = new Error("IA não respondeu a tempo.");
        continue;
      }
      throw err;
    }
    clearTimeout(timeout);

    if (res.status === 503 || res.status === 429) {
      const body = await res.text().catch(() => "");
      console.warn(`[gemini] ${res.status} on attempt ${attempt}: ${body.slice(0, 200)}`);
      lastError = new Error(
        res.status === 429
          ? "Limite de requisições da IA atingido."
          : "IA temporariamente indisponível.",
      );
      continue;
    }

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`[gemini] Error ${res.status}: ${body.slice(0, 400)}`);
      throw new Error(`Gemini API error: ${res.status}`);
    }

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("Resposta vazia da IA");

    return { text, data };
  }

  throw lastError ?? new Error("Falha após múltiplas tentativas.");
}

/**
 * Parse JSON from Gemini response, handling markdown fences.
 */
export function safeParseJson(raw: string): Record<string, unknown> {
  try { return JSON.parse(raw); } catch { /* continue */ }
  const stripped = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  try { return JSON.parse(stripped); } catch { /* continue */ }
  const match = stripped.match(/\{[\s\S]*\}/);
  if (match) {
    try { return JSON.parse(match[0]); } catch { /* give up */ }
  }
  throw new Error("JSON inválido retornado pela IA");
}
