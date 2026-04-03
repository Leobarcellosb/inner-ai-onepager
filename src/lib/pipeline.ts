import type { Content, ContentStatus } from '@/types';

/**
 * Returns a valid scheduled_date, defaulting to today if missing.
 */
export function ensureScheduledDate(date: string | null | undefined): string {
  return date || new Date().toISOString().slice(0, 10);
}

/**
 * Returns a valid scheduled_time, defaulting to 10:00 if missing.
 */
export function ensureScheduledTime(time: string | null | undefined): string {
  return time || '10:00:00';
}

/**
 * Validates that a content payload has required schedule fields.
 * Returns error message or null if valid.
 */
export function validateSchedule(date: string | null | undefined, time: string | null | undefined): string | null {
  if (!date) return 'Data de publicação é obrigatória.';
  if (!time) return 'Horário de publicação é obrigatório.';
  return null;
}

/**
 * Validates whether a content can transition to a new status.
 * Returns null if valid, or an error message string if blocked.
 */
export function validateTransition(
  content: Content,
  targetStatus: ContentStatus,
): string | null {
  const s = content.status;

  // ── Forward transitions: business rules ──────────────────────────────

  // writing → copy_review: must have text
  if (targetStatus === 'copy_review') {
    if (!content.raw_text?.trim() && !content.improved_text?.trim()) {
      return 'Escreva o texto do conteúdo antes de enviar para revisão.';
    }
  }

  // copy_review → copy_approved: must have text (reviewer is approving)
  if (targetStatus === 'copy_approved') {
    if (!content.raw_text?.trim() && !content.improved_text?.trim()) {
      return 'O conteúdo precisa ter texto para aprovar a copy.';
    }
  }

  // copy_approved → design_queue: must have text approved
  if (targetStatus === 'design_queue') {
    if (!content.raw_text?.trim() && !content.improved_text?.trim()) {
      return 'A copy precisa estar aprovada antes de enviar para design.';
    }
  }

  // designing → final_review: must have figma_link (designer delivered)
  if (targetStatus === 'final_review') {
    if (!content.figma_link?.trim()) {
      return 'Adicione o link do Figma antes de enviar para revisão final.';
    }
  }

  // final_review → approved: must have figma_link
  if (targetStatus === 'approved') {
    if (!content.figma_link?.trim()) {
      return 'O conteúdo precisa ter entrega visual (link do Figma) para ser aprovado.';
    }
  }

  // approved → scheduled: must have date + time
  if (targetStatus === 'scheduled') {
    if (!content.scheduled_date || !content.scheduled_time) {
      return 'Defina data e horário da publicação antes de agendar.';
    }
  }

  // scheduled → published: must have date + time + approval
  if (targetStatus === 'published') {
    if (!content.scheduled_date || !content.scheduled_time) {
      return 'Defina data e horário da publicação antes de publicar.';
    }
  }

  return null;
}

/**
 * Checks if a content meets all requirements to advance to the next status.
 * Returns a list of missing requirements (empty = ready to advance).
 */
export function getMissingRequirements(content: Content): string[] {
  const missing: string[] = [];
  const s = content.status;

  if (s === 'writing' || s === 'idea') {
    if (!content.raw_text?.trim()) missing.push('Escrever texto base');
  }

  if (s === 'copy_approved' || s === 'design_queue') {
    if (!content.assigned_to && !content.designer_id) missing.push('Atribuir designer');
  }

  if (s === 'designing') {
    if (!content.figma_link?.trim()) missing.push('Adicionar link do Figma');
  }

  if (s === 'approved') {
    if (!content.scheduled_date) missing.push('Definir data de publicação');
    if (!content.scheduled_time) missing.push('Definir horário de publicação');
  }

  return missing;
}

/**
 * Returns contextual guidance for the current stage.
 */
export function getStageGuidance(content: Content): {
  hint: string;
  actions: string[];
} {
  switch (content.status) {
    case 'idea':
      return {
        hint: 'Defina o conceito, tema e plataforma. Quando estiver pronto, inicie a escrita.',
        actions: ['Preencher título e tema', 'Escolher plataforma e formato', 'Iniciar escrita'],
      };
    case 'writing':
      return {
        hint: 'Escreva o texto base. Use a IA para refinar. Envie para revisão quando a copy estiver pronta.',
        actions: [
          'Escrever texto base',
          ...(content.raw_text?.trim() ? ['Melhorar com IA'] : []),
          ...(content.raw_text?.trim() || content.improved_text?.trim() ? ['Enviar para revisão'] : []),
        ],
      };
    case 'copy_review':
      return {
        hint: 'A copy está aguardando revisão. Aprove na tela de Aprovação ou devolva com feedback.',
        actions: ['Revisar texto na tela de Aprovação', 'Aprovar ou devolver com feedback'],
      };
    case 'copy_approved':
      return {
        hint: 'Copy aprovada. Gere o brief para o designer e envie para a fila de design.',
        actions: [
          'Gerar brief criativo',
          'Atribuir designer',
          'Enviar para fila de design',
        ],
      };
    case 'design_queue':
      return {
        hint: 'Na fila de design. O designer pode iniciar o trabalho pela tela de Produção.',
        actions: ['Iniciar design na tela de Produção'],
      };
    case 'designing':
      return {
        hint: 'O designer está trabalhando. Adicione o link do Figma quando a peça estiver pronta.',
        actions: [
          'Criar peça visual',
          ...(content.figma_link?.trim() ? ['Enviar para revisão final'] : ['Adicionar link do Figma']),
        ],
      };
    case 'final_review':
      return {
        hint: 'Aguardando aprovação final. Revise texto + peça visual na tela de Aprovação.',
        actions: ['Aprovar ou devolver na tela de Aprovação'],
      };
    case 'approved':
      return {
        hint: 'Conteúdo aprovado. Defina data e horário de publicação para agendar.',
        actions: [
          ...(content.scheduled_date && content.scheduled_time ? ['Agendar publicação'] : ['Definir data e horário']),
        ],
      };
    case 'scheduled':
      return {
        hint: 'Agendado para publicação. Marque como publicado quando estiver no ar.',
        actions: ['Publicar quando estiver live'],
      };
    case 'published':
      return {
        hint: 'Conteúdo publicado.',
        actions: [],
      };
    default:
      return { hint: '', actions: [] };
  }
}
