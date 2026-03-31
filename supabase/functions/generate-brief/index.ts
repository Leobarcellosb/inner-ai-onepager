import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
  "visual_references": "referências visuais concretas",
  "mandatory_elements": "elementos que DEVEM estar na peça",
  "suggested_slides_or_scenes": "estrutura detalhada slide a slide ou cena a cena",
  "copy_summary": "resumo da copy para o designer usar como referência",
  "cta": "call to action principal"
}`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { theme, objective, platform, format, targetAudience, rawText, notes, referenceAnalysis } = await req.json();

    if (!theme || typeof theme !== "string" || theme.trim().length === 0) {
      return new Response(JSON.stringify({ error: "Tema é obrigatório" }), {
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
        if (editorial.visual_identity_guidelines) parts.push(`Identidade visual: ${editorial.visual_identity_guidelines}`);
        if (editorial.creative_principles) parts.push(`Princípios criativos: ${editorial.creative_principles}`);
        if (parts.length > 0) editorialContext = `\n\nDIRETRIZES DA MARCA:\n${parts.join("\n")}`;
      }
    } catch { /* not configured yet */ }

    // Build reference analysis context
    let referenceContext = "";
    if (referenceAnalysis) {
      const ra = referenceAnalysis;
      const parts: string[] = [];
      if (ra.analysis_summary) parts.push(`Resumo: ${ra.analysis_summary}`);
      if (ra.copy_structure) parts.push(`Estrutura de copy: ${ra.copy_structure}`);
      if (ra.visual_hierarchy) parts.push(`Hierarquia visual: ${ra.visual_hierarchy}`);
      if (ra.visual_composition) parts.push(`Composição visual: ${ra.visual_composition}`);
      if (ra.observed_color_pattern) parts.push(`Cores observadas: ${ra.observed_color_pattern}`);
      if (ra.persuasion_mechanisms) parts.push(`Mecanismos de persuasão: ${ra.persuasion_mechanisms}`);
      if (ra.adaptation_for_inner_ai) parts.push(`Adaptação sugerida: ${ra.adaptation_for_inner_ai}`);
      if (ra.inspired_generation_prompt) parts.push(`Prompt inspirado: ${ra.inspired_generation_prompt}`);
      if (parts.length > 0) {
        referenceContext = `\n\nREFERÊNCIA ANALISADA (use como inspiração, NÃO copie — adapte de forma original):\n${parts.join("\n")}`;
      }
    }

    const userPrompt = `Gere um brief criativo completo com base nestas informações:

TEMA: ${theme}
OBJETIVO: ${objective || "Não especificado"}
PLATAFORMA: ${platform || "Não especificada"}
FORMATO: ${format || "Não especificado"}
PÚBLICO-ALVO: ${targetAudience || "Não especificado"}
${rawText ? `TEXTO BASE / COPY:\n${rawText}` : ""}
${notes ? `OBSERVAÇÕES ADICIONAIS:\n${notes}` : ""}
${editorialContext}
${referenceContext}

Gere o brief completo em JSON.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: BRIEF_SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
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
    let content = data.choices?.[0]?.message?.content || "";
    content = content.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();

    let briefData;
    try {
      briefData = JSON.parse(content);
    } catch {
      console.error("Failed to parse AI response:", content);
      return new Response(JSON.stringify({ error: "A IA retornou um formato inválido. Tente novamente." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ brief: briefData }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-brief error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
