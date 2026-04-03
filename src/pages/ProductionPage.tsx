import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Loader2,
  ExternalLink,
  FileText,
  ChevronDown,
  ChevronUp,
  PenLine,
  Palette,
  User,
  Link as LinkIcon,
  Send,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import {
  STATUS_LABELS,
  PLATFORM_LABELS,
  FORMAT_LABELS,
  PRIORITY_LABELS,
} from '@/types';
import type { Content, ContentStatus, ContentPriority, Brief } from '@/types';
import { STATUS_ACCENT } from '@/components/PipelineBar';
import { validateTransition } from '@/lib/pipeline';
import { notifyStatusChange } from '@/lib/notifications';

const SURFACE    = 'hsl(240 13% 7%)';
const SURFACE_HI = 'hsl(240 15% 10%)';
const BORDER     = 'hsl(240 11% 13%)';

const PRIORITY_DOT: Record<ContentPriority, string> = {
  low:    'hsl(240 5% 45%)',
  medium: 'hsl(217 88% 58%)',
  high:   'hsl(38 90% 50%)',
  urgent: 'hsl(0 72% 51%)',
};

type Lane = 'copy' | 'design';

const LANE_CONFIG: Record<Lane, { label: string; icon: React.ElementType; statuses: ContentStatus[]; accent: string }> = {
  copy:   { label: 'Copy & Revisão', icon: PenLine, statuses: ['writing', 'copy_review'],    accent: 'hsl(217 88% 58%)' },
  design: { label: 'Design',         icon: Palette, statuses: ['design_queue', 'designing'], accent: 'hsl(258 82% 64%)' },
};

import { useContents } from '@/hooks/useContents';

const PRODUCTION_STATUSES: ContentStatus[] = ['writing', 'copy_review', 'design_queue', 'designing'];

function useBriefsForContents(ids: string[]) {
  return useQuery<Brief[]>({
    queryKey: ['briefs', 'production', ids],
    queryFn: async () => {
      if (ids.length === 0) return [];
      const { data } = await supabase
        .from('briefs')
        .select('*')
        .in('content_id', ids)
        .order('created_at', { ascending: false });
      return (data ?? []) as Brief[];
    },
    enabled: ids.length > 0,
  });
}

function useTeamProfiles() {
  return useQuery({
    queryKey: ['team-profiles'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('id, name');
      return (data ?? []) as { id: string; name: string }[];
    },
  });
}

// ── Card ────────────────────────────────────────────────────────────────

