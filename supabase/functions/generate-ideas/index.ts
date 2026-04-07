import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit } from "../_shared/rate-limit.ts";
import { loadBrainContext } from "../_shared/brain-context.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") || "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_TIMEOUT_MS = 45_000;

const SYSTEM_PROMPT = `Você é o estrategista de conteúdo da marca. Gere ideias que pareçam saídas de um time sênior de marketing, não de uma ferramenta genérica.

POSTURA:
- Pense como um diretor criativo que conhece profundamente o público
- Cada ideia deve atacar uma dor, desejo ou curiosidade real do ICP
- Use os padrões que JÁ FUNCIONARAM (seção PADRÕES VALIDADOS) como base — não invente do zero
- Se algo foi REJEITADO pelo time (seção MEMÓRIA), NÃO gere ideias similares
- Ângulos devem ser específicos e controversos — nunca genéricos tipo "dicas de produtividade"
- Ganchos devem parar o scroll em 2 segundos — use números, perguntas ou afirmações ousadas
- Títulos máx 80 chars, diretos, sem clickbait vazio

FORMATO DE RESPOSTA:
Retorne APENAS um JSON array com exatamente o número de ideias solicitado. Cada ideia:
{
  "title": "Título do conteúdo",
  "hook": "Gancho para capturar atenção nos primeiros 3 segundos",
  "angle": "Ângulo criativo — o que torna esta ideia diferente",
  "format": "Formato sugerido (reels, carrossel, story, post_estatico, email, roteiro)",
  "objective": "Objetivo claro (educar, converter, engajar, autoridade, awareness)",
  "pillar": "Pilar editorial ao qual pertence",
  "platform": "Plataforma ideal (instagram, tiktok, youtube, linkedin)"
}`;

function safeParseJson(raw: string): unknown[] {
  try { return JSON.parse(raw); } catch { /* continue */ }
  const stripped = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  try { return JSON.parse(stripped); } catch { /* continue */ }
  const match = stripped.match(/\[[\s\S]*\]/);
  if (match) {
    try { return JSON.parse(match[0]); } catch { /* give up */ }
  }
  throw new Error("JSON inválido retornado pela IA");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Auth
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
      const _rlErr = await checkRateLimit(_rl, user.id, { action: "generate_ideas", windowMinutes: 60, maxRequests: 10 });
      if (_rlErr) return new Response(JSON.stringify({ error: _rlErr }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }


    // Input
    const body = await req.json();
    const count = Math.min(Math.max(parseInt(body.count) || 5, 1), 15);
    const focusPlatform = typeof body.platform === "string" ? body.platform : "";
    const focusPillar = typeof body.pillar === "string" ? body.pillar : "";
    const focusTheme = typeof body.theme === "string" ? body.theme : "";

    // Fetch company brain
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: cfg } = await supabase.from("company_config").select("*").limit(1).single();

    const brainContext = await loadBrainContext(supabase);
    const fullSystem = `${SYSTEM_PROMPT}${brainContext}`;

    // Build user prompt
    const filters: string[] = [];
    if (focusPlatform) filters.push(`Plataforma: ${focusPlatform}`);
    if (focusPillar) filters.push(`Pilar editorial: ${focusPillar}`);
    if (focusTheme) filters.push(`Tema/foco: ${focusTheme}`);

    const userPrompt = `Gere ${count} ideias de conteúdo${filters.length > 0 ? ` com foco em:\n${filters.join("\n")}` : "."}\n\nRetorne um JSON array com ${count} objetos.`;

    // Call Gemini
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
            system_instruction: { parts: [{ text: fullSystem }] },
            contents: [{ role: "user", parts: [{ text: userPrompt }] }],
            generationConfig: { temperature: 0.9, responseMimeType: "application/json" },
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
      const errBody = await res.text().catch(() => "");
      if (res.status === 429) throw new Error("Limite de requisições atingido.");
      throw new Error(`Gemini error: ${res.status} — ${errBody.slice(0, 200)}`);
    }

    const data = await res.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) throw new Error("Resposta vazia da IA");

    const ideas = safeParseJson(rawText);

    return new Response(JSON.stringify({ ideas }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[generate-ideas] error:", e?.message ?? e);
    const status = e?.message?.includes("Limite") ? 429 : 500;
    return new Response(JSON.stringify({ error: e?.message || "Erro ao gerar ideias" }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
