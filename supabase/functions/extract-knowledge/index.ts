import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit } from "../_shared/rate-limit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") || "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_TIMEOUT_MS = 40_000;

const SYSTEM_PROMPT = `Você é o processador de conhecimento de uma marca. Recebe textos de documentos (PDFs, planilhas, artigos, anotações) e extrai insights estruturados para alimentar o cérebro da marca.

REGRAS:
- Extraia entre 3 e 10 insights práticos e acionáveis
- Cada insight deve ser uma frase completa e auto-explicativa
- Foque em: padrões de copy, estratégias, tom de voz, regras, aprendizados, tendências
- Ignore informações genéricas ou óbvias
- Priorize o que é único e aplicável à produção de conteúdo

FORMATO:
Retorne APENAS um JSON:
{
  "insights": ["insight 1", "insight 2", ...],
  "summary": "Resumo em 1-2 frases do que o documento contém",
  "suggested_tags": ["tag1", "tag2"]
}`;

function safeParseJson(raw: string): Record<string, unknown> {
  try { return JSON.parse(raw); } catch { /* continue */ }
  const stripped = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  try { return JSON.parse(stripped); } catch { /* continue */ }
  const match = stripped.match(/\{[\s\S]*\}/);
  if (match) {
    try { return JSON.parse(match[0]); } catch { /* give up */ }
  }
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
      const _rlErr = await checkRateLimit(_rl, user.id, { action: "extract_knowledge", windowMinutes: 60, maxRequests: 10 });
      if (_rlErr) return new Response(JSON.stringify({ error: _rlErr }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }


    const body = await req.json();
    const text = typeof body.text === "string" ? body.text.slice(0, 15000) : "";
    const title = typeof body.title === "string" ? body.title : "Documento";

    if (text.length < 20) {
      return new Response(JSON.stringify({ error: "Texto muito curto para extrair insights." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Fetch brand context to guide extraction
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);
    const { data: cfg } = await supabase.from("company_config").select("icp_json, editorial_guidelines_json").limit(1).single();

    let brandHint = "";
    if (cfg) {
      const icp = cfg.icp_json as Record<string, string> | null;
      const ed = cfg.editorial_guidelines_json as Record<string, string> | null;
      const parts: string[] = [];
      if (icp?.persona) parts.push(`Público: ${icp.persona}`);
      if (ed?.positioning) parts.push(`Posicionamento: ${ed.positioning}`);
      if (parts.length > 0) brandHint = `\n\nContexto da marca (extraia insights relevantes para este perfil):\n${parts.join("\n")}`;
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
            contents: [{ role: "user", parts: [{ text: `Documento: "${title}"\n${brandHint}\n\nTexto:\n${text}` }] }],
            generationConfig: { temperature: 0.4, responseMimeType: "application/json" },
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

    // Save to knowledge_entries
    const insights = Array.isArray(parsed.insights) ? parsed.insights : [];
    const tags = Array.isArray(parsed.suggested_tags) ? parsed.suggested_tags : [];
    const summary = typeof parsed.summary === "string" ? parsed.summary : "";

    const { data: saved, error: saveErr } = await supabase.from("knowledge_entries").insert({
      title,
      source_type: "document",
      content_text: text.slice(0, 5000),
      extracted_insights: insights,
      tags,
      created_by: user.id,
    }).select().single();
    if (saveErr) console.warn("[extract-knowledge] save error:", saveErr.message);

    // Append insights to company_config learnings
    try {
      const { data: cfgFull } = await supabase.from("company_config").select("id, learnings_json").limit(1).single();
      if (cfgFull && insights.length > 0) {
        const L = (cfgFull.learnings_json ?? {}) as Record<string, string[]>;
        const structures = Array.isArray(L.structures) ? L.structures : [];
        const MAX = 20;
        const updated = {
          ...L,
          structures: [...structures, ...insights.slice(0, 5).map((i: string) => i.slice(0, 200))].slice(-MAX),
        };
        await supabase.from("company_config").update({ learnings_json: updated }).eq("id", cfgFull.id);
      }
    } catch { /* non-blocking */ }

    return new Response(JSON.stringify({ insights, summary, tags, entry_id: saved?.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[extract-knowledge] error:", e?.message ?? e);
    return new Response(JSON.stringify({ error: e?.message || "Erro ao processar" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
