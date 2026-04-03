// Edge function: analyze-reference — Gemini multimodal vision (direct API)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit } from "../_shared/rate-limit.ts";
import { encodeBase64 } from "https://deno.land/std@0.224.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") || "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GEMINI_MODEL = "gemini-2.5-flash";
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const IMAGE_FETCH_TIMEOUT_MS = 12_000;
const AI_CALL_TIMEOUT_MS = 50_000;

function getMimeType(contentType: string | null, url: string): string {
  if (contentType) {
    const ct = contentType.split(";")[0].trim().toLowerCase();
    if (ct.startsWith("image/")) return ct;
  }
  const lower = url.split("?")[0].toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  return "image/jpeg";
}

async function fetchImageAsBase64(imageUrl: string): Promise<{ base64: string; mimeType: string } | null> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  try {
    // HEAD check
    try {
      const headRes = await fetch(imageUrl, { method: "HEAD" });
      const cl = headRes.headers.get("content-length");
      if (cl && parseInt(cl, 10) > MAX_IMAGE_BYTES) {
        console.warn(`[analyze] Image too large via HEAD (${cl} bytes)`);
        return null;
      }
    } catch { /* HEAD not supported */ }

    const controller = new AbortController();
    timeoutId = setTimeout(() => controller.abort(), IMAGE_FETCH_TIMEOUT_MS);

    const res = await fetch(imageUrl, {
      signal: controller.signal,
      headers: { "User-Agent": "SupabaseEdgeFunction/1.0" },
    });
    clearTimeout(timeoutId);
    timeoutId = null;

    if (!res.ok) {
      console.warn(`[analyze] Image fetch failed: HTTP ${res.status}`);
      return null;
    }

    const mimeType = getMimeType(res.headers.get("content-type"), imageUrl);
    if (!mimeType.startsWith("image/")) {
      await res.body?.cancel();
      return null;
    }

    const buffer = await res.arrayBuffer();
    if (buffer.byteLength > MAX_IMAGE_BYTES) {
      console.warn(`[analyze] Image too large (${buffer.byteLength} bytes)`);
      return null;
    }

    const base64 = encodeBase64(new Uint8Array(buffer));
    console.log(`[analyze] Image loaded: ${buffer.byteLength} bytes, ${mimeType}`);
    return { base64, mimeType };
  } catch (err: any) {
    if (timeoutId) clearTimeout(timeoutId);
    console.warn(`[analyze] Image fetch error: ${err?.name === "AbortError" ? "timeout" : err?.message}`);
    return null;
  }
}

