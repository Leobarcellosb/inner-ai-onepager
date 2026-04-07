import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit } from "../_shared/rate-limit.ts";
import { loadBrainContext } from "../_shared/brain-context.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") || "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_TIMEOUT_MS = 50_000;

const SYSTEM_PROMPT = `Você é o motor de autopilot de uma marca. Gere conteúdos que pareçam escritos por um copywriter sênior que conhece a marca intimamente — não por uma IA genérica.

POSTURA:
- Cada texto deve estar PRONTO para publicação — não é rascunho
- Use a IDENTIDADE DA MARCA para definir tom, abordagem e linguagem
- Aplique os PADRÕES VALIDADOS como inspiração real — eles já funcionaram
- Siga as REGRAS rigorosamente — descumprir qualquer uma invalida o conteúdo
- Se algo foi REJEITADO na MEMÓRIA, não gere nada similar
- Se algo foi APROVADO, replique o padrão com variações
- Ganchos devem usar as técnicas validadas, não clichês genéricos
- Cada conteúdo deve atacar uma dor ou desejo específico do ICP
- Alternar pilares editoriais — nunca repetir em dias consecutivos
- Alternar formatos — carrossel, reels, post, story em sequência
- Horários otimizados: Instagram 10h ou 18h, LinkedIn 8h, TikTok 19h

Para cada conteúdo gere:
1. Título (máx 80 chars, direto, sem clickbait vazio)
2. Gancho (primeira frase — deve parar o scroll)
3. Texto completo (copy pronta seguindo estrutura obrigatória)
4. CTA (usando padrões de CTA da marca)
5. Formato, plataforma, pilar, prioridade
6. Data e horário sugeridos (YYYY-MM-DD e HH:MM)

FORMATO: JSON array com objetos:
{
  "title": "...",
  "hook": "...",
  "full_text": "...",
  "cta": "...",
  "format": "reels|carrossel|story|post_estatico",
  "platform": "instagram|tiktok|youtube|linkedin",
  "pillar": "...",
  "priority": "low|medium|high|urgent",
  "date": "YYYY-MM-DD",
  "time": "HH:MM"
}`;

function safeParseJson(raw: string): unknown[] {
  try { return JSON.parse(raw); } catch { /* */ }
  const stripped = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  try { return JSON.parse(stripped); } catch { /* */ }
  const match = stripped.match(/\[[\s\S]*\]/);
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

    const body = await req.json();
    const count = Math.min(Math.max(parseInt(body.count) || 5, 1), 15);
    const startDate = typeof body.start_date === "string" ? body.start_date : new Date().toISOString().slice(0, 10);
    const autoApprove = body.auto_approve === true;
    const dryRun = body.dry_run === true;

    // Admin-only check
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);
    const { data: roleCheck } = await supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").limit(1);
    if (!roleCheck || roleCheck.length === 0) {
      return new Response(JSON.stringify({ error: "Apenas administradores podem usar o Autopilot." }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Rate limit
    const rateLimitErr = await checkRateLimit(supabase, user.id, { action: "autopilot", windowMinutes: 60, maxRequests: 5 });
    if (rateLimitErr) {
      return new Response(JSON.stringify({ error: rateLimitErr }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Load full brain
    const brainBlock = await loadBrainContext(supabase);
    if (!brainBlock) {
      return new Response(JSON.stringify({ error: "Configure o Cérebro da Marca antes de usar o autopilot." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Existing scheduled to avoid conflicts
    const { data: existing } = await supabase.from("contents")
      .select("scheduled_date, platform").not("scheduled_date", "is", null).gte("scheduled_date", startDate);
    const conflicts = (existing ?? []).map((e: any) => `${e.scheduled_date} (${e.platform})`).join(", ");
    const conflictsBlock = conflicts ? `\n\nJÁ AGENDADOS (evitar): ${conflicts}` : "";

    const userPrompt = `Gere ${count} conteúdos COMPLETOS prontos para publicação a partir de ${startDate}.${brainBlock}${conflictsBlock}\n\nRetorne JSON array.`;

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
      if (res.status === 429) throw new Error("Limite de requisições.");
      throw new Error(`Gemini error: ${res.status}`);
    }

    const data = await res.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) throw new Error("Resposta vazia da IA");

    const items = safeParseJson(rawText) as Record<string, string>[];

    // Dry run: return items for review without inserting
    if (dryRun) {
      return new Response(JSON.stringify({
        created: 0,
        items,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Insert to DB
    const validPlatforms = new Set(["instagram", "tiktok", "youtube", "linkedin", "whatsapp", "multiuso"]);
    const validFormats = new Set(["reels", "carrossel", "story", "post_estatico", "anuncio", "email", "roteiro"]);
    const validPriorities = new Set(["low", "medium", "high", "urgent"]);

    const records = items.map(item => ({
      title: (item.title || "Sem título").slice(0, 200),
      theme: item.pillar || "",
      platform: validPlatforms.has(item.platform) ? item.platform : "instagram",
      format: validFormats.has(item.format) ? item.format : "post_estatico",
      objective: "",
      raw_text: item.full_text || item.hook || "",
      cta: item.cta || "",
      created_by: user.id,
      status: autoApprove ? "copy_approved" as const : "writing" as const,
      priority: validPriorities.has(item.priority) ? item.priority : "medium",
      content_type: item.format || "post",
      scheduled_date: item.date || startDate,
      scheduled_time: item.time ? `${item.time}:00` : "10:00:00",
      source_origin: "autopilot",
      copy_auto_approved: autoApprove,
      copy_auto_approved_by: autoApprove ? user.id : null,
      copy_auto_approved_at: autoApprove ? new Date().toISOString() : null,
    }));

    const { error: insertErr } = await supabase.from("contents").insert(records);
    if (insertErr) throw insertErr;

    return new Response(JSON.stringify({
      created: records.length,
      status: autoApprove ? "copy_approved" : "writing",
      items: items.map(i => ({ title: i.title, date: i.date, platform: i.platform, format: i.format })),
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[autopilot] error:", e?.message ?? e);
    return new Response(JSON.stringify({ error: e?.message || "Erro no autopilot" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
