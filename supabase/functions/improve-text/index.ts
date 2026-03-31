import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BRAND_VOICE_SYSTEM = `Você é o assistente de escrita da Inner AI. Reescreva textos seguindo rigorosamente estas diretrizes de marca:

REGRAS DE VOZ:
- Tom inteligente e confiante — nunca arrogante
- Clareza acima de tudo — sem enrolação, sem floreio
- Moderno e direto — frases curtas e incisivas
- Persuasivo sem parecer forçado — mais autoridade que hype
- Evitar clichês de social media e marketing genérico
- Parecer uma marca premium, atual e útil
- Foco em produtividade, inteligência e transformação prática

FORMATO DE RESPOSTA:
Retorne APENAS o texto reescrito, sem explicações, sem comentários, sem markdown.
Se fizer sentido, sugira um CTA melhor no final do texto.`;

const INTENT_PROMPTS: Record<string, string> = {
  clareza: "Foque em tornar o texto mais claro, fácil de entender e bem estruturado. Elimine ambiguidades e simplifique frases complexas.",
  persuasao: "Foque em tornar o texto mais persuasivo e convincente. Use argumentos fortes e linguagem que motive ação.",
  engajamento: "Foque em tornar o texto mais envolvente e interativo. Use perguntas retóricas, hooks de atenção e linguagem que gere conexão.",
  autoridade: "Foque em posicionar a Inner AI como autoridade no assunto. Use dados, afirmações confiantes e tom de especialista.",
  conversao: "Foque em otimizar o texto para conversão. CTA forte, benefícios claros, urgência sutil e eliminação de objeções.",
};

const INTENSITY_PROMPTS: Record<string, string> = {
  leve: "Faça ajustes sutis, mantendo a estrutura e a maior parte do texto original. Apenas refine a linguagem.",
  media: "Reescreva o texto melhorando significativamente a qualidade, mas mantendo a essência e mensagem original.",
  forte: "Reescreva o texto completamente se necessário. Priorize máxima qualidade e impacto, mesmo que mude bastante do original.",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { text, intent, intensity } = await req.json();

    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return new Response(JSON.stringify({ error: "Texto é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (text.length > 10000) {
      return new Response(JSON.stringify({ error: "Texto muito longo (máx 10.000 caracteres)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const intentGuide = INTENT_PROMPTS[intent] || INTENT_PROMPTS.clareza;
    const intensityGuide = INTENSITY_PROMPTS[intensity] || INTENSITY_PROMPTS.media;

    const systemPrompt = `${BRAND_VOICE_SYSTEM}\n\nINTENÇÃO DA MELHORIA: ${intentGuide}\n\nINTENSIDADE: ${intensityGuide}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Reescreva este texto:\n\n${text}` },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições atingido. Tente novamente em alguns segundos." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados. Adicione créditos ao workspace." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Erro no serviço de IA" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const improvedText = data.choices?.[0]?.message?.content || "";

    return new Response(JSON.stringify({ improved_text: improvedText }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("improve-text error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