function safeParseJson(raw: string): Record<string, string> {
  try { return JSON.parse(raw); } catch { /* continue */ }
  const stripped = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  try { return JSON.parse(stripped); } catch { /* continue */ }
  const match = stripped.match(/\{[\s\S]*\}/);
  if (match) {
    try { return JSON.parse(match[0]); } catch { /* give up */ }
  }
  throw new Error(`JSON inválido retornado pela IA: ${raw.slice(0, 300)}`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

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
      const _rlErr = await checkRateLimit(_rl, user.id, { action: "analyze_reference", windowMinutes: 60, maxRequests: 10 });
      if (_rlErr) return new Response(JSON.stringify({ error: _rlErr }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }


    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) throw new Error("GEMINI_API_KEY não configurada nos Supabase Secrets");

    // Input
    const body = await req.json();
    const { referenceId, title, platform, format, caption, hook, imageUrl, sourceName } = body;

    const markError = async (refId: string) => {
      try { await supabase.from("references").update({ analysis_status: "erro" }).eq("id", refId); } catch { /* best effort */ }
    };

    if (!referenceId || typeof referenceId !== "string") {
      return new Response(JSON.stringify({ error: "referenceId is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!title || typeof title !== "string") {
      return new Response(JSON.stringify({ error: "title is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Company brain — context + rules for analysis adaptation
    let editorialContext = "";
    try {
      const { data: cfg } = await supabase.from("company_config").select("*").limit(1).single();
      if (cfg) {
        const icp = cfg.icp_json as Record<string, string> | null;
        const ed = cfg.editorial_guidelines_json as Record<string, string> | null;
        const voice = cfg.voice_tone_json as Record<string, string> | null;
        const rules = cfg.rules_json as Record<string, string> | null;

        const ctx: string[] = [];
        if (ed?.positioning) ctx.push(`Posicionamento: ${ed.positioning}`);
        if (voice?.voice) ctx.push(`Tom de voz: ${voice.voice}`);
        if (ed?.pillars) ctx.push(`Pilares: ${ed.pillars}`);
        if (ed?.hook_patterns) ctx.push(`Ganchos preferidos: ${ed.hook_patterns}`);
        if (ed?.copy_style) ctx.push(`Estilo de copy: ${ed.copy_style}`);
        if (ed?.visual_patterns) ctx.push(`Padrões visuais: ${ed.visual_patterns}`);
        if (icp?.persona) ctx.push(`Público-alvo: ${icp.persona}`);
        if (icp?.pain_points) ctx.push(`Dores do público: ${icp.pain_points}`);

        const rls: string[] = [];
        if (rules?.content_structure) rls.push(`A adaptação DEVE seguir esta estrutura: ${rules.content_structure}`);
        if (rules?.always_include) rls.push(`A adaptação DEVE conter: ${rules.always_include}`);
        if (rules?.never_include) rls.push(`A adaptação NÃO PODE conter: ${rules.never_include}`);
        if (voice?.forbidden_terms) rls.push(`Termos banidos na adaptação: ${voice.forbidden_terms}`);

        let block = "";
        if (ctx.length > 0) block += `\nContexto da marca:\n${ctx.map(c => `- ${c}`).join("\n")}`;
        if (rls.length > 0) block += `\n\n⚠️ REGRAS para campos de adaptação:\n${rls.map((r, i) => `${i + 1}. ${r}`).join("\n")}`;
        if (block) editorialContext = block + "\n";
      }
    } catch { /* not configured yet */ }

    const safeCaption = typeof caption === "string" ? caption.slice(0, 5000) : "";
    const safeHook = typeof hook === "string" ? hook.slice(0, 1000) : "";
    const safeSourceName = typeof sourceName === "string" ? sourceName.slice(0, 500) : "";

    const systemPrompt = `Você é um estrategista sênior de marketing digital, copywriter de alta performance e diretor criativo com 15 anos de experiência. Sua função é realizar engenharia reversa estratégica de peças de marketing.

POSTURA:
- Analise como um estrategista que precisa reconstruir a lógica por trás da peça
- Infira a intenção estratégica, não apenas descreva o que está visível
- Identifique os mecanismos psicológicos e persuasivos em jogo
- Produza inteligência prática que um time criativo possa usar imediatamente

GUARDRAILS:
- NUNCA oriente clonagem literal de marca, logotipo ou identidade visual proprietária
- Foque em estrutura, lógica, composição e direção criativa
- Sempre direcione a adaptação para a marca Inner AI de forma autêntica

QUALIDADE:
- Cada campo deve conter análise estratégica densa e útil
- Dê contexto e "porquê" em cada ponto`;

    const hasImageUrl = typeof imageUrl === "string" && imageUrl.startsWith("http");

    const textPrompt = `Analise esta referência de conteúdo${hasImageUrl ? " (imagem anexada)" : ""} e produza uma engenharia reversa estratégica completa.

DADOS DA REFERÊNCIA:
- Título/nome: "${title.slice(0, 500)}"
- Plataforma: ${typeof platform === "string" ? platform.slice(0, 100) : "Não informada"}
- Formato: ${typeof format === "string" ? format.slice(0, 100) : "Não informado"}
- Fonte: ${safeSourceName || "Não informada"}
${safeCaption ? `- Copy/texto observado: ${safeCaption}` : ""}
${safeHook ? `- Hook observado: ${safeHook}` : ""}
${editorialContext}

Retorne um JSON com EXATAMENTE estes campos (todos como strings):
{
  "analysis_summary": "...", "piece_type": "...", "probable_objective": "...",
  "probable_audience": "...", "main_hook": "...", "copy_structure": "...",
  "central_promise": "...", "persuasion_mechanisms": "...", "emotional_angle": "...",
  "rational_angle": "...", "visual_hierarchy": "...", "observed_color_pattern": "...",
  "observed_typography_style": "...", "visual_composition": "...", "highlight_elements": "...",
  "observed_cta": "...", "why_it_works": "...", "strengths": "...", "weaknesses": "...",
  "fatigue_risks": "...", "adaptation_for_inner_ai": "...", "inspired_generation_prompt": "...",
  "inspired_copy_prompt": "...", "execution_checklist": "..."
}`;

    try {
      // Build Gemini request parts
      const userParts: Array<{ text?: string; inline_data?: { mime_type: string; data: string } }> = [];
      let visionUsed = false;

      if (hasImageUrl) {
        const imageData = await fetchImageAsBase64(imageUrl);
        if (imageData) {
          userParts.push({ inline_data: { mime_type: imageData.mimeType, data: imageData.base64 } });
          visionUsed = true;
          console.log(`[analyze] Vision mode: ${imageData.mimeType}`);
        } else {
          console.warn("[analyze] Falling back to text-only");
        }
      }

      userParts.push({
        text: visionUsed
          ? textPrompt
          : textPrompt + (hasImageUrl ? `\n\n(Nota: a imagem em ${imageUrl} não pôde ser carregada.)` : ""),
      });

      // Call Gemini
      const aiController = new AbortController();
      const aiTimeout = setTimeout(() => aiController.abort(), AI_CALL_TIMEOUT_MS);

      let aiResponse: Response;
      try {
        aiResponse = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
          {
            method: "POST",
            signal: aiController.signal,
            headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
            body: JSON.stringify({
              system_instruction: { parts: [{ text: systemPrompt }] },
              contents: [{ role: "user", parts: userParts }],
              generationConfig: {
                temperature: 0.7,
                responseMimeType: "application/json",
              },
            }),
          },
        );
      } catch (fetchErr: any) {
        clearTimeout(aiTimeout);
        if (fetchErr?.name === "AbortError") throw new Error("IA não respondeu dentro do tempo limite (50s).");
        throw fetchErr;
      }
      clearTimeout(aiTimeout);

      if (!aiResponse.ok) {
        const errBody = await aiResponse.text().catch(() => "");
        console.error(`[analyze] Gemini error ${aiResponse.status}: ${errBody.slice(0, 400)}`);
        if (aiResponse.status === 429) throw new Error("Limite de requisições atingido.");
        throw new Error(`Gemini API error: ${aiResponse.status}`);
      }

      const aiData = await aiResponse.json();
      const rawContent = aiData.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawContent) throw new Error("Resposta vazia da IA");

      const analysisContent = safeParseJson(rawContent);

      // Save
      const { data: savedAnalysis, error: saveErr } = await supabase
        .from("reference_analyses")
        .upsert({ reference_id: referenceId, ...analysisContent }, { onConflict: "reference_id" })
        .select()
        .single();

      if (saveErr) throw saveErr;

      await supabase.from("references").update({ analysis_status: "analisado" }).eq("id", referenceId);

      // ── Extract learnings and append to company brain ─────────────
      try {
        const a = analysisContent;
        const newHook = a.main_hook ? a.main_hook.slice(0, 200) : "";
        const newCopy = a.copy_structure ? a.copy_structure.slice(0, 200) : "";
        const newVisual = a.visual_composition ? a.visual_composition.slice(0, 200) : "";
        const newStructure = a.why_it_works ? a.why_it_works.slice(0, 200) : "";
        const newCta = a.observed_cta ? a.observed_cta.slice(0, 200) : "";

        const { data: cfg } = await supabase.from("company_config").select("id, learnings_json").limit(1).single();
        if (cfg) {
          const L = (cfg.learnings_json ?? {}) as Record<string, string[]>;
          const hooks = Array.isArray(L.hooks) ? L.hooks : [];
          const copy_patterns = Array.isArray(L.copy_patterns) ? L.copy_patterns : [];
          const visual_patterns = Array.isArray(L.visual_patterns) ? L.visual_patterns : [];
          const structures = Array.isArray(L.structures) ? L.structures : [];
          const ctas = Array.isArray(L.ctas) ? L.ctas : [];

          const MAX = 20; // keep last 20 per category
          const push = (arr: string[], val: string) => {
            if (!val || arr.includes(val)) return arr;
            return [...arr, val].slice(-MAX);
          };

          const updated = {
            hooks: push(hooks, newHook),
            copy_patterns: push(copy_patterns, newCopy),
            visual_patterns: push(visual_patterns, newVisual),
            structures: push(structures, newStructure),
            ctas: push(ctas, newCta),
          };

          await supabase.from("company_config")
            .update({ learnings_json: updated })
            .eq("id", cfg.id);

          console.log("[analyze] Learnings updated:", {
            hooks: updated.hooks.length,
            copy: updated.copy_patterns.length,
            visual: updated.visual_patterns.length,
          });
        }
      } catch (learnErr: any) {
        console.warn("[analyze] Failed to save learnings:", learnErr?.message);
        // Non-blocking — analysis still succeeds
      }

      return new Response(
        JSON.stringify({ analysis: savedAnalysis, vision_used: visionUsed }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    } catch (innerErr: any) {
      await markError(referenceId);
      console.error("[analyze] error:", innerErr?.message ?? innerErr);
      const status = innerErr?.message?.includes("Limite") ? 429 : 500;
      return new Response(
        JSON.stringify({ error: innerErr.message || "Erro na análise" }),
        { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
  } catch (e: any) {
    console.error("[analyze] unhandled:", e?.message ?? e);
    return new Response(
      JSON.stringify({ error: e.message || "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
