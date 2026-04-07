import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit } from "../_shared/rate-limit.ts";
import { loadBrainContext } from "../_shared/brain-context.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") || "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_TIMEOUT_MS = 45_000;

const SYSTEM_PROMPT = `Você é o estrategista de stories da marca. Gere sequências de stories completas e prontas para execução.

POSTURA:
- Stories são experiências de 15 segundos cada — cada slide compete pelo próximo tap
- Primeiro slide DEVE usar gancho validado da seção PADRÕES — não um gancho genérico
- Construa micro-tensão entre slides — curiosidade que obriga a continuar
- Texto máx 2 linhas — stories são 80% visual, 20% texto
- Direção visual deve ser específica e executável (cores, layout, elementos)
- CTA final usa padrões da marca — não "saiba mais" genérico
- Se algo foi REJEITADO na MEMÓRIA, evite abordagem similar
- Cada slide tem papel narrativo: hook → tensão → valor → prova → CTA

FORMATO DE RESPOSTA:
Retorne APENAS um JSON com:
{
  "sequence_title": "Título da sequência",
  "objective": "Objetivo da sequência completa",
  "total_slides": N,
  "slides": [
    {
      "position": 1,
      "type": "hook | value | tension | proof | cta",
      "text": "Texto do slide (curto, 1-2 linhas)",
      "visual_direction": "Direção visual (fundo, elemento, estilo)",
      "cta": "CTA do slide (se houver) ou null",
      "note": "Nota para o designer (opcional)"
    }
  ]
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

    // Rate limit
    {
      const _rl = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const _rlErr = await checkRateLimit(_rl, user.id, { action: "generate_stories", windowMinutes: 60, maxRequests: 10 });
      if (_rlErr) return new Response(JSON.stringify({ error: _rlErr }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }


    const body = await req.json();
    const topic = typeof body.topic === "string" ? body.topic.slice(0, 500) : "";
    const objective = typeof body.objective === "string" ? body.objective.slice(0, 300) : "";
    const slideCount = Math.min(Math.max(parseInt(body.slide_count) || 5, 3), 12);
    const platform = typeof body.platform === "string" ? body.platform : "instagram";

    if (!topic) {
      return new Response(JSON.stringify({ error: "Tema é obrigatório" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);
    const brandBlock = await loadBrainContext(supabase);

    const userPrompt = `Crie uma sequência de ${slideCount} stories sobre "${topic}"${objective ? ` com objetivo de ${objective}` : ""} para ${platform}.${brandBlock}`;

    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) throw new Error("GEMINI_API_KEY não configurada");

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
            generationConfig: { temperature: 0.8, responseMimeType: "application/json" },
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

    const sequence = safeParseJson(rawText);

    return new Response(JSON.stringify({ sequence }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[generate-stories] error:", e?.message ?? e);
    const status = e?.message?.includes("Limite") ? 429 : 500;
    return new Response(JSON.stringify({ error: e?.message || "Erro ao gerar stories" }), {
      status, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
