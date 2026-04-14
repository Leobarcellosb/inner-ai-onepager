import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, x-client-info, apikey",
};

// ─── TIPOS ───────────────────────────────────────────────
interface BrandBrain {
  identity?: { icp?: string; positioning?: string; languageStyle?: string };
  rules?: { hardConstraints?: string[]; forbiddenPatterns?: string[] };
  validatedPatterns?: { hooks?: string[]; copyStructures?: string[] };
  memory?: { rejectedPatterns?: string[] };
}

// ─── HANDLER PRINCIPAL ───────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { function: fn, payload } = await req.json();

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Valida JWT contra Supabase Auth
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { systemPrompt, userMessage, model, maxTokens } = buildRequest(fn, payload);

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: model ?? "claude-sonnet-4-6",
        max_tokens: maxTokens ?? 2048,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("[ai-claude] Anthropic error:", response.status, JSON.stringify(data).slice(0, 300));
      throw new Error(data?.error?.message || `Anthropic API error: ${response.status}`);
    }

    const text = data.content?.[0]?.text ?? "";

    return new Response(JSON.stringify({ result: text }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[ai-claude] error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ─── ROTEADOR ────────────────────────────────────────────
function buildRequest(fn: string, payload: Record<string, unknown>) {
  const brain = payload.brain as BrandBrain;
  const brainContext = buildBrainContext(brain);

  const routes: Record<string, () => object> = {

    "generate-carousel": () => ({
      model: "claude-sonnet-4-6",
      maxTokens: 3000,
      systemPrompt: `${brainContext}\n\nVocê é especialista em carrosséis virais para Instagram. Gere APENAS JSON válido no formato: { slides: [{ title: string, body: string, cta?: string }] }`,
      userMessage: `Tema: ${payload.topic}\nObjetivo: ${payload.goal}\nNúmero de slides: ${payload.slides ?? 10}`,
    }),

    "generate-ideas": () => ({
      model: "claude-haiku-4-5-20251001",
      maxTokens: 1000,
      systemPrompt: `${brainContext}\n\nGere ideias de conteúdo únicas e específicas para essa marca. Retorne APENAS JSON: { ideas: [{ title: string, format: string, hook: string }] }`,
      userMessage: `Gere ${payload.count ?? 10} ideias sobre: ${payload.topic}`,
    }),

    "generate-stories": () => ({
      model: "claude-sonnet-4-6",
      maxTokens: 2000,
      systemPrompt: `${brainContext}\n\nGere uma sequência de stories para Instagram. Retorne APENAS JSON: { sequence: { sequence_title: string, objective: string, total_slides: number, slides: [{ position: number, type: "hook"|"value"|"tension"|"proof"|"cta", text: string, visual_direction: string, cta: string|null, note: string|null }] } }`,
      userMessage: `Tema: ${payload.topic}\nQuantidade de slides: ${payload.count ?? 5}`,
    }),

    "generate-brief": () => ({
      model: "claude-haiku-4-5-20251001",
      maxTokens: 1000,
      systemPrompt: `${brainContext}\n\nGere um brief criativo objetivo e acionável. Retorne APENAS JSON: { objective: string, tone: string, keyMessages: string[], references: string[], cta: string }`,
      userMessage: `Conteúdo: ${payload.content}\nObjetivo: ${payload.goal}`,
    }),

    "improve-text": () => ({
      model: "claude-haiku-4-5-20251001",
      maxTokens: 1500,
      systemPrompt: `${brainContext}\n\nMelhore o texto mantendo a voz da marca. Retorne apenas o texto melhorado, sem explicações.`,
      userMessage: payload.text as string,
    }),

    "optimize-content": () => ({
      model: "claude-haiku-4-5-20251001",
      maxTokens: 1500,
      systemPrompt: `${brainContext}\n\nOtimize para máximo engajamento mantendo a voz da marca. Retorne APENAS JSON: { optimized: string, changes: string[] }`,
      userMessage: payload.content as string,
    }),

    "score-content": () => ({
      model: "claude-haiku-4-5-20251001",
      maxTokens: 500,
      systemPrompt: `${brainContext}\n\nAvalie o conteúdo com base no Brand Brain. Retorne APENAS JSON: { score: number, feedback: string, suggestions: string[] }`,
      userMessage: payload.content as string,
    }),

    "brain-review": () => ({
      model: "claude-sonnet-4-6",
      maxTokens: 2000,
      systemPrompt: `${brainContext}\n\nRevise o conteúdo com base no Brand Brain. Seja específico e cirúrgico. Retorne APENAS JSON: { approved: boolean, score: number, issues: string[], suggestions: string[] }`,
      userMessage: payload.content as string,
    }),

    "brain-alerts": () => ({
      model: "claude-haiku-4-5-20251001",
      maxTokens: 1000,
      systemPrompt: `${brainContext}\n\nAnalise o estado atual do Brand Brain e identifique inconsistências, lacunas ou oportunidades de melhoria. Retorne APENAS JSON: { alerts: [{ type: string, message: string, priority: "high"|"medium"|"low" }] }`,
      userMessage: `Analise o Brand Brain acima e gere alertas de melhoria.`,
    }),

    "autopilot": () => ({
      model: "claude-sonnet-4-6",
      maxTokens: 4000,
      systemPrompt: `${brainContext}\n\nGere um conteúdo completo pronto para aprovação. Retorne APENAS JSON: { type: string, title: string, body: string, hook: string, cta: string, hashtags: string[] }`,
      userMessage: `Tipo: ${payload.type}\nData alvo: ${payload.targetDate}\nContexto: ${payload.context ?? "nenhum"}`,
    }),

    "plan-calendar": () => ({
      model: "claude-sonnet-4-6",
      maxTokens: 3000,
      systemPrompt: `${brainContext}\n\nCrie um plano de conteúdo estratégico para o período solicitado. Retorne APENAS JSON: { plan: [{ date: string, type: string, topic: string, format: string, goal: string }] }`,
      userMessage: `Período: ${payload.period}\nFrequência: ${payload.frequency ?? "diária"}\nObjetivo do período: ${payload.goal ?? "engajamento"}`,
    }),

    "analyze-reference": () => ({
      model: "claude-sonnet-4-6",
      maxTokens: 2000,
      systemPrompt: `${brainContext}\n\nAnalise a referência criativa e extraia padrões aplicáveis. Retorne APENAS JSON: { hooks: string[], structures: string[], ctas: string[], tone: string, strengths: string[], quality: "strong"|"neutral"|"weak" }`,
      userMessage: `Referência para análise:\n${payload.reference}`,
    }),

    "extract-knowledge": () => ({
      model: "claude-sonnet-4-6",
      maxTokens: 2000,
      systemPrompt: `${brainContext}\n\nExtraia conhecimento relevante do documento para enriquecer o Brand Brain. Retorne APENAS JSON: { insights: string[], keyMessages: string[], vocabulary: string[], positioning: string[], rules: string[] }`,
      userMessage: `Documento:\n${payload.document}`,
    }),

    "parse-import": () => ({
      model: "claude-sonnet-4-6",
      maxTokens: 3000,
      systemPrompt: `${brainContext}\n\nInterprete o planejamento de conteúdo e estruture em itens acionáveis. Retorne APENAS JSON: { items: [{ title: string, date?: string, time?: string, platform: string, format: string, theme?: string, objective?: string, raw_text?: string }], notes?: string }`,
      userMessage: `Planejamento:\n${payload.text}`,
    }),
  };

  const builder = routes[fn];
  if (!builder) throw new Error(`Unknown AI function: ${fn}`);
  return builder() as {
    systemPrompt: string;
    userMessage: string;
    model: string;
    maxTokens: number;
  };
}

// ─── BRAND BRAIN CONTEXT ─────────────────────────────────
function buildBrainContext(brain: BrandBrain): string {
  if (!brain) return "## BRAND BRAIN\nNenhum contexto disponível.";

  return `
## BRAND BRAIN
**ICP:** ${brain.identity?.icp ?? "não definido"}
**Posicionamento:** ${brain.identity?.positioning ?? "não definido"}
**Tom de voz:** ${brain.identity?.languageStyle ?? "não definido"}
**Restrições:** ${brain.rules?.hardConstraints?.join(", ") ?? "nenhuma"}
**Proibido:** ${brain.rules?.forbiddenPatterns?.join(", ") ?? "nenhum"}
**Hooks validados:** ${brain.validatedPatterns?.hooks?.slice(0, 5).join(" | ") ?? "nenhum"}
**Padrões rejeitados:** ${brain.memory?.rejectedPatterns?.join(", ") ?? "nenhum"}
  `.trim();
}
