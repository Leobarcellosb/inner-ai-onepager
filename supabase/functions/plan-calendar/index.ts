import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit } from "../_shared/rate-limit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") || "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GEMINI_MODEL = "gemini-2.0-flash";
const GEMINI_TIMEOUT_MS = 50_000;

const SYSTEM_PROMPT = `Você é o planejador editorial de uma marca. Crie um calendário de conteúdo semanal distribuindo ideias nos dias disponíveis.

REGRAS DE DISTRIBUIÇÃO:
- Nunca repetir o mesmo pilar em dias consecutivos
- Alternar formatos (não colocar 2 carrosseis seguidos, por exemplo)
- Equilibrar objetivos (educar, engajar, converter) ao longo da semana
- Respeitar a plataforma de cada ideia
- Distribuir uniformemente nos dias disponíveis
- Sugerir horário ideal baseado na plataforma (Instagram: 10h ou 18h, LinkedIn: 8h ou 12h, TikTok: 19h ou 21h, YouTube: 14h ou 17h)

FORMATO DE RESPOSTA:
Retorne APENAS um JSON array. Cada item:
{
  "date": "YYYY-MM-DD",
  "time": "HH:MM",
  "title": "título do conteúdo",
  "hook": "gancho",
  "format": "formato",
  "platform": "plataforma",
  "objective": "objetivo",
  "pillar": "pilar",
  "reason": "por que esse conteúdo neste dia/horário (1 frase)"
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
      const _rlErr = await checkRateLimit(_rl, user.id, { action: "plan_calendar", windowMinutes: 60, maxRequests: 10 });
      if (_rlErr) return new Response(JSON.stringify({ error: _rlErr }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }


    const body = await req.json();
    const ideas = Array.isArray(body.ideas) ? body.ideas : [];
    const startDate = typeof body.start_date === "string" ? body.start_date : new Date().toISOString().slice(0, 10);
    const postsPerWeek = Math.min(Math.max(parseInt(body.posts_per_week) || 5, 1), 14);
    const weeks = Math.min(Math.max(parseInt(body.weeks) || 1, 1), 4);

    if (ideas.length === 0) {
      return new Response(JSON.stringify({ error: "Envie pelo menos 1 ideia para distribuir." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Fetch company brain for context
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);
    const { data: cfg } = await supabase.from("company_config").select("*").limit(1).single();

    let brandBlock = "";
    if (cfg) {
      const ed = cfg.editorial_guidelines_json as Record<string, string> | null;
      const rules = cfg.rules_json as Record<string, string> | null;
      const parts: string[] = [];
      if (ed?.pillars) parts.push(`Pilares editoriais: ${ed.pillars}`);
      if (rules?.content_structure) parts.push(`Estrutura padrão: ${rules.content_structure}`);
      if (parts.length > 0) brandBlock = `\n\nCONTEXTO DA MARCA:\n${parts.join("\n")}`;
    }

    // Fetch existing scheduled contents to avoid conflicts
    const { data: existing } = await supabase
      .from("contents")
      .select("scheduled_date, scheduled_time, platform")
      .not("scheduled_date", "is", null)
      .gte("scheduled_date", startDate);
    const existingStr = (existing ?? []).map(e => `${e.scheduled_date} ${e.scheduled_time} (${e.platform})`).join(", ");
    const conflictBlock = existingStr ? `\n\nJÁ AGENDADOS (evite conflitos):\n${existingStr}` : "";

    const ideasText = ideas.map((idea: Record<string, string>, i: number) =>
      `${i + 1}. "${idea.title}" — formato: ${idea.format}, plataforma: ${idea.platform}, objetivo: ${idea.objective}, pilar: ${idea.pillar}`
    ).join("\n");

    const userPrompt = `Distribua estas ${ideas.length} ideias em ${weeks} semana(s) a partir de ${startDate}, com ${postsPerWeek} posts por semana.

IDEIAS:
${ideasText}
${conflictBlock}

Se houver mais slots que ideias, repita ou adapte ideias com ângulos diferentes. Retorne um JSON array.`;

    const fullSystem = `${SYSTEM_PROMPT}${brandBlock}`;

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
            generationConfig: { temperature: 0.7, responseMimeType: "application/json" },
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
      throw new Error(`Gemini error: ${res.status}`);
    }

    const data = await res.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) throw new Error("Resposta vazia da IA");

    const plan = safeParseJson(rawText);

    return new Response(JSON.stringify({ plan }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[plan-calendar] error:", e?.message ?? e);
    const status = e?.message?.includes("Limite") ? 429 : 500;
    return new Response(JSON.stringify({ error: e?.message || "Erro ao planejar" }), {
      status, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
