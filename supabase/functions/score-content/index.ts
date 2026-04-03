import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit } from "../_shared/rate-limit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") || "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_TIMEOUT_MS = 30_000;

const SYSTEM_PROMPT = `Você é o avaliador de performance da marca. Analise conteúdos e atribua um score de potencial de performance baseado no cérebro da marca.

Avalie 5 dimensões (0-20 pontos cada, total máx 100):
1. ICP_ALIGNMENT: Quão bem o conteúdo fala com o público-alvo definido
2. HOOK_STRENGTH: Força do gancho — captura atenção nos primeiros 3 segundos?
3. STRUCTURE: Segue a estrutura definida nas regras? (gancho → tensão → solução → CTA)
4. CLARITY: Texto claro, direto, sem enrolação, alinhado com o tom de voz
5. PATTERN_MATCH: Quão parecido com os padrões que já funcionaram (learnings)

FORMATO: JSON exato:
{
  "total": 0-100,
  "dimensions": {
    "icp_alignment": { "score": 0-20, "note": "1 frase" },
    "hook_strength": { "score": 0-20, "note": "1 frase" },
    "structure": { "score": 0-20, "note": "1 frase" },
    "clarity": { "score": 0-20, "note": "1 frase" },
    "pattern_match": { "score": 0-20, "note": "1 frase" }
  },
  "top_issue": "O principal problema a corrigir (1 frase) ou null se score >= 80"
}`;

function safeParseJson(raw: string): Record<string, unknown> {
  try { return JSON.parse(raw); } catch { /* */ }
  const stripped = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  try { return JSON.parse(stripped); } catch { /* */ }
  const match = stripped.match(/\{[\s\S]*\}/);
  if (match) { try { return JSON.parse(match[0]); } catch { /* */ } }
  throw new Error("JSON inválido");
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
      const _rlErr = await checkRateLimit(_rl, user.id, { action: "score_content", windowMinutes: 60, maxRequests: 30 });
      if (_rlErr) return new Response(JSON.stringify({ error: _rlErr }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }


    const body = await req.json();
    const text = typeof body.text === "string" ? body.text.slice(0, 3000) : "";
    const title = typeof body.title === "string" ? body.title : "";
    const cta = typeof body.cta === "string" ? body.cta : "";

    if (!text.trim()) {
      return new Response(JSON.stringify({ error: "Texto é obrigatório." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);
    const { data: cfg } = await supabase.from("company_config").select("*").limit(1).single();

    let brainBlock = "";
    if (cfg) {
      const icp = cfg.icp_json as Record<string, string> | null;
      const ed = cfg.editorial_guidelines_json as Record<string, string> | null;
      const voice = cfg.voice_tone_json as Record<string, string> | null;
      const rules = cfg.rules_json as Record<string, string> | null;
      const learn = cfg.learnings_json as Record<string, string[]> | null;

      const parts: string[] = [];
      if (icp?.persona) parts.push(`ICP: ${icp.persona}`);
      if (icp?.pain_points) parts.push(`Dores: ${icp.pain_points}`);
      if (ed?.positioning) parts.push(`Posicionamento: ${ed.positioning}`);
      if (ed?.hook_patterns) parts.push(`Ganchos preferidos: ${ed.hook_patterns}`);
      if (ed?.copy_style) parts.push(`Estilo: ${ed.copy_style}`);
      if (voice?.voice) parts.push(`Voz: ${voice.voice}`);
      if (rules?.content_structure) parts.push(`Estrutura: ${rules.content_structure}`);
      if (rules?.always_include) parts.push(`Deve conter: ${rules.always_include}`);
      if (rules?.never_include) parts.push(`Proibido: ${rules.never_include}`);
      if (learn?.hooks?.length) parts.push(`Ganchos validados: ${learn.hooks.slice(-3).join(" | ")}`);
      if (learn?.copy_patterns?.length) parts.push(`Copy eficaz: ${learn.copy_patterns.slice(-3).join(" | ")}`);

      if (parts.length > 0) brainBlock = `\n\nCÉREBRO DA MARCA:\n${parts.join("\n")}`;
    }

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
            contents: [{ role: "user", parts: [{ text: `Título: ${title}\nCTA: ${cta}\n\nTexto:\n${text}${brainBlock}` }] }],
            generationConfig: { temperature: 0.2, responseMimeType: "application/json" },
          }),
        },
      );
    } catch (err: any) {
      clearTimeout(timeout);
      if (err?.name === "AbortError") throw new Error("Timeout");
      throw err;
    }
    clearTimeout(timeout);

    if (!res.ok) throw new Error(`Gemini error: ${res.status}`);

    const data = await res.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) throw new Error("Resposta vazia");

    const score = safeParseJson(rawText);

    return new Response(JSON.stringify({ score }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[score-content]", e?.message);
    return new Response(JSON.stringify({ error: e?.message || "Erro" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
