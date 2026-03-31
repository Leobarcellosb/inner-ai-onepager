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

export interface BriefGenerationParams {
  theme: string;
  objective: string;
  platform: string;
  format: string;
  targetAudience: string;
  rawText?: string;
  notes?: string;
}

export interface BriefGenerationResult {
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
}

export async function generateBriefWithAI(params: BriefGenerationParams): Promise<BriefGenerationResult> {
  const { data, error } = await supabase.functions.invoke('generate-brief', {
    body: params,
  });

  if (error) {
    console.error('AI brief error:', error);
    throw new Error(error.message || 'Erro ao gerar brief');
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  return data.brief;
}
