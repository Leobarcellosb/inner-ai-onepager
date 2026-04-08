import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") || "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GEMINI_MODEL = "gemini-2.0-flash";
const GEMINI_TIMEOUT_MS = 50_000;

const SYSTEM_PROMPT = `Você é um parser de planejamento editorial. Recebe texto extraído de documentos (DOCX, PDF, planilha CSV) e transforma em itens de conteúdo estruturados.

REGRAS:
- Identifique cada item de conteúdo planejado no texto
- Extraia: título, data (YYYY-MM-DD), horário (HH:MM), plataforma, formato, pilar/tema, objetivo
- Se a data não estiver explícita, use contexto ("segunda" = próxima segunda, "semana 1" = início do período)
- Se o horário não estiver explícito, sugira baseado na plataforma (Instagram: 10:00, LinkedIn: 08:00, TikTok: 19:00)
- Se a plataforma não estiver clara, infira pelo formato ou contexto
- Formatos válidos: reels, carrossel, story, post_estatico, anuncio, email, roteiro
- Plataformas válidas: instagram, tiktok, youtube, linkedin, whatsapp, multiuso

FORMATO DE RESPOSTA:
Retorne APENAS um JSON:
{
  "items": [
    {
      "title": "Título do conteúdo",
      "date": "YYYY-MM-DD ou null",
      "time": "HH:MM ou null",
      "platform": "plataforma",
      "format": "formato",
      "theme": "pilar ou tema",
      "objective": "objetivo",
      "raw_text": "texto/descrição original do item (se houver)",
      "responsible": "nome do responsável (se mencionado, senão string vazia)"
    }
  ],
  "notes": "Observações sobre itens ambíguos ou dados faltantes"
}`;

function safeParseJson(raw: string): Record<string, unknown> {
  try { return JSON.parse(raw); } catch { /* continue */ }
  const stripped = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  try { return JSON.parse(stripped); } catch { /* continue */ }
  const match = stripped.match(/\{[\s\S]*\}/);
  if (match) {
    try { return JSON.parse(match[0]); } catch { /* give up */ }
  }
  throw new Error("JSON inválido retornado pela IA");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await anonClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json();
    const text = typeof body.text === "string" ? body.text : "";
    const referenceDate = typeof body.reference_date === "string" ? body.reference_date : new Date().toISOString().slice(0, 10);

    if (!text.trim() || text.length < 10) {
      return new Response(JSON.stringify({ error: "Conteúdo do documento muito curto ou vazio." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) throw new Error("GEMINI_API_KEY não configurada");

    const userPrompt = `Data de referência (hoje): ${referenceDate}

Texto extraído do documento de planejamento editorial:

---
${text.slice(0, 15000)}
---

Extraia todos os itens de conteúdo planejados e retorne como JSON.`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

    let res: Response;
    try {
      res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
        {
          method: "POST",
          signal: controller.signal,
          headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
            contents: [{ role: "user", parts: [{ text: userPrompt }] }],
            generationConfig: { temperature: 0.3, responseMimeType: "application/json" },
          }),
        },
      );
    } catch (err: any) {
      clearTimeout(timeout);
      if (err?.name === "AbortError") throw new Error("IA não respondeu a tempo.");
      throw err;
    }
    clearTimeout(timeout);

    if (!res.ok) {
      if (res.status === 429) throw new Error("Limite de requisições atingido.");
      throw new Error(`Gemini error: ${res.status}`);
    }

    const data = await res.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) throw new Error("Resposta vazia da IA");

    const parsed = safeParseJson(rawText);

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[parse-import] error:", e?.message ?? e);
    const status = e?.message?.includes("Limite") ? 429 : 500;
    return new Response(JSON.stringify({ error: e?.message || "Erro ao processar" }), {
      status, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
