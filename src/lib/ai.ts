import { ContentStatus, BriefStatus } from '@/types';

export const BRAND_VOICE_PROMPT = `Você é o assistente de comunicação da Inner AI. Reescreva o texto seguindo estas diretrizes:
- Tom confiante e inteligente
- Clareza acima de floreio
- Moderno e direto
- Sem linguagem engessada
- Foco em produtividade, inteligência e transformação prática
- Evitar texto genérico de marketing
- Parecer uma marca premium e atual
- Falar de forma útil, objetiva e convincente
Mantenha a mensagem central, torne o texto mais claro e persuasivo, e sugira um CTA melhor quando fizer sentido.`;

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

// Mock AI functions - ready to be replaced with real API calls
export async function improveTextWithAI(text: string): Promise<string> {
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  return `${text}\n\n✨ [Versão melhorada pela IA]\n\nEste texto foi refinado para a linguagem Inner AI: tom confiante, direto e orientado a resultados. A mensagem central foi mantida, com ajustes de clareza e persuasão.\n\n💡 CTA sugerido: "Comece agora e transforme seus resultados com inteligência artificial."`;
}

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
