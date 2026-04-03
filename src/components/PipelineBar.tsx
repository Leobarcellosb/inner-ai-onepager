import type { ContentStatus } from '@/types';
import { STATUS_LABELS } from '@/types';
import { Check } from 'lucide-react';

export const PIPELINE: ContentStatus[] = [
  'idea',
  'writing',
  'copy_review',
  'copy_approved',
  'design_queue',
  'designing',
  'final_review',
  'approved',
  'scheduled',
  'published',
];

const STEP_ACCENT: Record<ContentStatus, string> = {
  idea:          'hsl(240 5% 50%)',
  writing:       'hsl(217 88% 58%)',
  copy_review:   'hsl(38 90% 50%)',
  copy_approved: 'hsl(38 70% 45%)',
  design_queue:  'hsl(258 82% 64%)',
  designing:     'hsl(258 65% 55%)',
  final_review:  'hsl(200 85% 55%)',
  approved:      'hsl(142 60% 42%)',
  scheduled:     'hsl(142 45% 50%)',
  published:     'hsl(0 0% 88%)',
};

export { STEP_ACCENT as STATUS_ACCENT };

interface PipelineBarProps {
  currentStatus: ContentStatus;
  compact?: boolean;
}

export function PipelineBar({ currentStatus, compact }: PipelineBarProps) {
  const currentIdx = PIPELINE.indexOf(currentStatus);

  return (
    <div className="flex items-center gap-0 w-full overflow-x-auto py-1">
      {PIPELINE.map((status, i) => {
        const isDone = i < currentIdx;
        const isCurrent = i === currentIdx;
        const accent = STEP_ACCENT[status];

        return (
          <div key={status} className="flex items-center flex-1 min-w-0">
            <div className="flex flex-col items-center gap-1 shrink-0">
              <div
                className={`flex items-center justify-center rounded-full font-bold transition-all ${compact ? 'h-5 w-5 text-[8px]' : 'h-6 w-6 text-[9px]'}`}
                style={{
                  background: isCurrent ? accent : isDone ? accent : 'hsl(240 11% 13%)',
                  color: isCurrent || isDone ? '#fff' : 'hsl(240 5% 35%)',
                  boxShadow: isCurrent ? `0 0 12px ${accent}50` : undefined,
                }}
              >
                {isDone ? <Check className="h-3 w-3" /> : i + 1}
              </div>
              {!compact && (
                <span
                  className="text-[8px] font-medium text-center leading-tight max-w-[56px] truncate"
                  style={{ color: isCurrent ? accent : isDone ? 'hsl(240 5% 65%)' : 'hsl(240 5% 35%)' }}
                >
                  {STATUS_LABELS[status]}
                </span>
              )}
            </div>
            {i < PIPELINE.length - 1 && (
              <div
                className="flex-1 h-px mx-0.5"
                style={{ background: i < currentIdx ? 'hsl(240 5% 40%)' : 'hsl(240 11% 13%)' }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// Pipeline transition rules
const TRANSITIONS: Record<ContentStatus, { next: ContentStatus | null; prev: ContentStatus | null }> = {
  idea:          { next: 'writing',       prev: null },
  writing:       { next: 'copy_review',   prev: 'idea' },
  copy_review:   { next: 'copy_approved', prev: 'writing' },
  copy_approved: { next: 'design_queue',  prev: 'copy_review' },
  design_queue:  { next: 'designing',     prev: 'copy_approved' },
  designing:     { next: 'final_review',  prev: 'design_queue' },
  final_review:  { next: 'approved',      prev: 'designing' },
  approved:      { next: 'scheduled',     prev: 'final_review' },
  scheduled:     { next: 'published',     prev: 'approved' },
  published:     { next: null,            prev: 'scheduled' },
};

const NEXT_LABELS: Partial<Record<ContentStatus, string>> = {
  idea:          'Iniciar escrita',
  writing:       'Enviar para revisão',
  copy_review:   'Aprovar copy',
  copy_approved: 'Enviar para design',
  design_queue:  'Iniciar design',
  designing:     'Enviar para revisão final',
  final_review:  'Aprovar',
  approved:      'Agendar publicação',
  scheduled:     'Publicar',
};

const PREV_LABELS: Partial<Record<ContentStatus, string>> = {
  writing:       'Voltar para ideia',
  copy_review:   'Devolver para escrita',
  copy_approved: 'Reabrir revisão',
  design_queue:  'Voltar para copy',
  designing:     'Devolver para fila',
  final_review:  'Devolver para design',
  approved:      'Reabrir revisão final',
  scheduled:     'Remover agendamento',
  published:     'Reabrir',
};

export function getNextTransition(status: ContentStatus) {
  const t = TRANSITIONS[status];
  if (!t.next) return null;
  return { status: t.next, label: NEXT_LABELS[status] ?? `Avançar para ${STATUS_LABELS[t.next]}` };
}

export function getPrevTransition(status: ContentStatus) {
  const t = TRANSITIONS[status];
  if (!t.prev) return null;
  return { status: t.prev, label: PREV_LABELS[status] ?? `Voltar para ${STATUS_LABELS[t.prev]}` };
}
