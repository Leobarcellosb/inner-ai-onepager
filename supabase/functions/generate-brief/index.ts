import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BRIEF_SYSTEM_PROMPT = `Você é o assistente criativo da Inner AI. Sua função é gerar briefs criativos altamente práticos e acionáveis para designers.

REGRAS:
- Cada campo deve ser direto e útil — sem enrolação
- Linguagem clara, moderna e profissional
- O designer precisa entender exatamente o que fazer ao ler o brief
- Direção visual deve ser específica (cores, estilos, referências concretas)
- Estrutura de slides/cenas deve ser detalhada e sequencial
- CTA deve ser claro e orientado a conversão
- Tom da Inner AI: confiante, inteligente, premium, sem clichês

FORMATO DE RESPOSTA:
Responda APENAS com um JSON válido (sem markdown, sem código, sem explicações) com exatamente estes campos:
{
  "creative_angle": "ângulo criativo da peça",
  "campaign_objective": "objetivo claro da campanha/peça",
  "target_audience": "público-alvo detalhado",
  "key_message": "mensagem central que o designer deve comunicar",
  "visual_direction": "direção visual específica (paleta, estilo, mood)",
  "visual_references": "referências visuais concretas (marcas, estilos, links conceituais)",
  "mandatory_elements": "elementos que DEVEM estar na peça",
  "suggested_slides_or_scenes": "estrutura detalhada slide a slide ou cena a cena",
  "copy_summary": "resumo da copy para o designer usar como referência",
  "cta": "call to action principal"
}`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { theme, objective, platform, format, targetAudience, rawText, notes } = await req.json();

    if (!theme || typeof theme !== "string" || theme.trim().length === 0) {
      return new Response(JSON.stringify({ error: "Tema é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const userPrompt = `Gere um brief criativo completo com base nestas informações:

TEMA: ${theme}
OBJETIVO: ${objective || "Não especificado"}
PLATAFORMA: ${platform || "Não especificada"}
FORMATO: ${format || "Não especificado"}
PÚBLICO-ALVO: ${targetAudience || "Não especificado"}
${rawText ? `TEXTO BASE / COPY:\n${rawText}` : ""}
${notes ? `OBSERVAÇÕES ADICIONAIS:\n${notes}` : ""}

Gere o brief completo em JSON.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: BRIEF_SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
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
    let content = data.choices?.[0]?.message?.content || "";
    
    // Clean potential markdown wrapping
    content = content.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    
    let briefData;
    try {
      briefData = JSON.parse(content);
    } catch {
      console.error("Failed to parse AI response as JSON:", content);
      return new Response(JSON.stringify({ error: "A IA retornou um formato inválido. Tente novamente." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ brief: briefData }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-brief error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
