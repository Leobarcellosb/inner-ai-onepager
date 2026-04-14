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

// ─── HELPER CENTRAL ──────────────────────────────────────
/**
 * Calls the unified ai-claude edge function.
 * Routes through Claude API with Brand Brain context.
 * Returns parsed JSON directly. Throws on error.
 */
export async function callAIClaude<T>(fn: string, payload: Record<string, unknown>): Promise<T> {

  // Injeta brain automaticamente se não foi passado
  if (!payload.brain) {
    const { data: config } = await supabase
      .from('company_config')
      .select('*')
      .single();

    if (config) {
      const icp = config.icp_json as Record<string, string> | null;
      const ed = config.editorial_guidelines_json as Record<string, string> | null;
      const voice = config.voice_tone_json as Record<string, string> | null;
      const rules = config.rules_json as Record<string, string> | null;
      const learn = config.learnings_json as Record<string, string[]> | null;

      payload.brain = {
        identity: {
          icp: icp?.persona ?? '',
          positioning: ed?.positioning ?? '',
          languageStyle: voice?.voice ?? '',
        },
        rules: {
          hardConstraints: [rules?.content_structure, rules?.always_include].filter(Boolean),
          forbiddenPatterns: [rules?.never_include, voice?.forbidden_terms].filter(Boolean),
        },
        validatedPatterns: {
          hooks: learn?.hooks?.slice(-5) ?? [],
          copyStructures: learn?.copy_patterns?.slice(-3) ?? [],
        },
        memory: {
          rejectedPatterns: learn?.structures?.slice(-3) ?? [],
        },
      };
    }
  }

  const { data, error } = await supabase.functions.invoke('ai-claude', {
    body: { function: fn, payload },
  });

  if (error) throw new Error(error.message || `Erro na função ${fn}`);
  if (data?.error) throw new Error(data.error);

  const raw = data.result as string;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return raw as unknown as T;
  }
}

// ─── IMPROVE TEXT ────────────────────────────────────────
export async function improveTextWithAI(
  text: string,
  intent: AIIntent = 'clareza',
  intensity: AIIntensity = 'media'
): Promise<string> {
  return callAIClaude<string>('improve-text', { text, intent, intensity });
}

// ─── GENERATE BRIEF ──────────────────────────────────────
export interface BriefGenerationParams {
  theme: string;
  objective: string;
  platform: string;
  format: string;
  targetAudience: string;
  rawText?: string;
  notes?: string;
  referenceAnalysis?: Record<string, string>;
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
  return callAIClaude<BriefGenerationResult>('generate-brief', params as unknown as Record<string, unknown>);
}
