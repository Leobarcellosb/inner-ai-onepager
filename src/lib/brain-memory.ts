import { supabase } from '@/integrations/supabase/client';
import type { Content } from '@/types';

export async function recordApproval(content: Content, userId: string) {
  await supabase.from('brain_memories').insert({
    memory_type: 'approval',
    content_id: content.id,
    context: {
      title: content.title,
      platform: content.platform,
      format: content.format,
      text_preview: (content.improved_text || content.raw_text || '').slice(0, 300),
      cta: content.cta,
      had_figma: !!content.figma_link,
    },
    created_by: userId,
  });
}

export async function recordRejection(content: Content, feedback: string, userId: string) {
  await supabase.from('brain_memories').insert({
    memory_type: 'rejection',
    content_id: content.id,
    context: {
      title: content.title,
      platform: content.platform,
      format: content.format,
      text_preview: (content.improved_text || content.raw_text || '').slice(0, 300),
      feedback,
      reason: feedback.slice(0, 200),
    },
    created_by: userId,
  });
}

export async function recordOptimization(contentId: string, before: string, after: string, scoreBefore: number, scoreAfter: number, userId: string) {
  await supabase.from('brain_memories').insert({
    memory_type: 'optimization',
    content_id: contentId,
    context: {
      text_before: before.slice(0, 300),
      text_after: after.slice(0, 300),
      score_before: scoreBefore,
      score_after: scoreAfter,
      improvement: scoreAfter - scoreBefore,
    },
    created_by: userId,
  });
}

/**
 * Build memory context string for AI prompts.
 * Returns recent decisions and patterns as text.
 */
export async function getMemoryContext(): Promise<string> {
  const parts: string[] = [];

  try {
    // Recent approvals — what gets approved
    const { data: approvals } = await supabase.from('brain_memories')
      .select('context').eq('memory_type', 'approval')
      .order('created_at', { ascending: false }).limit(5);
    if (approvals?.length) {
      const patterns = approvals.map((a: any) => {
        const c = a.context;
        return `${c.platform}/${c.format}: "${(c.text_preview || '').slice(0, 80)}..."`;
      });
      parts.push(`Conteúdos aprovados recentemente:\n${patterns.join('\n')}`);
    }

    // Recent rejections — what to avoid
    const { data: rejections } = await supabase.from('brain_memories')
      .select('context').eq('memory_type', 'rejection')
      .order('created_at', { ascending: false }).limit(5);
    if (rejections?.length) {
      const reasons = rejections.map((r: any) => r.context?.reason || r.context?.feedback || '?').filter(Boolean);
      if (reasons.length > 0) {
        parts.push(`Motivos de rejeição recentes (EVITAR):\n${reasons.join('\n')}`);
      }
    }

    // Optimization patterns — what improves scores
    const { data: opts } = await supabase.from('brain_memories')
      .select('context').eq('memory_type', 'optimization')
      .order('created_at', { ascending: false }).limit(3);
    if (opts?.length) {
      const improvements = opts
        .filter((o: any) => o.context?.improvement > 10)
        .map((o: any) => `Score +${o.context.improvement}: "${(o.context.text_after || '').slice(0, 80)}..."`);
      if (improvements.length > 0) {
        parts.push(`Otimizações bem-sucedidas:\n${improvements.join('\n')}`);
      }
    }
  } catch { /* no memories yet */ }

  if (parts.length === 0) return '';
  return `\n\nMEMÓRIA DE DECISÕES:\n${parts.join('\n\n')}`;
}
