import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit } from "../_shared/rate-limit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") || "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_TIMEOUT_MS = 40_000;

const SYSTEM_PROMPT = `Você é o roteirista de carrosséis da marca. Crie roteiros slide a slide prontos para o designer executar.

REGRAS:
- Slide 1 DEVE ser um gancho forte que pare o scroll
- Slides intermediários entregam valor progressivo
- Último slide DEVE ter CTA claro
- Cada slide: texto curto (1-3 linhas), direção visual e nota para designer
- O roteiro deve funcionar como uma narrativa completa

FORMATO: JSON exato:
{
  "carousel_title": "Título do carrossel",
  "total_slides": N,
  "slides": [
    {
      "position": 1,
      "type": "hook|value|proof|transition|cta",
      "headline": "Texto principal do slide (curto, impactante)",
      "body": "Texto complementar (opcional, 1-2 linhas)",
      "visual_direction": "Direção visual para o designer",
      "designer_note": "Nota adicional (opcional)"
    }
  ]
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
    const rl = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const rlErr = await checkRateLimit(rl, user.id, { action: "generate_carousel", windowMinutes: 60, maxRequests: 20 });
    if (rlErr) return new Response(JSON.stringify({ error: rlErr }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const body = await req.json();
    const theme = typeof body.theme === "string" ? body.theme.slice(0, 500) : "";
    const baseText = typeof body.base_text === "string" ? body.base_text.slice(0, 3000) : "";
    const slideCount = Math.min(Math.max(parseInt(body.slide_count) || 5, 1), 10);
    const platform = typeof body.platform === "string" ? body.platform : "instagram";

    if (!theme && !baseText) {
      return new Response(JSON.stringify({ error: "Tema ou texto base é obrigatório." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Load brain
    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: cfg } = await supabase.from("company_config").select("*").limit(1).single();

    let brainBlock = "";
    if (cfg) {
      const icp = cfg.icp_json as Record<string, string> | null;
      const ed = cfg.editorial_guidelines_json as Record<string, string> | null;
      const voice = cfg.voice_tone_json as Record<string, string> | null;
      const rules = cfg.rules_json as Record<string, string> | null;
      const learn = cfg.learnings_json as Record<string, string[]> | null;

      const parts: string[] = [];
      if (icp?.persona) parts.push(`Público: ${icp.persona}`);
      if (ed?.hook_patterns) parts.push(`Ganchos: ${ed.hook_patterns}`);
      if (ed?.copy_style) parts.push(`Estilo: ${ed.copy_style}`);
      if (voice?.voice) parts.push(`Voz: ${voice.voice}`);
      if (rules?.content_structure) parts.push(`Estrutura: ${rules.content_structure}`);
      if (rules?.always_include) parts.push(`Incluir: ${rules.always_include}`);
      if (voice?.cta_patterns) parts.push(`CTAs: ${voice.cta_patterns}`);
      if (learn?.hooks?.length) parts.push(`Ganchos validados: ${learn.hooks.slice(-3).join(" | ")}`);
      if (parts.length > 0) brainBlock = `\n\nMARCA:\n${parts.join("\n")}`;
    }

    const userPrompt = `Crie um roteiro de carrossel com ${slideCount} slides para ${platform}.
${theme ? `\nTEMA: ${theme}` : ""}
${baseText ? `\nTEXTO BASE:\n${baseText}` : ""}
${brainBlock}

Retorne JSON.`;

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
            generationConfig: { temperature: 0.7, responseMimeType: "application/json" },
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

    const carousel = safeParseJson(rawText);

    return new Response(JSON.stringify({ carousel }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[generate-carousel]", e?.message);
    return new Response(JSON.stringify({ error: e?.message || "Erro" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
