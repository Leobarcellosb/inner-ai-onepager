import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const lovableKey = Deno.env.get('LOVABLE_API_KEY')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    // Auth validation
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const anonClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsErr } = await anonClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Use service role for DB operations
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Input validation
    const body = await req.json();
    const { referenceId, title, platform, format, caption, hook, imageUrl, sourceName } = body;
    if (!referenceId || typeof referenceId !== 'string') {
      return new Response(JSON.stringify({ error: 'referenceId is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (!title || typeof title !== 'string') {
      return new Response(JSON.stringify({ error: 'title is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Fetch editorial guidelines for context
    const { data: editorial } = await supabase.from('editorial_guidelines').select('*').limit(1).single();
    const editorialContext = editorial ? `
Contexto da marca Inner AI:
- Posicionamento: ${editorial.brand_positioning}
- Tom de voz: ${editorial.brand_voice}
- Pilares de comunicação: ${editorial.communication_pillars}
- Público-alvo: ${editorial.audience_profiles}
` : '';

    const safeCaption = typeof caption === 'string' ? caption.slice(0, 5000) : '';
    const safeHook = typeof hook === 'string' ? hook.slice(0, 1000) : '';
    const safeSourceName = typeof sourceName === 'string' ? sourceName.slice(0, 500) : '';

    const systemPrompt = `Você é um estrategista sênior de marketing digital, copywriter de alta performance e diretor criativo com 15 anos de experiência. Sua função é realizar engenharia reversa estratégica de peças de marketing — não uma descrição superficial, mas uma análise profunda que transforma observação em raciocínio estratégico acionável.

POSTURA:
- Analise como um estrategista que precisa reconstruir a lógica por trás da peça
- Infira a intenção estratégica, não apenas descreva o que está visível
- Identifique os mecanismos psicológicos e persuasivos em jogo
- Conecte elementos visuais à estratégia de comunicação
- Produza inteligência prática que um time criativo possa usar imediatamente

GUARDRAILS:
- NUNCA oriente clonagem literal de marca, logotipo ou identidade visual proprietária
- NUNCA instrua a copiar exatamente a peça — sempre converta em direção original e adaptável
- Foque em estrutura, lógica, composição e direção criativa — não em elementos proprietários
- Sempre direcione a adaptação para a marca Inner AI de forma autêntica e diferenciada

QUALIDADE:
- Cada campo deve conter análise estratégica densa e útil, não frases genéricas
- A saída deve parecer inteligência de alto nível, não relatório descritivo
- Dê contexto e "porquê" em cada ponto — não apenas "o quê"
- Prompts gerados devem ser completos e usáveis, não vagos`;

    const prompt = `Analise esta referência de conteúdo e produza uma engenharia reversa estratégica completa.

DADOS DA REFERÊNCIA:
- Título/nome: "${title.slice(0, 500)}"
- Plataforma: ${typeof platform === 'string' ? platform.slice(0, 100) : 'Não informada'}
- Formato: ${typeof format === 'string' ? format.slice(0, 100) : 'Não informado'}
- Fonte: ${safeSourceName || 'Não informada'}
${safeCaption ? `- Copy/texto observado: ${safeCaption}` : ''}
${safeHook ? `- Hook observado: ${safeHook}` : ''}
${typeof imageUrl === 'string' && imageUrl.startsWith('http') ? `- URL da imagem: ${imageUrl.slice(0, 500)}` : ''}
${editorialContext}

Retorne um JSON com EXATAMENTE estes campos (todos como strings com análise estratégica profunda):
{
  "analysis_summary": "Resumo executivo da peça — o que ela é, o que faz e por que é relevante como referência",
  "piece_type": "Tipo de peça identificado e seu papel dentro de uma estratégia de conteúdo",
  "probable_objective": "O que essa peça está tentando fazer — qual comportamento ou percepção ela busca gerar",
  "probable_audience": "Qual dor, desejo ou perfil psicográfico essa peça está acionando — vá além de dados demográficos",
  "main_hook": "Hook principal — o mecanismo de captura de atenção nos primeiros segundos/elementos",
  "copy_structure": "Estrutura da mensagem: como a narrativa é construída do início ao fim, com qual ritmo e progressão",
  "central_promise": "Promessa central feita ao público — o que ele ganha se prestar atenção ou agir",
  "persuasion_mechanisms": "Mecanismos de persuasão utilizados (escassez, prova social, autoridade, reciprocidade, etc.) com exemplos concretos da peça",
  "emotional_angle": "Ângulo emocional explorado — qual emoção é ativada e como ela se conecta ao objetivo",
  "rational_angle": "Ângulo racional/lógico — quais argumentos ou dados sustentam a mensagem",
  "visual_hierarchy": "Hierarquia da informação — o que o olho lê primeiro, segundo, terceiro e por quê",
  "observed_color_pattern": "Estilo visual observado — paleta, mood, referências estéticas e o efeito psicológico das escolhas",
  "observed_typography_style": "Tipografia e estilo de texto — peso, contraste, legibilidade e como reforça o tom",
  "visual_composition": "Leitura visual da composição — layout, equilíbrio, respiração, direção do olhar",
  "highlight_elements": "Elementos que puxam atenção — ícones, contrastes, movimento, padrões de quebra",
  "observed_cta": "CTA observado ou implícito — o que o público deve fazer depois e como é comunicado",
  "why_it_works": "Por que essa peça tende a performar — os 3-5 fatores estratégicos que fazem ela funcionar",
  "strengths": "Pontos fortes — o que vale preservar como aprendizado e inspiração",
  "weaknesses": "O que pode estar saturado ou frágil — riscos se a abordagem for repetida sem adaptação",
  "fatigue_risks": "Riscos de saturação — sinais de que esse formato/abordagem pode estar desgastado no mercado",
  "adaptation_for_inner_ai": "Como adaptar esse racional para a Inner AI de forma original e autêntica — direção concreta, não genérica",
  "inspired_generation_prompt": "Prompt completo e detalhado para criar uma peça visual nova inspirada no racional estratégico (não na identidade visual da peça original)",
  "inspired_copy_prompt": "Prompt completo e detalhado para gerar copy inspirada no racional estratégico, adaptada ao tom Inner AI",
  "execution_checklist": "Checklist estratégico de execução — 8 a 12 itens práticos e sequenciais para reconstruir uma peça com base nessa análise"
}`;

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${lovableKey}` },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) return new Response(JSON.stringify({ error: 'Limite de requisições atingido.' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      if (aiResponse.status === 402) return new Response(JSON.stringify({ error: 'Créditos de IA esgotados.' }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      throw new Error(`AI error: ${aiResponse.status}`);
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
    console.error('analyze-reference error:', e);
    return new Response(JSON.stringify({ error: e.message || 'Erro interno' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
