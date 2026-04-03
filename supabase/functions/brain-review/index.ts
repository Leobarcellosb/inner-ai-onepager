import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit } from "../_shared/rate-limit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") || "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_TIMEOUT_MS = 40_000;

const SYSTEM_PROMPT = `Você é o revisor de qualidade da marca. Avalie conteúdos antes da aprovação comparando com o cérebro da marca: ICP, linha editorial, tom de voz, regras e padrões aprendidos.

REGRAS DE AVALIAÇÃO:
- Analise alinhamento com o público-alvo (ICP)
- Verifique consistência com o tom de voz configurado
- Confirme presença dos elementos obrigatórios (always_include)
- Detecte elementos proibidos (never_include, termos banidos)
- Verifique se a estrutura segue o padrão configurado
- Compare com padrões que funcionaram (learnings)
- Seja prático e direto nas sugestões

FORMATO DE RESPOSTA:
Retorne APENAS um JSON:
{
  "alignment_score": 0-100,
  "verdict": "approved" | "needs_revision" | "rejected",
  "strengths": ["ponto forte 1", "ponto forte 2"],
  "issues": ["problema 1", "problema 2"],
  "suggestions": ["sugestão concreta 1", "sugestão concreta 2"],
  "summary": "resumo em 1-2 frases da avaliação"
}`;

function safeParseJson(raw: string): Record<string, unknown> {
  try { return JSON.parse(raw); } catch { /* continue */ }
  const stripped = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  try { return JSON.parse(stripped); } catch { /* continue */ }
  const match = stripped.match(/\{[\s\S]*\}/);
  if (match) { try { return JSON.parse(match[0]); } catch { /* give up */ } }
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
      const _rlErr = await checkRateLimit(_rl, user.id, { action: "brain_review", windowMinutes: 60, maxRequests: 20 });
      if (_rlErr) return new Response(JSON.stringify({ error: _rlErr }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }


    const body = await req.json();
    const contentText = typeof body.text === "string" ? body.text.slice(0, 5000) : "";
    const contentTitle = typeof body.title === "string" ? body.title : "";
    const contentCta = typeof body.cta === "string" ? body.cta : "";
    const contentPlatform = typeof body.platform === "string" ? body.platform : "";
    const contentFormat = typeof body.format === "string" ? body.format : "";

    if (!contentText.trim()) {
      return new Response(JSON.stringify({ error: "Texto do conteúdo é obrigatório." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
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

      const parts: string[] = [];

      // Strategy
      if (icp?.persona) parts.push(`ICP: ${icp.persona}`);
      if (icp?.pain_points) parts.push(`Dores do público: ${icp.pain_points}`);
      if (ed?.positioning) parts.push(`Posicionamento: ${ed.positioning}`);
      if (ed?.pillars) parts.push(`Pilares: ${ed.pillars}`);
      if (ed?.hook_patterns) parts.push(`Ganchos preferidos: ${ed.hook_patterns}`);
      if (ed?.copy_style) parts.push(`Estilo de copy: ${ed.copy_style}`);
      if (voice?.voice) parts.push(`Voz: ${voice.voice}`);

      // Rules (the things to check against)
      const checks: string[] = [];
      if (rules?.content_structure) checks.push(`Estrutura obrigatória: ${rules.content_structure}`);
      if (rules?.always_include) checks.push(`DEVE conter: ${rules.always_include}`);
      if (rules?.never_include) checks.push(`NÃO PODE conter: ${rules.never_include}`);
      if (voice?.forbidden_terms) checks.push(`Termos banidos: ${voice.forbidden_terms}`);
      if (voice?.preferred_terms) checks.push(`Termos preferidos: ${voice.preferred_terms}`);
      if (voice?.cta_patterns) checks.push(`Padrões de CTA: ${voice.cta_patterns}`);
      if (rules?.content_rules) checks.push(`Regras adicionais: ${rules.content_rules}`);

      // Learnings
      const lp: string[] = [];
      if (learn?.hooks?.length) lp.push(`Ganchos validados: ${learn.hooks.slice(-3).join(" | ")}`);
      if (learn?.copy_patterns?.length) lp.push(`Padrões de copy: ${learn.copy_patterns.slice(-3).join(" | ")}`);

      if (parts.length > 0) brainBlock += `\nCONTEXTO DA MARCA:\n${parts.join("\n")}`;
      if (checks.length > 0) brainBlock += `\n\nREGRAS PARA VERIFICAR:\n${checks.map((c, i) => `${i+1}. ${c}`).join("\n")}`;
      if (lp.length > 0) brainBlock += `\n\nPADRÕES QUE FUNCIONARAM:\n${lp.join("\n")}`;
    }

    // Knowledge base
    let knowledgeBlock = "";
    try {
      const { data: kb } = await supabase.from("knowledge_entries")
        .select("extracted_insights").order("created_at", { ascending: false }).limit(3);
      if (kb) {
        const insights = kb.flatMap((e: any) => Array.isArray(e.extracted_insights) ? e.extracted_insights : []);
        if (insights.length > 0) knowledgeBlock = `\n\nCONHECIMENTO ADICIONAL:\n${insights.slice(0, 5).join("\n")}`;
      }
    } catch { /* no knowledge */ }

    // Decision memory
    let memoryBlock = "";
    try {
      const { data: rejections } = await supabase.from("brain_memories")
        .select("context").eq("memory_type", "rejection")
        .order("created_at", { ascending: false }).limit(5);
      if (rejections?.length) {
        const reasons = rejections.map((r: any) => r.context?.reason || r.context?.feedback).filter(Boolean);
        if (reasons.length > 0) memoryBlock = `\n\nREJEIÇÕES ANTERIORES (verificar se repete):\n${reasons.join("\n")}`;
      }
    } catch { /* no memories */ }

    const userPrompt = `Avalie este conteúdo para aprovação:

TÍTULO: ${contentTitle}
PLATAFORMA: ${contentPlatform}
FORMATO: ${contentFormat}
CTA: ${contentCta}

TEXTO:
${contentText}
${brainBlock}${knowledgeBlock}${memoryBlock}

Retorne a avaliação como JSON.`;

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

    const review = safeParseJson(rawText);

    return new Response(JSON.stringify({ review }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[brain-review] error:", e?.message ?? e);
    return new Response(JSON.stringify({ error: e?.message || "Erro na revisão" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
