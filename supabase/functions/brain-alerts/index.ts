import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") || "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GEMINI_MODEL = "gemini-2.0-flash";
const GEMINI_TIMEOUT_MS = 40_000;

const SYSTEM_PROMPT = `Você é o monitor de qualidade estratégica de uma marca. Analise o estado atual do pipeline de conteúdo e gere alertas acionáveis.

TIPOS DE ALERTA:
- weak_content: conteúdo sem texto, sem CTA, ou com texto muito curto
- repetition: pilares ou formatos repetidos em sequência
- strategy_gap: pilares editoriais configurados que não têm conteúdo planejado
- stale_content: conteúdo parado no mesmo status por muito tempo
- schedule_conflict: múltiplos conteúdos na mesma data/plataforma
- missing_design: conteúdo em design sem link do Figma

FORMATO: JSON array:
[
  {
    "type": "weak_content|repetition|strategy_gap|stale_content|schedule_conflict|missing_design",
    "severity": "info|warning|critical",
    "title": "Título curto do alerta",
    "description": "Descrição acionável em 1-2 frases",
    "content_ids": ["id1"] ou [],
    "action": "Ação sugerida em 1 frase"
  }
]

Gere entre 0 e 8 alertas. Se tudo estiver bem, retorne array vazio.`;

function safeParseJson(raw: string): unknown[] {
  try { return JSON.parse(raw); } catch { /* */ }
  const stripped = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  try { return JSON.parse(stripped); } catch { /* */ }
  const match = stripped.match(/\[[\s\S]*\]/);
  if (match) { try { return JSON.parse(match[0]); } catch { /* */ } }
  return [];
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

    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Load pipeline state
    const { data: contents } = await supabase.from("contents").select("id, title, status, platform, format, theme, raw_text, improved_text, cta, figma_link, scheduled_date, scheduled_time, updated_at, created_at").order("updated_at", { ascending: false }).limit(50);

    if (!contents || contents.length === 0) {
      return new Response(JSON.stringify({ alerts: [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Load brain config
    const { data: cfg } = await supabase.from("company_config").select("editorial_guidelines_json, rules_json").limit(1).single();
    const ed = cfg?.editorial_guidelines_json as Record<string, string> | null;
    const pillars = ed?.pillars || "";

    // Build pipeline summary for AI
    const statusCounts: Record<string, number> = {};
    const platformCounts: Record<string, number> = {};
    const themeList: string[] = [];
    const issues: string[] = [];

    for (const c of contents) {
      statusCounts[c.status] = (statusCounts[c.status] || 0) + 1;
      platformCounts[c.platform] = (platformCounts[c.platform] || 0) + 1;
      if (c.theme) themeList.push(c.theme);

      // Detect weak content
      const hasText = (c.raw_text?.trim() || c.improved_text?.trim());
      if (!hasText && c.status !== 'idea') issues.push(`"${c.title}" (${c.status}) sem texto`);
      if (!c.cta?.trim() && ['copy_review','copy_approved','design_queue','designing','final_review','approved'].includes(c.status)) issues.push(`"${c.title}" sem CTA`);
      if (['designing','final_review'].includes(c.status) && !c.figma_link?.trim()) issues.push(`"${c.title}" em design sem Figma`);

      // Detect stale
      const daysSinceUpdate = (Date.now() - new Date(c.updated_at).getTime()) / 86400000;
      if (daysSinceUpdate > 5 && !['published','scheduled'].includes(c.status)) issues.push(`"${c.title}" parado há ${Math.round(daysSinceUpdate)} dias em ${c.status}`);
    }

    // Check schedule conflicts
    const dateMap: Record<string, string[]> = {};
    for (const c of contents) {
      if (c.scheduled_date) {
        const key = `${c.scheduled_date}_${c.platform}`;
        (dateMap[key] ??= []).push(c.title);
      }
    }
    for (const [key, titles] of Object.entries(dateMap)) {
      if (titles.length > 1) issues.push(`${titles.length} posts na mesma data/plataforma: ${key.replace('_',' ')}`);
    }

    const summary = `Pipeline: ${contents.length} conteúdos
Status: ${Object.entries(statusCounts).map(([k,v]) => `${k}=${v}`).join(", ")}
Plataformas: ${Object.entries(platformCounts).map(([k,v]) => `${k}=${v}`).join(", ")}
Temas usados: ${[...new Set(themeList)].join(", ") || "nenhum"}
Pilares configurados: ${pillars || "não definidos"}
Problemas detectados: ${issues.length > 0 ? issues.join("; ") : "nenhum"}`;

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
            contents: [{ role: "user", parts: [{ text: `Analise este pipeline e gere alertas:\n\n${summary}` }] }],
            generationConfig: { temperature: 0.3, responseMimeType: "application/json" },
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
    const alerts = rawText ? safeParseJson(rawText) : [];

    return new Response(JSON.stringify({ alerts }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[brain-alerts]", e?.message);
    return new Response(JSON.stringify({ alerts: [], error: e?.message }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
