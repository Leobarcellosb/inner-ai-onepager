import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit } from "../_shared/rate-limit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") || "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_TIMEOUT_MS = 40_000;

const SYSTEM_PROMPT = `Você é o otimizador de conteúdo da marca. Recebe um texto e o reescreve por completo para maximizar performance, seguindo rigorosamente o cérebro da marca.

OTIMIZE TODAS AS DIMENSÕES:
1. GANCHO: reescreva a abertura para capturar atenção nos primeiros 3 segundos
2. ESTRUTURA: reorganize seguindo a estrutura obrigatória da marca
3. CLAREZA: elimine enrolação, seja direto, use frases curtas
4. CTA: reescreva o call-to-action para máxima conversão
5. TOM: alinhe perfeitamente com a voz da marca
6. PADRÕES: aplique os padrões que já funcionaram (learnings)

REGRAS:
- Mantenha a essência e a mensagem central
- O texto deve sair PRONTO para publicação
- Siga todas as regras invioláveis do cérebro
- Use termos preferidos, evite termos proibidos
- Inclua elementos obrigatórios

FORMATO: JSON exato:
{
  "optimized_text": "texto completo otimizado",
  "optimized_cta": "CTA otimizado",
  "changes": ["mudança 1", "mudança 2", "mudança 3"],
  "score_before": 0-100,
  "score_after": 0-100
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
      const _rlErr = await checkRateLimit(_rl, user.id, { action: "optimize_content", windowMinutes: 60, maxRequests: 20 });
      if (_rlErr) return new Response(JSON.stringify({ error: _rlErr }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }


    const body = await req.json();
    const text = typeof body.text === "string" ? body.text.slice(0, 5000) : "";
    const title = typeof body.title === "string" ? body.title : "";
    const cta = typeof body.cta === "string" ? body.cta : "";
    const platform = typeof body.platform === "string" ? body.platform : "";
    const format = typeof body.format === "string" ? body.format : "";

    if (!text.trim()) {
      return new Response(JSON.stringify({ error: "Texto é obrigatório." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Load full brain
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

      const ctx: string[] = [];
      if (icp?.persona) ctx.push(`ICP: ${icp.persona}`);
      if (icp?.language_style) ctx.push(`Linguagem: ${icp.language_style}`);
      if (ed?.positioning) ctx.push(`Posicionamento: ${ed.positioning}`);
      if (ed?.hook_patterns) ctx.push(`Ganchos: ${ed.hook_patterns}`);
      if (ed?.copy_style) ctx.push(`Estilo: ${ed.copy_style}`);
      if (voice?.voice) ctx.push(`Voz: ${voice.voice}`);

      const rls: string[] = [];
      if (rules?.content_structure) rls.push(`ESTRUTURA: ${rules.content_structure}`);
      if (rules?.always_include) rls.push(`DEVE CONTER: ${rules.always_include}`);
      if (rules?.never_include) rls.push(`PROIBIDO: ${rules.never_include}`);
      if (voice?.forbidden_terms) rls.push(`TERMOS BANIDOS: ${voice.forbidden_terms}`);
      if (voice?.preferred_terms) rls.push(`TERMOS PREFERIDOS: ${voice.preferred_terms}`);
      if (voice?.cta_patterns) rls.push(`CTA PADRÃO: ${voice.cta_patterns}`);

      const lp: string[] = [];
      if (learn?.hooks?.length) lp.push(`Ganchos validados: ${learn.hooks.slice(-5).join(" | ")}`);
      if (learn?.copy_patterns?.length) lp.push(`Copy eficaz: ${learn.copy_patterns.slice(-3).join(" | ")}`);
      if (learn?.ctas?.length) lp.push(`CTAs: ${learn.ctas.slice(-5).join(" | ")}`);

      if (ctx.length > 0) brainBlock += `\nMARCA:\n${ctx.join("\n")}`;
      if (lp.length > 0) brainBlock += `\n\nAPRENDIZADOS:\n${lp.join("\n")}`;
      if (rls.length > 0) brainBlock += `\n\n⚠️ REGRAS:\n${rls.map((r, i) => `${i+1}. ${r}`).join("\n")}`;
    }

    // Knowledge
    try {
      const { data: kb } = await supabase.from("knowledge_entries")
        .select("extracted_insights").order("created_at", { ascending: false }).limit(3);
      if (kb) {
        const insights = kb.flatMap((e: any) => Array.isArray(e.extracted_insights) ? e.extracted_insights : []);
        if (insights.length > 0) brainBlock += `\n\nCONHECIMENTO:\n${insights.slice(0, 5).join("\n")}`;
      }
    } catch { /* */ }

    // Decision memory
    let memoryBlock = "";
    try {
      const { data: rejections } = await supabase.from("brain_memories")
        .select("context").eq("memory_type", "rejection")
        .order("created_at", { ascending: false }).limit(3);
      if (rejections?.length) {
        const reasons = rejections.map((r: any) => r.context?.reason).filter(Boolean);
        if (reasons.length > 0) memoryBlock = `\n\nERROS ANTERIORES (não repetir):\n${reasons.join("\n")}`;
      }
      const { data: opts } = await supabase.from("brain_memories")
        .select("context").eq("memory_type", "optimization")
        .order("created_at", { ascending: false }).limit(3);
      if (opts?.length) {
        const wins = opts.filter((o: any) => o.context?.improvement > 15)
          .map((o: any) => (o.context?.text_after || "").slice(0, 100));
        if (wins.length > 0) memoryBlock += `\n\nOTIMIZAÇÕES BEM-SUCEDIDAS (inspirar-se):\n${wins.join("\n")}`;
      }
    } catch { /* */ }

    const userPrompt = `Otimize completamente este conteúdo para ${platform} (${format}):

TÍTULO: ${title}
CTA ATUAL: ${cta}

TEXTO ATUAL:
${text}
${brainBlock}${memoryBlock}

Retorne JSON com texto otimizado, CTA otimizado, lista de mudanças e scores antes/depois.`;

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
            generationConfig: { temperature: 0.5, responseMimeType: "application/json" },
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

    const result = safeParseJson(rawText);

    return new Response(JSON.stringify({ result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[optimize-content]", e?.message);
    return new Response(JSON.stringify({ error: e?.message || "Erro" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