function ProductionCard({
  content,
  brief,
  updatingId,
  onClick,
  onSaveFigma,
  onDeliver,
}: {
  content: Content;
  brief: Brief | undefined;
  updatingId: string | null;
  onClick: (id: string) => void;
  onSaveFigma: (id: string, link: string) => void;
  onDeliver: (id: string) => void;
}) {
  const [briefOpen, setBriefOpen] = useState(false);
  const [figmaInput, setFigmaInput] = useState(content.figma_link ?? '');
  const [figmaOpen, setFigmaOpen] = useState(false);
  const isDesignCard = content.status === 'design_queue' || content.status === 'designing';
  const isUpdating = updatingId === content.id;
  const accent = STATUS_ACCENT[content.status];
  const priority = (content as any).priority as ContentPriority | undefined;

  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: content.id, data: { status: content.status } });

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.3 : 1,
    cursor: isUpdating ? 'wait' : 'grab',
    transition: isDragging ? undefined : 'opacity 150ms',
    background: SURFACE_HI,
    border: `1px solid hsl(240 11% 11%)`,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="rounded-lg select-none">
      <div className="p-3 flex flex-col gap-1.5" onClick={(e) => { e.stopPropagation(); onClick(content.id); }}>
        {isUpdating && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground self-end" />}

        {/* Title + status */}
        <div className="flex items-start justify-between gap-2">
          <p className="text-[12px] font-medium text-foreground/90 leading-snug line-clamp-2 flex-1">
            {content.title}
          </p>
          <ContentStatusBadge status={content.status} />
        </div>

        {/* Meta */}
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

        {/* Bottom: priority + owner + date + figma */}
        <div className="flex items-center justify-between gap-1 mt-0.5">
          <div className="flex items-center gap-1.5">
            {priority && (
              <span
                className="h-2 w-2 rounded-full shrink-0"
                style={{ background: PRIORITY_DOT[priority] }}
                title={PRIORITY_LABELS[priority]}
              />
            )}
            {content.profiles?.name && (
              <span className="text-[9px] text-muted-foreground/70 truncate max-w-[80px]">
                {content.profiles.name.split(' ')[0]}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {content.figma_link && (
              <a
                href={content.figma_link}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-info hover:text-info/80"
              >
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
            {content.scheduled_datetime && (
              <span className="text-[9px] font-medium" style={{ color: accent }}>
                {format(parseISO(content.scheduled_datetime), 'dd/MM')}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Brief toggle (design cards only) */}
      {brief && (
        <div style={{ borderTop: '1px solid hsl(240 11% 11%)' }}>
          <button
            onClick={(e) => { e.stopPropagation(); setBriefOpen(!briefOpen); }}
            className="flex items-center gap-1.5 w-full px-3 py-1.5 text-[9px] font-semibold text-muted-foreground hover:text-foreground transition-colors"
          >
            <FileText className="h-3 w-3" />
            Brief
            {briefOpen ? <ChevronUp className="h-3 w-3 ml-auto" /> : <ChevronDown className="h-3 w-3 ml-auto" />}
          </button>
          {briefOpen && (
            <div className="px-3 pb-3 space-y-1.5">
              {brief.creative_angle && (
                <BriefField label="Ângulo criativo" value={brief.creative_angle} />
              )}
              {brief.visual_direction && (
                <BriefField label="Direção visual" value={brief.visual_direction} />
              )}
              {brief.key_message && (
                <BriefField label="Mensagem-chave" value={brief.key_message} />
              )}
              {brief.designer_notes && (
                <BriefField label="Notas" value={brief.designer_notes} />
              )}
            </div>
          )}
        </div>
      )}

      {/* Carousel script preview (design cards with carousel) */}
      {isDesignCard && content.format === 'carrossel' && content.carousel_script && (
        <div style={{ borderTop: '1px solid hsl(240 11% 11%)' }}>
          <div className="px-3 py-2">
            <span className="text-[9px] uppercase tracking-wider text-accent/60 font-semibold">Roteiro ({(content.carousel_script as any)?.slides?.length ?? '?'} slides)</span>
            <div className="mt-1 space-y-0.5">
              {((content.carousel_script as any)?.slides ?? []).slice(0, 4).map((s: any) => (
                <p key={s.position} className="text-[9px] text-foreground/50 truncate">
                  <span className="text-accent/50">{s.position}.</span> {s.headline}
                </p>
              ))}
              {((content.carousel_script as any)?.slides?.length ?? 0) > 4 && (
                <p className="text-[8px] text-muted-foreground/40">+{(content.carousel_script as any).slides.length - 4} mais</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Figma link + deliver (design cards only) */}
      {isDesignCard && (
        <div style={{ borderTop: '1px solid hsl(240 11% 11%)' }}>
          {!figmaOpen && !content.figma_link ? (
            <button
              onClick={(e) => { e.stopPropagation(); setFigmaOpen(true); }}
              className="flex items-center gap-1.5 w-full px-3 py-2 text-[9px] font-semibold text-muted-foreground hover:text-accent transition-colors"
            >
              <LinkIcon className="h-3 w-3" />
              Adicionar link do Figma
            </button>
          ) : (
            <div className="px-3 py-2 space-y-2" onClick={(e) => e.stopPropagation()}>
              <div className="flex gap-1.5">
                <Input
                  value={figmaInput}
                  onChange={(e) => setFigmaInput(e.target.value)}
                  placeholder="https://figma.com/..."
                  className="h-7 text-[10px] flex-1"
                  onPointerDown={(e) => e.stopPropagation()}
                />
                <button
                  onClick={() => { if (figmaInput.trim()) onSaveFigma(content.id, figmaInput.trim()); }}
                  disabled={!figmaInput.trim() || figmaInput === content.figma_link}
                  className="shrink-0 h-7 w-7 flex items-center justify-center rounded text-accent hover:bg-accent/10 disabled:opacity-30 transition-colors"
                >
                  <ExternalLink className="h-3 w-3" />
                </button>
              </div>
              {content.figma_link && content.status === 'designing' && (
                <button
                  onClick={() => onDeliver(content.id)}
                  disabled={isUpdating}
                  className="flex items-center gap-1 w-full justify-center py-1.5 rounded text-[10px] font-semibold text-white transition-colors"
                  style={{ background: 'hsl(142 60% 42%)' }}
                >
                  <Send className="h-3 w-3" />
                  Entregar para revisão final
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function BriefField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-[8px] uppercase tracking-wider text-muted-foreground/50 font-semibold">{label}</span>
      <p className="text-[10px] text-foreground/65 mt-0.5 line-clamp-3">{value}</p>
    </div>
  );
}

// ── Column ──────────────────────────────────────────────────────────────

function ProductionColumn({
  status,
  cards,
  briefs,
  updatingId,
  onCardClick,
  onSaveFigma,
  onDeliver,
}: {
  status: ContentStatus;
  cards: Content[];
  briefs: Brief[];
  updatingId: string | null;
  onCardClick: (id: string) => void;
  onSaveFigma: (id: string, link: string) => void;
  onDeliver: (id: string) => void;
}) {
  const accent = STATUS_ACCENT[status];
  const { setNodeRef, isOver } = useDroppable({ id: `col-${status}`, data: { status } });
  const briefMap = useMemo(() => {
    const map: Record<string, Brief> = {};
    briefs.forEach((b) => { if (!map[b.content_id]) map[b.content_id] = b; });
    return map;
  }, [briefs]);

  return (
    <div
      className="flex-1 min-w-[240px] flex flex-col rounded-xl overflow-hidden"
      style={{ border: `1px solid ${isOver ? accent + '50' : BORDER}`, background: SURFACE, transition: 'border-color 150ms' }}
    >
      <div
        className="flex items-center justify-between px-3 py-2.5 shrink-0"
        style={{ borderBottom: `1px solid ${BORDER}`, borderLeft: `3px solid ${accent}` }}
      >
        <span className="text-xs font-semibold" style={{ color: accent }}>
          {STATUS_LABELS[status]}
        </span>
        <Badge
          className="text-[9px] font-bold"
          style={{ background: `${accent}15`, color: accent, border: 'none' }}
        >
          {cards.length}
        </Badge>
      </div>
      <div
        ref={setNodeRef}
        className="flex-1 overflow-y-auto p-2 space-y-2"
        style={{
          minHeight: 120,
          background: isOver ? `${accent}05` : undefined,
          transition: 'background 150ms',
        }}
      >
        {cards.length === 0 ? (
          <div
            className="flex items-center justify-center rounded-lg border border-dashed text-[10px]"
            style={{ minHeight: 60, borderColor: isOver ? `${accent}30` : 'hsl(240 11% 11%)', color: 'hsl(240 5% 30%)' }}
          >
            {isOver ? 'Soltar aqui' : 'Nenhum item'}
          </div>
        ) : (
          cards.map((c) => (
            <ProductionCard
              key={c.id}
              content={c}
              brief={briefMap[c.id]}
              updatingId={updatingId}
              onClick={onCardClick}
              onSaveFigma={onSaveFigma}
              onDeliver={onDeliver}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ── Overlay ─────────────────────────────────────────────────────────────

function OverlayCard({ content }: { content: Content }) {
  return (
    <div
      className="w-56 rounded-lg p-3 shadow-2xl"
      style={{
        background: SURFACE_HI,
        border: '1px solid hsl(258 82% 64% / 0.4)',
        boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
        cursor: 'grabbing',
        transform: 'rotate(2deg)',
      }}
    >
      <p className="text-[12px] font-medium text-foreground/90 leading-snug line-clamp-2 mb-1">
        {content.title}
      </p>
      <span className="text-[9px] text-muted-foreground">
        {PLATFORM_LABELS[content.platform]} · {FORMAT_LABELS[content.format as keyof typeof FORMAT_LABELS]}
      </span>
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────────────

export default function ProductionPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, hasRole } = useAuth();
  const isAdmin = hasRole('admin');
  const isDesigner = hasRole('designer');

  const { data: allContents = [], isLoading } = useContents();
  const contents = useMemo(() => allContents.filter(c => PRODUCTION_STATUSES.includes(c.status)), [allContents]);
  const contentIds = useMemo(() => contents.map((c) => c.id), [contents]);
  const { data: briefs = [] } = useBriefsForContents(contentIds);
  const { data: team = [] } = useTeamProfiles();

  const [activeContent, setActiveContent] = useState<Content | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [activeLane, setActiveLane] = useState<Lane | 'all'>('all');
  const [ownerFilter, setOwnerFilter] = useState<string>('all');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  // Filter by lane + owner
  const visibleStatuses = activeLane === 'all'
    ? [...LANE_CONFIG.copy.statuses, ...LANE_CONFIG.design.statuses]
    : LANE_CONFIG[activeLane].statuses;

  const filtered = useMemo(() =>
    contents.filter((c) => {
      if (!visibleStatuses.includes(c.status)) return false;
      if (ownerFilter !== 'all') {
        if (ownerFilter === 'mine') return c.assigned_to === user?.id || c.created_by === user?.id;
        return c.assigned_to === ownerFilter || c.created_by === ownerFilter;
      }
      return true;
    }),
    [contents, visibleStatuses, ownerFilter, user?.id],
  );

  const updateStatus = useCallback(async (contentId: string, newStatus: ContentStatus) => {
    const oldData = queryClient.getQueryData<Content[]>(['contents']);
    const target = oldData?.find((c) => c.id === contentId);
    if (!target || target.status === newStatus) return;

    const error = validateTransition(target, newStatus);
    if (error) { toast.error(error); return; }

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
      }

      queryClient.invalidateQueries({ queryKey: ['contents'] });
      toast.success(`"${target.title}" → ${STATUS_LABELS[newStatus]}`);
    } catch (err: any) {
      queryClient.setQueryData<Content[]>(['contents'], oldData);
      toast.error(err.message || 'Erro ao atualizar');
    } finally {
      setUpdatingId(null);
    }
  }, [queryClient, user?.id]);

  const handleSaveFigma = useCallback(async (contentId: string, link: string) => {
    try {
      const { error } = await supabase.from('contents').update({ figma_link: link }).eq('id', contentId);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['contents'] });
      toast.success('Link do Figma salvo');
    } catch {
      toast.error('Erro ao salvar link');
    }
  }, [queryClient]);

  const handleDeliver = useCallback(async (contentId: string) => {
    const target = contents.find((c) => c.id === contentId);
    if (!target) return;
    if (!target.figma_link?.trim()) {
      toast.error('Adicione o link do Figma antes de entregar.');
      return;
    }
    updateStatus(contentId, 'final_review');
  }, [contents, updateStatus]);

  const handleDragStart = (e: DragStartEvent) => {
    setActiveContent(contents.find((c) => c.id === e.active.id) ?? null);
  };
  const handleDragEnd = (e: DragEndEvent) => {
    setActiveContent(null);
    if (!e.over) return;
    const targetStatus = e.over.data.current?.status as ContentStatus | undefined;
    if (targetStatus) updateStatus(e.active.id as string, targetStatus);
  };

  // Counts per lane
  const copyCount = contents.filter((c) => LANE_CONFIG.copy.statuses.includes(c.status)).length;
  const designCount = contents.filter((c) => LANE_CONFIG.design.statuses.includes(c.status)).length;

  return (
    <AppLayout>
      <div className="space-y-4 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight">Produção</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Fila operacional do time — o que cada pessoa precisa fazer agora
            </p>
          </div>
        </div>

        {/* Lane tabs + owner filter */}
        <div
          className="flex items-center justify-between gap-3 rounded-xl px-4 py-2.5"
          style={{ background: SURFACE, border: `1px solid ${BORDER}` }}
        >
          {/* Lane selector */}
          <div className="flex items-center gap-1">
            {([
              { id: 'all' as const, label: 'Tudo', count: contents.length },
              { id: 'copy' as const, label: 'Copy', count: copyCount, icon: PenLine },
              { id: 'design' as const, label: 'Design', count: designCount, icon: Palette },
            ]).map(({ id, label, count, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveLane(id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={{
                  background: activeLane === id ? 'hsl(258 82% 64%)' : 'transparent',
                  color: activeLane === id ? '#fff' : 'hsl(240 5% 50%)',
                }}
              >
                {Icon && <Icon className="h-3 w-3" />}
                {label}
                <span
                  className="text-[9px] font-bold px-1 py-0.5 rounded-full ml-0.5"
                  style={{
                    background: activeLane === id ? 'rgba(255,255,255,0.2)' : 'hsl(240 11% 13%)',
                    color: activeLane === id ? '#fff' : 'hsl(240 5% 45%)',
                  }}
                >
                  {count}
                </span>
              </button>
            ))}
          </div>

          {/* Owner filter */}
          <div className="flex items-center gap-1">
            <User className="h-3 w-3 text-muted-foreground" />
            <div className="flex items-center gap-0.5">
              <button
                onClick={() => setOwnerFilter('all')}
                className="px-2 py-1 rounded text-[10px] font-medium transition-all"
                style={{
                  background: ownerFilter === 'all' ? 'hsl(240 15% 13%)' : 'transparent',
                  color: ownerFilter === 'all' ? 'hsl(240 5% 85%)' : 'hsl(240 5% 45%)',
                }}
              >
                Todos
              </button>
              <button
                onClick={() => setOwnerFilter('mine')}
                className="px-2 py-1 rounded text-[10px] font-medium transition-all"
                style={{
                  background: ownerFilter === 'mine' ? 'hsl(240 15% 13%)' : 'transparent',
                  color: ownerFilter === 'mine' ? 'hsl(240 5% 85%)' : 'hsl(240 5% 45%)',
                }}
              >
                Meus
              </button>
              {isAdmin && team.filter((t) => t.id !== user?.id).slice(0, 5).map((t) => (
                <button
                  key={t.id}
                  onClick={() => setOwnerFilter(t.id)}
                  className="px-2 py-1 rounded text-[10px] font-medium transition-all truncate max-w-[60px]"
                  style={{
                    background: ownerFilter === t.id ? 'hsl(240 15% 13%)' : 'transparent',
                    color: ownerFilter === t.id ? 'hsl(240 5% 85%)' : 'hsl(240 5% 45%)',
                  }}
                >
                  {t.name.split(' ')[0]}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Board */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div className="flex gap-3" style={{ minHeight: '60vh' }}>
              {visibleStatuses.map((status) => (
                <ProductionColumn
                  key={status}
                  status={status}
                  cards={filtered.filter((c) => c.status === status)}
                  briefs={briefs}
                  updatingId={updatingId}
                  onCardClick={(id) => navigate(`/contents/${id}`)}
                  onSaveFigma={handleSaveFigma}
                  onDeliver={handleDeliver}
                />
              ))}
            </div>

            <DragOverlay dropAnimation={{ duration: 150, easing: 'ease' }}>
              {activeContent && <OverlayCard content={activeContent} />}
            </DragOverlay>
          </DndContext>
        )}
      </div>
    </AppLayout>
  );
}
