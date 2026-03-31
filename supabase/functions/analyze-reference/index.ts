import { corsHeaders } from '@supabase/supabase-js/cors';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const lovableKey = Deno.env.get('LOVABLE_API_KEY')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const supabase = createClient(supabaseUrl, supabaseKey);
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const body = await req.json();
    const { referenceId, title, platform, format, caption, hook, imageUrl, sourceName } = body;
    if (!referenceId || !title) return new Response(JSON.stringify({ error: 'referenceId and title required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    // Fetch editorial guidelines for context
    const { data: editorial } = await supabase.from('editorial_guidelines').select('*').limit(1).single();
    const editorialContext = editorial ? `
Contexto da marca Inner AI:
- Posicionamento: ${editorial.brand_positioning}
- Tom de voz: ${editorial.brand_voice}
- Pilares de comunicação: ${editorial.communication_pillars}
- Público-alvo: ${editorial.audience_profiles}
` : '';

    const prompt = `Você é um estrategista de marketing digital e designer sênior. Analise a seguinte referência de conteúdo e gere uma engenharia reversa estratégica completa.

Referência: "${title}"
Plataforma: ${platform}
Formato: ${format}
Fonte: ${sourceName || 'Não informada'}
Copy observada: ${caption || 'Não informada'}
Hook: ${hook || 'Não informado'}
${imageUrl ? `Imagem: ${imageUrl}` : ''}
${editorialContext}

IMPORTANTE: Não copie a identidade visual ou marca de terceiros. Foque em estrutura, lógica, composição e direção criativa.

Retorne um JSON com EXATAMENTE estes campos (todos como strings):
{
  "analysis_summary": "Resumo executivo da análise",
  "piece_type": "Tipo de peça identificado",
  "probable_objective": "Objetivo provável da peça",
  "probable_audience": "Público-alvo provável",
  "main_hook": "Hook/gancho principal",
  "copy_structure": "Estrutura da copy (abertura, desenvolvimento, fechamento)",
  "central_promise": "Promessa central feita ao público",
  "persuasion_mechanisms": "Mecanismos de persuasão utilizados",
  "emotional_angle": "Ângulo emocional explorado",
  "rational_angle": "Ângulo racional/lógico explorado",
  "visual_hierarchy": "Hierarquia visual observada",
  "observed_color_pattern": "Padrão de cores identificado",
  "observed_typography_style": "Estilo tipográfico observado",
  "visual_composition": "Composição visual da peça",
  "highlight_elements": "Elementos de destaque",
  "observed_cta": "CTA observado",
  "why_it_works": "Por que essa peça funciona",
  "strengths": "Pontos fortes",
  "weaknesses": "Pontos fracos ou oportunidades de melhoria",
  "fatigue_risks": "Riscos de saturação se repetido",
  "adaptation_for_inner_ai": "Como adaptar esse racional para a Inner AI de forma original",
  "inspired_generation_prompt": "Prompt para gerar nova peça inspirada no racional",
  "inspired_copy_prompt": "Prompt para gerar copy inspirada no racional",
  "execution_checklist": "Checklist prático de execução"
}`;

    const aiResponse = await fetch('https://api.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${lovableKey}` },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'Você é um estrategista de marketing digital especializado em engenharia reversa de conteúdo. Responda APENAS com JSON válido.' },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      throw new Error(`AI error: ${aiResponse.status} ${errText}`);
    }

    const aiData = await aiResponse.json();
    const analysisContent = JSON.parse(aiData.choices[0].message.content);

    // Save analysis
    const { data: savedAnalysis, error: saveErr } = await supabase
      .from('reference_analyses')
      .upsert({ reference_id: referenceId, ...analysisContent }, { onConflict: 'reference_id' })
      .select()
      .single();

    if (saveErr) throw saveErr;

    // Update reference status
    await supabase.from('references').update({ analysis_status: 'analisado' }).eq('id', referenceId);

    return new Response(JSON.stringify({ analysis: savedAnalysis }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
