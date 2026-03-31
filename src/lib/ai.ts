import { supabase } from '@/integrations/supabase/client';

export type AIIntent = 'clareza' | 'persuasao' | 'engajamento' | 'autoridade' | 'conversao';
export type AIIntensity = 'leve' | 'media' | 'forte';

export const AI_INTENT_LABELS: Record<AIIntent, string> = {
  clareza: 'Clareza',
  persuasao: 'Persuasão',
  engajamento: 'Engajamento',
  autoridade: 'Autoridade',
  conversao: 'Conversão',
};

export const AI_INTENSITY_LABELS: Record<AIIntensity, string> = {
  leve: 'Leve',
  media: 'Média',
  forte: 'Forte',
};

export const AI_INTENT_DESCRIPTIONS: Record<AIIntent, string> = {
  clareza: 'Texto mais claro e bem estruturado',
  persuasao: 'Mais convincente e motivador',
  engajamento: 'Envolvente e interativo',
  autoridade: 'Tom de especialista e confiança',
  conversao: 'Otimizado para gerar ação',
};

export async function improveTextWithAI(
  text: string,
  intent: AIIntent = 'clareza',
  intensity: AIIntensity = 'media'
): Promise<string> {
  const { data, error } = await supabase.functions.invoke('improve-text', {
    body: { text, intent, intensity },
  });

  if (error) {
    console.error('AI improve error:', error);
    throw new Error(error.message || 'Erro ao melhorar texto');
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  return data.improved_text;
}

export const BRIEF_GENERATION_PROMPT = `Você é o assistente criativo da Inner AI. Gere um brief criativo completo e editável com os seguintes campos:
- Ângulo criativo
- Mensagem principal
- Objetivo da peça
- Direção visual
- Elementos obrigatórios
- Referências visuais sugeridas
- Estrutura sugerida por slides ou cenas
- CTA
Baseie-se nas informações fornecidas sobre o conteúdo.`;

export async function generateBriefWithAI(params: {
  theme: string;
  objective: string;
  platform: string;
  format: string;
  targetAudience: string;
  rawText?: string;
}): Promise<{
  creative_angle: string;
  campaign_objective: string;
  target_audience: string;
  key_message: string;
  visual_references: string;
  visual_direction: string;
  mandatory_elements: string;
  suggested_slides_or_scenes: string;
  copy_summary: string;
  cta: string;
}> {
  // Mock for V1 — ready to replace with edge function
  await new Promise(resolve => setTimeout(resolve, 2000));

  return {
    creative_angle: `Ângulo criativo gerado para "${params.theme}" — abordagem moderna e impactante que destaca os diferenciais da Inner AI.`,
    campaign_objective: params.objective || 'Gerar awareness e engajamento com a marca Inner AI.',
    target_audience: params.targetAudience || 'Profissionais de marketing e gestores de conteúdo que buscam eficiência com IA.',
    key_message: `A Inner AI transforma a forma como você cria conteúdo — mais rápido, mais inteligente, mais impactante.`,
    visual_references: 'Estética clean e tech. Referências: Apple, Linear, Vercel. Paleta escura com verde accent.',
    visual_direction: 'Fundo clean, tipografia forte, elementos gráficos minimalistas. Contraste alto para legibilidade.',
    mandatory_elements: 'Logo Inner AI, CTA claro, identidade visual da marca.',
    suggested_slides_or_scenes: `Slide 1: Hook visual com a dor do público\nSlide 2: Apresentação da solução\nSlide 3: Benefícios práticos\nSlide 4: CTA + prova social`,
    copy_summary: params.rawText || `Resumo da copy focado em ${params.theme} com tom direto e persuasivo.`,
    cta: 'Experimente a Inner AI gratuitamente',
  };
}
