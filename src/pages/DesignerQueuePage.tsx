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
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Loader2,
  ExternalLink,
  FileText,
  Palette,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { PLATFORM_LABELS, FORMAT_LABELS, STATUS_LABELS } from '@/types';
import { notifyStatusChange } from '@/lib/notifications';
import type { Content, ContentStatus, Brief } from '@/types';

const SURFACE    = 'hsl(240 13% 7%)';
const SURFACE_HI = 'hsl(240 15% 10%)';
const BORDER     = 'hsl(240 11% 13%)';

const QUEUE_COLUMNS: { status: ContentStatus; accent: string }[] = [
  { status: 'design_queue', accent: 'hsl(258 82% 64%)' },
  { status: 'designing',         accent: 'hsl(200 85% 55%)' },
];

// ── Data hooks ──────────────────────────────────────────────────────────

function useDesignerContents(userId: string | undefined, isAdmin: boolean) {
  return useQuery<Content[]>({
    queryKey: ['contents', 'designer-queue', userId],
    queryFn: async () => {
      let query = supabase
        .from('contents')
        .select('*')
        .in('status', ['design_queue', 'designing'])
        .order('updated_at', { ascending: false });
      if (!isAdmin && userId) {
        query = query.eq('assigned_to', userId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as Content[];
    },
    enabled: !!userId,
  });
}

function useBriefsForContents(contentIds: string[]) {
  return useQuery<Brief[]>({
    queryKey: ['briefs', 'designer-queue', contentIds],
    queryFn: async () => {
      if (contentIds.length === 0) return [];
      const { data } = await supabase
        .from('briefs')
        .select('*')
        .in('content_id', contentIds)
        .order('created_at', { ascending: false });
      return (data ?? []) as Brief[];
    },
    enabled: contentIds.length > 0,
  });
}

// ── Designer Card ──────────────────────────────────────────────────────

interface DesignerCardProps {
  content: Content;
  brief: Brief | undefined;
  updatingId: string | null;
  onNavigate: (id: string) => void;
}

function DesignerCard({ content, brief, updatingId, onNavigate }: DesignerCardProps) {
  const [expanded, setExpanded] = useState(false);
  const isUpdating = updatingId === content.id;

  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: content.id, data: { status: content.status } });

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.35 : 1,
    cursor: isUpdating ? 'wait' : 'grab',
    transition: isDragging ? undefined : 'opacity 150ms',
    background: SURFACE_HI,
    border: `1px solid hsl(240 11% 11%)`,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="rounded-lg select-none"
    >
      {/* Card header */}
      <div
        className="p-3 flex flex-col gap-1.5"
        onClick={(e) => { e.stopPropagation(); onNavigate(content.id); }}
      >
        {isUpdating && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground self-end" />}
        <p className="text-sm font-medium text-foreground/90 leading-snug line-clamp-2">
          {content.title}
        </p>
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <span>{PLATFORM_LABELS[content.platform]}</span>
          <span className="text-muted-foreground/40">·</span>
          <span>{FORMAT_LABELS[content.format as keyof typeof FORMAT_LABELS]}</span>
        </div>
        {content.scheduled_datetime && (
          <span className="text-[10px] font-medium text-accent">
            {format(parseISO(content.scheduled_datetime), 'dd/MM · HH:mm')}
          </span>
        )}
        {content.figma_link && (
          <a
            href={content.figma_link}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1 text-[10px] text-info hover:underline mt-0.5"
          >
            <ExternalLink className="h-3 w-3" />
            Figma
          </a>
        )}
      </div>

      {/* Brief toggle */}
      {brief && (
        <div style={{ borderTop: `1px solid hsl(240 11% 11%)` }}>
          <button
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
            className="flex items-center gap-1.5 w-full px-3 py-2 text-[10px] font-semibold text-muted-foreground hover:text-foreground transition-colors"
          >
            <FileText className="h-3 w-3" />
            Brief
            {expanded ? <ChevronUp className="h-3 w-3 ml-auto" /> : <ChevronDown className="h-3 w-3 ml-auto" />}
          </button>
          {expanded && (
            <div className="px-3 pb-3 space-y-2">
              {brief.creative_angle && (
                <div>
                  <span className="text-[9px] uppercase tracking-wider text-muted-foreground/60 font-semibold">Ângulo criativo</span>
                  <p className="text-[11px] text-foreground/70 mt-0.5 line-clamp-3">{brief.creative_angle}</p>
                </div>
              )}
              {brief.visual_direction && (
                <div>
                  <span className="text-[9px] uppercase tracking-wider text-muted-foreground/60 font-semibold">Direção visual</span>
                  <p className="text-[11px] text-foreground/70 mt-0.5 line-clamp-3">{brief.visual_direction}</p>
                </div>
              )}
              {brief.key_message && (
                <div>
                  <span className="text-[9px] uppercase tracking-wider text-muted-foreground/60 font-semibold">Mensagem-chave</span>
                  <p className="text-[11px] text-foreground/70 mt-0.5 line-clamp-2">{brief.key_message}</p>
                </div>
              )}
              {brief.designer_notes && (
                <div>
                  <span className="text-[9px] uppercase tracking-wider text-muted-foreground/60 font-semibold">Notas</span>
                  <p className="text-[11px] text-foreground/70 mt-0.5 line-clamp-3">{brief.designer_notes}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Column ──────────────────────────────────────────────────────────────

function QueueColumn({
  status,
  accent,
  cards,
  briefs,
  updatingId,
  onNavigate,
}: {
  status: ContentStatus;
  accent: string;
  cards: Content[];
  briefs: Brief[];
  updatingId: string | null;
  onNavigate: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `col-${status}`, data: { status } });
  const briefMap = useMemo(() => {
    const map: Record<string, Brief> = {};
    briefs.forEach((b) => { if (!map[b.content_id]) map[b.content_id] = b; });
    return map;
  }, [briefs]);

  return (
    <div
      className="flex-1 min-w-[280px] flex flex-col rounded-xl overflow-hidden"
      style={{ border: `1px solid ${isOver ? accent + '50' : BORDER}`, background: SURFACE, transition: 'border-color 150ms' }}
    >
      <div
        className="flex items-center justify-between px-4 py-3 shrink-0"
        style={{ borderBottom: `1px solid ${BORDER}`, borderLeft: `3px solid ${accent}` }}
      >
        <span className="text-sm font-semibold" style={{ color: accent }}>
          {STATUS_LABELS[status]}
        </span>
        <Badge
          className="text-[10px] font-bold"
          style={{ background: `${accent}18`, color: accent, border: 'none' }}
        >
          {cards.length}
        </Badge>
      </div>
      <div
        ref={setNodeRef}
        className="flex-1 overflow-y-auto p-2 space-y-2"
        style={{
          minHeight: 200,
          background: isOver ? `${accent}06` : undefined,
          transition: 'background 150ms',
        }}
      >
        {cards.length === 0 ? (
          <div
            className="flex items-center justify-center rounded-lg border-2 border-dashed text-xs"
            style={{ minHeight: 100, borderColor: isOver ? `${accent}40` : 'hsl(240 11% 11%)', color: 'hsl(240 5% 35%)' }}
          >
            {isOver ? 'Soltar aqui' : 'Nenhum item'}
          </div>
        ) : (
          cards.map((c) => (
            <DesignerCard
              key={c.id}
              content={c}
              brief={briefMap[c.id]}
              updatingId={updatingId}
              onNavigate={onNavigate}
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
      className="w-72 rounded-lg p-3 shadow-2xl"
      style={{
        background: SURFACE_HI,
        border: '1px solid hsl(258 82% 64% / 0.4)',
        boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
        cursor: 'grabbing',
        transform: 'rotate(2deg)',
      }}
    >
      <p className="text-sm font-medium text-foreground/90 leading-snug line-clamp-2 mb-1">
        {content.title}
      </p>
      <span className="text-[10px] text-muted-foreground">
        {PLATFORM_LABELS[content.platform]} · {FORMAT_LABELS[content.format as keyof typeof FORMAT_LABELS]}
      </span>
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────────────

export default function DesignerQueuePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, hasRole } = useAuth();
  const isAdmin = hasRole('admin');

  const { data: contents = [], isLoading } = useDesignerContents(user?.id, isAdmin);
  const contentIds = useMemo(() => contents.map((c) => c.id), [contents]);
  const { data: briefs = [] } = useBriefsForContents(contentIds);

  const [activeContent, setActiveContent] = useState<Content | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const updateStatus = useCallback(async (contentId: string, newStatus: ContentStatus) => {
    const oldData = queryClient.getQueryData<Content[]>(['contents', 'designer-queue', user?.id]);
    const target = oldData?.find((c) => c.id === contentId);
    if (!target || target.status === newStatus) return;

    queryClient.setQueryData<Content[]>(['contents', 'designer-queue', user?.id], (old) =>
      old?.map((c) => c.id === contentId ? { ...c, status: newStatus } : c),
    );
    setUpdatingId(contentId);

    try {
      const { error } = await supabase
        .from('contents')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', contentId);
      if (error) throw error;

      // Notify content creator
      if (user?.id) {
        await notifyStatusChange(contentId, target.title, newStatus, target.assigned_to, target.created_by, user.id);
      }

      queryClient.invalidateQueries({ queryKey: ['contents'] });
      toast.success(`Movido para "${STATUS_LABELS[newStatus]}"`);
    } catch {
      queryClient.setQueryData<Content[]>(['contents', 'designer-queue', user?.id], oldData);
      toast.error('Falha ao atualizar status');
    } finally {
      setUpdatingId(null);
    }
  }, [queryClient, user?.id]);

  const handleDeliver = useCallback(async (contentId: string) => {
    const target = contents.find((c) => c.id === contentId);
    if (!target) return;

    setUpdatingId(contentId);
    try {
      const { error } = await supabase
        .from('contents')
        .update({ status: 'final_review', updated_at: new Date().toISOString() })
        .eq('id', contentId);
      if (error) throw error;

      if (user?.id) {
        await notifyStatusChange(contentId, target.title, 'final_review', target.assigned_to, target.created_by, user.id);
      }

      queryClient.invalidateQueries({ queryKey: ['contents'] });
      toast.success('Entregue para aprovação!');
    } catch {
      toast.error('Falha ao entregar');
    } finally {
      setUpdatingId(null);
    }
  }, [contents, queryClient, user?.id]);

  const handleDragStart = (e: DragStartEvent) => {
    setActiveContent(contents.find((c) => c.id === e.active.id) ?? null);
  };

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveContent(null);
    if (!e.over) return;
    const targetStatus = e.over.data.current?.status as ContentStatus | undefined;
    if (targetStatus) updateStatus(e.active.id as string, targetStatus);
  };

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold flex items-center gap-2">
              <Palette className="h-6 w-6 text-accent" />
              Fila de Design
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {isAdmin ? 'Todos os conteúdos aguardando design' : 'Conteúdos atribuídos a você'}
            </p>
          </div>
          <Badge
            className="text-xs font-semibold"
            style={{ background: 'hsl(258 82% 64% / 0.12)', color: 'hsl(258 82% 64%)', border: 'none' }}
          >
            {contents.length} na fila
          </Badge>
        </div>

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
            <div className="flex gap-4" style={{ minHeight: '65vh' }}>
              {QUEUE_COLUMNS.map(({ status, accent }) => (
                <QueueColumn
                  key={status}
                  status={status}
                  accent={accent}
                  cards={contents.filter((c) => c.status === status)}
                  briefs={briefs}
                  updatingId={updatingId}
                  onNavigate={(id) => navigate(`/contents/${id}`)}
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
