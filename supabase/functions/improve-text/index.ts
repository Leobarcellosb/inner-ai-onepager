import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BASE_VOICE = `Você é o assistente de escrita da Inner AI. Reescreva textos seguindo rigorosamente as diretrizes da marca.

REGRAS DE VOZ PADRÃO:
- Tom inteligente e confiante — nunca arrogante
- Clareza acima de tudo — sem enrolação, sem floreio
- Moderno e direto — frases curtas e incisivas
- Persuasivo sem parecer forçado — mais autoridade que hype
- Evitar clichês de social media e marketing genérico
- Parecer uma marca premium, atual e útil

FORMATO DE RESPOSTA:
Retorne APENAS o texto reescrito, sem explicações, sem comentários, sem markdown.`;

const INTENT_PROMPTS: Record<string, string> = {
  clareza: "Foque em tornar o texto mais claro, fácil de entender e bem estruturado.",
  persuasao: "Foque em tornar o texto mais persuasivo e convincente.",
  engajamento: "Foque em tornar o texto mais envolvente e interativo.",
  autoridade: "Foque em posicionar a Inner AI como autoridade no assunto.",
  conversao: "Foque em otimizar o texto para conversão. CTA forte, benefícios claros.",
};

const INTENSITY_PROMPTS: Record<string, string> = {
  leve: "Faça ajustes sutis, mantendo a estrutura e a maior parte do texto original.",
  media: "Reescreva o texto melhorando significativamente a qualidade, mas mantendo a essência.",
  forte: "Reescreva o texto completamente se necessário. Priorize máxima qualidade e impacto.",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { text, intent, intensity } = await req.json();

    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return new Response(JSON.stringify({ error: "Texto é obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (text.length > 10000) {
      return new Response(JSON.stringify({ error: "Texto muito longo (máx 10.000 caracteres)" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Fetch editorial guidelines for brand context
    let editorialContext = "";
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);
      const { data: editorial } = await supabase.from("editorial_guidelines").select("*").limit(1).single();
      if (editorial) {
        const parts: string[] = [];
        if (editorial.brand_positioning) parts.push(`Posicionamento: ${editorial.brand_positioning}`);
        if (editorial.brand_voice) parts.push(`Tom de voz: ${editorial.brand_voice}`);
        if (editorial.communication_pillars) parts.push(`Pilares: ${editorial.communication_pillars}`);
        if (editorial.preferred_terms) parts.push(`Termos preferidos: ${editorial.preferred_terms}`);
        if (editorial.forbidden_terms) parts.push(`Termos proibidos (NUNCA use): ${editorial.forbidden_terms}`);
        if (editorial.cta_patterns) parts.push(`Padrões de CTA: ${editorial.cta_patterns}`);
        if (editorial.creative_principles) parts.push(`Princípios criativos: ${editorial.creative_principles}`);
        if (parts.length > 0) {
          editorialContext = `\n\nDIRETRIZES DA MARCA (use como contexto obrigatório):\n${parts.join("\n")}`;
        }
      }
    } catch { /* editorial not configured yet, use defaults */ }

    const intentGuide = INTENT_PROMPTS[intent] || INTENT_PROMPTS.clareza;
    const intensityGuide = INTENSITY_PROMPTS[intensity] || INTENSITY_PROMPTS.media;

    const systemPrompt = `${BASE_VOICE}${editorialContext}\n\nINTENÇÃO: ${intentGuide}\nINTENSIDADE: ${intensityGuide}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Reescreva este texto:\n\n${text}` },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) return new Response(JSON.stringify({ error: "Limite de requisições atingido." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (response.status === 402) return new Response(JSON.stringify({ error: "Créditos de IA esgotados." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Erro no serviço de IA" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = await response.json();
    const improvedText = data.choices?.[0]?.message?.content || "";

    return new Response(JSON.stringify({ improved_text: improvedText }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("improve-text error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
