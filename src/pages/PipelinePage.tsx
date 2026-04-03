import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  closestCorners,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { AppLayout } from '@/components/AppLayout';
import { ContentStatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Loader2,
  Plus,
  Filter,
  ArrowRight,
  ExternalLink,
  Zap,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import {
  STATUS_LABELS,
  PLATFORM_LABELS,
  FORMAT_LABELS,
  PRIORITY_LABELS,
} from '@/types';
import type { Content, ContentStatus, ContentPriority } from '@/types';
import { PIPELINE, STATUS_ACCENT } from '@/components/PipelineBar';
import { validateTransition } from '@/lib/pipeline';
import { notifyStatusChange } from '@/lib/notifications';
import { auditLog } from '@/lib/audit';

const SURFACE    = 'hsl(240 13% 7%)';
const SURFACE_HI = 'hsl(240 15% 10%)';
const BORDER     = 'hsl(240 11% 13%)';

const PRIORITY_DOT: Record<ContentPriority, string> = {
  low:    'hsl(240 5% 45%)',
  medium: 'hsl(217 88% 58%)',
  high:   'hsl(38 90% 50%)',
  urgent: 'hsl(0 72% 51%)',
};

// ── Data ────────────────────────────────────────────────────────────────

import { useContents } from '@/hooks/useContents';
import { BrainAlerts } from '@/components/BrainAlerts';

// ── Card ────────────────────────────────────────────────────────────────

interface ContentScore {
  total: number;
  top_issue: string | null;
}

function PipelineCard({
  content,
  updatingId,
  onClick,
  score,
  onScore,
  scoring,
}: {
  content: Content;
  updatingId: string | null;
  onClick: (id: string) => void;
  score: ContentScore | null;
  onScore: (id: string) => void;
  scoring: boolean;
}) {
  const isUpdating = updatingId === content.id;
  const accent = STATUS_ACCENT[content.status];
  const priority = (content as any).priority as ContentPriority | undefined;
  const nextLabel = getNextActionLabel(content.status);
  const isDesignStage = ['design_queue', 'designing', 'final_review'].includes(content.status);

  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: content.id, data: { status: content.status } });

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.25 : 1,
    scale: isDragging ? '0.95' : '1',
    cursor: isUpdating ? 'wait' : isDragging ? 'grabbing' : 'grab',
    transition: isDragging ? 'scale 100ms' : 'opacity 150ms, scale 150ms, box-shadow 150ms',
    background: SURFACE_HI,
    border: isDragging ? `1px solid ${accent}40` : `1px solid hsl(240 11% 11%)`,
    boxShadow: isDragging ? `0 4px 20px rgba(0,0,0,0.3)` : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="rounded-lg p-2.5 flex flex-col gap-1.5 select-none group touch-none"
      onClick={(e) => { e.stopPropagation(); onClick(content.id); }}
    >
      {isUpdating && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground self-end" />}

      {/* Title */}
      <p className="text-[12px] font-medium text-foreground/90 leading-snug line-clamp-2">
        {content.title}
      </p>

      {/* Meta row: platform · format · badges */}
      <div className="flex items-center gap-1 text-[9px] text-muted-foreground">
        <span>{PLATFORM_LABELS[content.platform]}</span>
        <span className="text-muted-foreground/30">·</span>
        <span>{FORMAT_LABELS[content.format as keyof typeof FORMAT_LABELS]}</span>
        {content.copy_auto_approved && (
          <span className="ml-auto text-[8px] px-1.5 py-0.5 rounded-full font-semibold" style={{ background: 'hsl(38 90% 50% / 0.12)', color: 'hsl(38 90% 50%)' }}>
            PRÉ-APROVADO
          </span>
        )}
      </div>

      {/* Figma link (design stages) */}
      {isDesignStage && (
        <div className="flex items-center gap-1 mt-0.5">
          {content.figma_link ? (
            <a
              href={content.figma_link}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1 text-[9px] text-info hover:underline truncate"
            >
              <ExternalLink className="h-2.5 w-2.5 shrink-0" />
              Figma
            </a>
          ) : (
            <span className="flex items-center gap-1 text-[9px] text-warning/60">
              <ExternalLink className="h-2.5 w-2.5 shrink-0" />
              Sem Figma
            </span>
          )}
        </div>
      )}

      {/* Bottom row: priority + date */}
      <div className="flex items-center justify-between gap-1 mt-0.5">
        <div className="flex items-center gap-1.5">
          {priority && (
            <span className="h-2 w-2 rounded-full shrink-0" style={{ background: PRIORITY_DOT[priority] }} title={PRIORITY_LABELS[priority]} />
          )}
          {content.scheduled_datetime && (
            <span className="text-[9px] text-muted-foreground/60">
              {format(parseISO(content.scheduled_datetime), 'dd/MM')}
            </span>
          )}
        </div>
      </div>

      {/* Next action + quick actions */}
      <div className="flex items-center justify-between mt-0.5">
        {nextLabel && (
          <div className="flex items-center gap-1 text-[8px] font-semibold" style={{ color: accent }}>
            <ArrowRight className="h-2.5 w-2.5" />
            {nextLabel}
          </div>
        )}
        {/* Score badge + quick actions */}
        <div className="flex items-center gap-1 ml-auto">
          {score && (
            <span
              className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
              title={score.top_issue || 'Score de performance'}
              style={{
                background: score.total >= 80 ? 'hsl(142 60% 42% / 0.15)' : score.total >= 50 ? 'hsl(38 90% 50% / 0.15)' : 'hsl(0 72% 51% / 0.15)',
                color: score.total >= 80 ? 'hsl(142 60% 42%)' : score.total >= 50 ? 'hsl(38 90% 50%)' : 'hsl(0 72% 51%)',
              }}
            >
              {score.total}
            </span>
          )}
          <div className="hidden group-hover:flex items-center gap-0.5">
            {!score && content.raw_text?.trim() && (
              <button
                onClick={(e) => { e.stopPropagation(); onScore(content.id); }}
                disabled={scoring}
                className="p-1 rounded hover:bg-white/10 text-accent disabled:opacity-30"
                title="Avaliar performance"
              >
                {scoring ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
              </button>
            )}
            {content.figma_link && (
              <a href={content.figma_link} target="_blank" rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()} className="p-1 rounded hover:bg-white/10 text-info" title="Figma">
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function getNextActionLabel(status: ContentStatus): string | null {
  const labels: Partial<Record<ContentStatus, string>> = {
    idea:          'Iniciar escrita',
    writing:       'Enviar para revisão',
    copy_review:   'Aprovar copy',
    copy_approved: 'Enviar para design',
    design_queue:  'Iniciar design',
    designing:     'Enviar para revisão final',
    final_review:  'Aprovar',
    approved:      'Agendar',
    scheduled:     'Publicar',
  };
  return labels[status] ?? null;
}

// ── Column ──────────────────────────────────────────────────────────────

function PipelineColumn({
  status,
  cards,
  updatingId,
  onCardClick,
  invalidTarget,
  blockReason,
  scores,
  onScore,
  scoringId,
}: {
  status: ContentStatus;
  cards: Content[];
  updatingId: string | null;
  onCardClick: (id: string) => void;
  invalidTarget: boolean;
  blockReason: string | null;
  scores: Record<string, ContentScore>;
  onScore: (id: string) => void;
  scoringId: string | null;
}) {
  const accent = STATUS_ACCENT[status];
  const { setNodeRef, isOver } = useDroppable({ id: `col-${status}`, data: { status } });

  return (
    <div
      className="flex-shrink-0 w-48 flex flex-col rounded-xl overflow-hidden"
      style={{
        border: `1px solid ${isOver ? (invalidTarget ? 'hsl(0 72% 51% / 0.5)' : accent) : BORDER}`,
        background: SURFACE,
        boxShadow: isOver && !invalidTarget ? `0 0 16px ${accent}20, inset 0 0 20px ${accent}05` : undefined,
        transition: 'border-color 150ms, box-shadow 150ms',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-2.5 py-2 shrink-0"
        style={{ borderBottom: `1px solid ${BORDER}`, borderLeft: `3px solid ${accent}` }}
      >
        <span className="text-[10px] font-semibold truncate" style={{ color: accent }}>
          {STATUS_LABELS[status]}
        </span>
        <span
          className="text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0"
          style={{ background: `${accent}15`, color: accent }}
        >
          {cards.length}
        </span>
      </div>

      {/* Cards */}
      <div
        ref={setNodeRef}
        className="flex-1 overflow-y-auto p-1.5 space-y-1.5"
        style={{
          minHeight: 100,
          maxHeight: 'calc(100vh - 240px)',
          background: isOver ? (invalidTarget ? 'hsl(0 72% 51% / 0.03)' : `${accent}05`) : undefined,
          transition: 'background 150ms',
        }}
      >
        {cards.length === 0 ? (
          <div
            className="flex items-center justify-center rounded-lg border border-dashed text-[10px]"
            style={{
              minHeight: 60,
              borderColor: isOver ? (invalidTarget ? 'hsl(0 72% 51% / 0.3)' : `${accent}30`) : 'hsl(240 11% 11%)',
              color: 'hsl(240 5% 30%)',
            }}
          >
            {isOver ? (invalidTarget ? (blockReason || 'Bloqueado') : 'Soltar aqui') : '—'}
          </div>
        ) : (
          cards.map((c) => (
            <PipelineCard key={c.id} content={c} updatingId={updatingId} onClick={onCardClick} score={scores[c.id] ?? null} onScore={onScore} scoring={scoringId === c.id} />
          ))
        )}
      </div>
    </div>
  );
}

// ── Overlay ─────────────────────────────────────────────────────────────

function OverlayCard({ content }: { content: Content }) {
  const accent = STATUS_ACCENT[content.status];
  return (
    <div
      className="w-48 rounded-lg p-2.5"
      style={{
        background: SURFACE_HI,
        border: `1px solid ${accent}`,
        boxShadow: `0 12px 32px rgba(0,0,0,0.5), 0 0 0 1px ${accent}30`,
        cursor: 'grabbing',
        transform: 'rotate(1.5deg) scale(1.02)',
      }}
    >
      <p className="text-[12px] font-medium text-foreground leading-snug line-clamp-2 mb-1">
        {content.title}
      </p>
      <span className="text-[9px] text-muted-foreground">
        {PLATFORM_LABELS[content.platform]} · {FORMAT_LABELS[content.format as keyof typeof FORMAT_LABELS]}
      </span>
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────────────

export default function PipelinePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: contents = [], isLoading } = useContents();

  const [activeContent, setActiveContent] = useState<Content | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [platformFilter, setPlatformFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [dragTargetStatus, setDragTargetStatus] = useState<ContentStatus | null>(null);
  const [scores, setScores] = useState<Record<string, ContentScore>>({});
  const [scoringId, setScoringId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const filtered = useMemo(() =>
    contents.filter((c) => {
      if (platformFilter !== 'all' && c.platform !== platformFilter) return false;
      if (priorityFilter !== 'all' && (c as any).priority !== priorityFilter) return false;
      return true;
    }),
    [contents, platformFilter, priorityFilter],
  );

  const handleScore = useCallback(async (contentId: string) => {
    const target = contents.find(c => c.id === contentId);
    if (!target) return;
    setScoringId(contentId);
    try {
      const { data, error } = await supabase.functions.invoke('score-content', {
        body: { text: target.improved_text || target.raw_text, title: target.title, cta: target.cta },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setScores(prev => ({ ...prev, [contentId]: data.score as ContentScore }));
    } catch (e: any) {
      toast.error(e.message || 'Erro ao avaliar');
    } finally {
      setScoringId(null);
    }
  }, [contents]);

  // Returns null if valid, or a reason string if blocked
  const getDropBlockReason = useCallback((targetStatus: ContentStatus): string | null => {
    if (!activeContent || activeContent.status === targetStatus) return '';
    if (targetStatus === 'final_review' && !activeContent.figma_link?.trim()) return 'Sem link do Figma';
    if ((targetStatus === 'copy_review' || targetStatus === 'copy_approved') &&
        !activeContent.raw_text?.trim() && !activeContent.improved_text?.trim()) return 'Sem texto escrito';
    if (targetStatus === 'scheduled' && (!activeContent.scheduled_date || !activeContent.scheduled_time)) return 'Sem data/hora';
    return null;
  }, [activeContent]);

  const isInvalidDrop = useCallback((targetStatus: ContentStatus) => {
    return getDropBlockReason(targetStatus) !== null;
  }, [getDropBlockReason]);

  const updateStatus = useCallback(async (contentId: string, newStatus: ContentStatus) => {
    const oldData = queryClient.getQueryData<Content[]>(['contents']);
    const target = oldData?.find((c) => c.id === contentId);
    if (!target || target.status === newStatus) return;

    // Frontend pre-check
    const blockReason = getDropBlockReason(newStatus);
    if (blockReason) {
      toast.error(`Não é possível mover para "${STATUS_LABELS[newStatus]}": ${blockReason}`);
      return;
    }

    // Optimistic: move card instantly
    queryClient.setQueryData<Content[]>(['contents'], (old) =>
      old?.map((c) => c.id === contentId ? { ...c, status: newStatus } : c),
    );
    setUpdatingId(contentId);

    try {
      const { error: dbError } = await supabase
        .from('contents')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', contentId);

      if (dbError) {
        const msg = dbError.message?.includes('RAISE')
          ? dbError.message.replace(/.*RAISE.*: /, '')
          : dbError.message;
        throw new Error(msg);
      }

      if (user?.id) {
        notifyStatusChange(contentId, target.title, newStatus, target.assigned_to, target.created_by, user.id);
        auditLog('status_change', 'content', contentId, user.id, { from: target.status, to: newStatus, title: target.title, via: 'pipeline_kanban' });
      }

      queryClient.invalidateQueries({ queryKey: ['contents'] });
      toast.success(`"${target.title}" → ${STATUS_LABELS[newStatus]}`);
    } catch (err: any) {
      queryClient.setQueryData<Content[]>(['contents'], oldData);
      toast.error(err.message || 'Erro ao mover conteúdo');
    } finally {
      setUpdatingId(null);
    }
  }, [queryClient, user?.id]);

  const handleDragStart = (e: DragStartEvent) => {
    setActiveContent(contents.find((c) => c.id === e.active.id) ?? null);
  };

  const handleDragOver = (e: any) => {
    const status = e.over?.data?.current?.status as ContentStatus | undefined;
    setDragTargetStatus(status ?? null);
  };

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveContent(null);
    setDragTargetStatus(null);
    if (!e.over) return;
    const targetStatus = e.over.data.current?.status as ContentStatus | undefined;
    if (targetStatus) updateStatus(e.active.id as string, targetStatus);
  };

  // Summary counts
  const counts = useMemo(() => {
    const total = filtered.length;
    const blocked = filtered.filter((c) => {
      const next = PIPELINE[PIPELINE.indexOf(c.status) + 1];
      return next ? !!validateTransition(c, next) : false;
    }).length;
    return { total, blocked };
  }, [filtered]);

  return (
    <AppLayout>
      <div className="space-y-4 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight">Pipeline</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {counts.total} conteúdo{counts.total !== 1 ? 's' : ''}
              {counts.blocked > 0 && (
                <span className="text-warning ml-2">· {counts.blocked} bloqueado{counts.blocked !== 1 ? 's' : ''}</span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={platformFilter} onValueChange={setPlatformFilter}>
              <SelectTrigger className="h-8 w-[110px] text-xs border-0 bg-transparent hover:bg-white/5">
                <Filter className="h-3 w-3 mr-1 text-muted-foreground" />
                <SelectValue placeholder="Plataforma" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {Object.entries(PLATFORM_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="h-8 w-[110px] text-xs border-0 bg-transparent hover:bg-white/5">
                <SelectValue placeholder="Prioridade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {Object.entries(PRIORITY_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              onClick={() => navigate('/contents/new')}
              style={{ background: 'hsl(258 82% 64%)', color: '#fff' }}
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Novo
            </Button>
          </div>
        </div>

        {/* Board */}
        {/* Brain alerts */}
        <BrainAlerts compact />

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            <div className="flex gap-2 overflow-x-auto pb-4" style={{ minHeight: '70vh' }}>
              {PIPELINE.map((status) => (
                <PipelineColumn
                  key={status}
                  status={status}
                  cards={filtered.filter((c) => c.status === status)}
                  updatingId={updatingId}
                  onCardClick={(id) => navigate(`/contents/${id}`)}
                  invalidTarget={dragTargetStatus === status && isInvalidDrop(status)}
                  blockReason={dragTargetStatus === status ? getDropBlockReason(status) : null}
                  scores={scores}
                  onScore={handleScore}
                  scoringId={scoringId}
                />
              ))}
            </div>

            <DragOverlay dropAnimation={{ duration: 200, easing: 'cubic-bezier(0.2, 0, 0, 1)' }}>
              {activeContent && <OverlayCard content={activeContent} />}
            </DragOverlay>
          </DndContext>
        )}
      </div>
    </AppLayout>
  );
}
