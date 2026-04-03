import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
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
  ChevronLeft,
  ChevronRight,
  CalendarIcon,
  List,
  LayoutGrid,
  AlertCircle,
  KanbanSquare,
  GanttChart,
  Loader2,
} from 'lucide-react';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  startOfWeek,
  endOfWeek,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  isToday,
  parseISO,
  differenceInCalendarDays,
  addDays,
  startOfDay,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  PLATFORM_LABELS,
  FORMAT_LABELS,
  STATUS_LABELS,
} from '@/types';
import type { Content, ContentStatus } from '@/types';

// ── Constants ──────────────────────────────────────────────────────────────

type TopView = 'calendar' | 'kanban' | 'gantt';
type CalSubView = 'month' | 'week' | 'list';
type GanttScale = 'dia' | 'semana' | 'mes';
type GanttGroup = 'none' | 'platform' | 'status' | 'responsavel';

const KANBAN_STATUS_ORDER: ContentStatus[] = [
  'idea', 'writing', 'copy_review', 'copy_approved',
  'design_queue', 'designing', 'final_review',
  'approved', 'scheduled', 'published',
];

const STATUS_ACCENT: Record<ContentStatus, string> = {
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

// Days visible per scale × pixels-per-day
const GANTT_SCALE_CONFIG: Record<GanttScale, { days: number; pxPerDay: number }> = {
  dia:    { days: 14,  pxPerDay: 64 },
  semana: { days: 42,  pxPerDay: 28 },
  mes:    { days: 90,  pxPerDay: 14 },
};

const SURFACE      = 'hsl(240 13% 7%)';
const SURFACE_HI   = 'hsl(240 15% 10%)';
const BORDER       = 'hsl(240 11% 13%)';
const BORDER_INNER = 'hsl(240 11% 11%)';

import { useContents } from '@/hooks/useContents';

// ── Kanban card (draggable + droppable target) ─────────────────────────────

interface KanbanCardProps {
  content: Content;
  updatingId: string | null;
  onClick: (id: string) => void;
}

function KanbanCard({ content, updatingId, onClick }: KanbanCardProps) {
  const isUpdating = updatingId === content.id;
  const accent     = STATUS_ACCENT[content.status];

  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: content.id, data: { status: content.status } });

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    opacity:   isDragging  ? 0.35 : 1,
    cursor:    isUpdating  ? 'wait' : 'grab',
    transition: isDragging ? undefined : 'opacity 150ms',
    background: SURFACE_HI,
    border: `1px solid ${BORDER_INNER}`,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="rounded-lg p-3 flex flex-col gap-2 select-none"
      onClick={(e) => { e.stopPropagation(); onClick(content.id); }}
    >
      {isUpdating && (
        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground self-end" />
      )}
      <p className="text-sm font-medium text-foreground/90 leading-snug line-clamp-2">
        {content.title}
      </p>
      <div className="flex flex-wrap gap-1.5">
        <span className="text-[10px] text-muted-foreground">
          {PLATFORM_LABELS[content.platform]}
        </span>
        {content.format && (
          <>
            <span className="text-[10px] text-muted-foreground/40">·</span>
            <span className="text-[10px] text-muted-foreground">
              {FORMAT_LABELS[content.format as keyof typeof FORMAT_LABELS]}
            </span>
          </>
        )}
      </div>
      <div className="flex items-center justify-between gap-1">
        {content.scheduled_datetime ? (
          <span className="text-[10px] font-medium" style={{ color: accent }}>
            {format(parseISO(content.scheduled_datetime), 'dd/MM')}
          </span>
        ) : (
          <span className="text-[10px] text-warning/60">sem data</span>
        )}
      </div>
    </div>
  );
}

// ── Kanban column (droppable) ──────────────────────────────────────────────

interface KanbanColumnProps {
  status: ContentStatus;
  cards: Content[];
  updatingId: string | null;
  onCardClick: (id: string) => void;
}

function KanbanColumn({ status, cards, updatingId, onCardClick }: KanbanColumnProps) {
  const accent = STATUS_ACCENT[status];
  const { setNodeRef, isOver } = useDroppable({
    id: `col-${status}`,
    data: { status },
  });

  return (
    <div
      className="flex-shrink-0 w-56 flex flex-col rounded-xl overflow-hidden"
      style={{ border: `1px solid ${isOver ? accent + '50' : BORDER}`, background: SURFACE, transition: 'border-color 150ms' }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2.5 shrink-0"
        style={{
          borderBottom: `1px solid ${BORDER}`,
          borderLeft: `3px solid ${accent}`,
        }}
      >
        <span className="text-xs font-semibold truncate" style={{ color: accent }}>
          {STATUS_LABELS[status]}
        </span>
        <span
          className="text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0"
          style={{ background: `${accent}18`, color: accent }}
        >
          {cards.length}
        </span>
      </div>

      {/* Cards */}
      <div
        ref={setNodeRef}
        className="flex-1 overflow-y-auto p-1.5 space-y-0.5"
        style={{
          minHeight: 120,
          maxHeight: 'calc(100vh - 310px)',
          background: isOver ? `${accent}06` : undefined,
          transition: 'background 150ms',
        }}
      >
        {cards.length === 0 ? (
          <div
            className="flex items-center justify-center rounded-lg border-2 border-dashed"
            style={{
              minHeight: 80,
              borderColor: isOver ? `${accent}40` : BORDER_INNER,
              color: 'hsl(240 5% 35%)',
              fontSize: 11,
              transition: 'all 150ms',
            }}
          >
            {isOver ? 'Soltar aqui' : 'Vazio'}
          </div>
        ) : (
          cards.map((c) => (
            <KanbanCard
              key={c.id}
              content={c}
              updatingId={updatingId}
              onClick={onCardClick}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ── Kanban drag overlay card ───────────────────────────────────────────────

function KanbanOverlayCard({ content }: { content: Content }) {
  const accent = STATUS_ACCENT[content.status];
  return (
    <div
      className="w-56 rounded-lg p-3 shadow-2xl"
      style={{
        background: SURFACE_HI,
        border: `1px solid ${accent}60`,
        boxShadow: `0 20px 40px rgba(0,0,0,0.6), 0 0 0 1px ${accent}30`,
        cursor: 'grabbing',
        transform: 'rotate(2deg)',
      }}
    >
      <p className="text-sm font-medium text-foreground/90 leading-snug line-clamp-2 mb-2">
        {content.title}
      </p>
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] text-muted-foreground">{PLATFORM_LABELS[content.platform]}</span>
        {content.scheduled_datetime && (
          <span className="text-[10px] font-medium ml-auto" style={{ color: accent }}>
            {format(parseISO(content.scheduled_datetime), 'dd/MM')}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Gantt bar row ──────────────────────────────────────────────────────────

interface GanttRowProps {
  content: Content;
  ganttStart: Date;
  pxPerDay: number;
  totalDays: number;
  onClick: (id: string) => void;
}

function GanttRow({ content, ganttStart, pxPerDay, totalDays, onClick }: GanttRowProps) {
  const accent = STATUS_ACCENT[content.status];
  const start  = startOfDay(parseISO(content.created_at));
  const end    = content.scheduled_datetime
    ? startOfDay(parseISO(content.scheduled_datetime))
    : start;

  const offsetDays = differenceInCalendarDays(start, ganttStart);
  const spanDays   = Math.max(1, differenceInCalendarDays(end, start));

  const leftPx  = Math.max(0, offsetDays * pxPerDay);
  const widthPx = Math.min(spanDays * pxPerDay, (totalDays - offsetDays) * pxPerDay);
  const visible = leftPx < totalDays * pxPerDay && leftPx + widthPx > 0;

  const isPoint = spanDays <= 1;

  const tooltipText = [
    content.title,
    `${STATUS_LABELS[content.status]} · ${PLATFORM_LABELS[content.platform]}`,
    `Criado: ${format(start, 'dd/MM/yyyy')}`,
    content.scheduled_datetime ? `Agendado: ${format(end, 'dd/MM/yyyy')}` : 'Sem agendamento',
    content.profiles?.name ? `Resp: ${content.profiles.name}` : null,
  ].filter(Boolean).join('\n');

  return (
    <div
      className="flex items-center cursor-pointer transition-colors group"
      style={{ height: 40, borderBottom: `1px solid ${BORDER_INNER}` }}
      onClick={() => onClick(content.id)}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.025)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = '')}
    >
      {/* Title col */}
      <div
        className="shrink-0 flex items-center gap-2 px-3 overflow-hidden"
        style={{ width: 220, borderRight: `1px solid ${BORDER}`, height: '100%' }}
      >
        <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: accent }} />
        <div className="min-w-0 flex-1">
          <span className="text-xs text-foreground/80 truncate font-medium block">{content.title}</span>
          <span className="text-[9px] text-muted-foreground/60 truncate block">
            {PLATFORM_LABELS[content.platform]}
            {content.profiles?.name ? ` · ${content.profiles.name}` : ''}
          </span>
        </div>
        <ContentStatusBadge status={content.status} />
      </div>

      {/* Timeline */}
      <div className="relative flex-1 overflow-hidden" style={{ height: '100%' }}>
        {visible && (
          <div
            className="absolute top-1/2 -translate-y-1/2 group-hover:brightness-125 transition-all"
            title={tooltipText}
            style={{
              left:         leftPx,
              width:        isPoint ? 12 : Math.max(widthPx, 12),
              height:       isPoint ? 12 : 10,
              background:   isPoint ? accent : `linear-gradient(90deg, ${accent}, ${accent}cc)`,
              borderRadius: isPoint ? '50%' : 5,
              boxShadow:    `0 0 10px 1px ${accent}40`,
            }}
          >
            {/* Show day count inside bar if wide enough */}
            {!isPoint && widthPx > 40 && (
              <span className="absolute inset-0 flex items-center justify-center text-[8px] font-bold text-white/80 select-none">
                {spanDays}d
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Calendar mini card ────────────────────────────────────────────────────

function CalCard({ content, onClick }: { content: Content; onClick: (id: string) => void }) {
  const accent = STATUS_ACCENT[content.status];
  return (
    <div
      onClick={() => onClick(content.id)}
      className="cursor-pointer rounded-md p-1.5 text-xs"
      style={{ background: SURFACE_HI, border: `1px solid ${BORDER_INNER}` }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'hsl(240 15% 13%)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = SURFACE_HI)}
    >
      <div className="font-medium truncate text-foreground/85 mb-0.5">{content.title}</div>
      <div className="flex items-center gap-1">
        <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: accent }} />
        <span className="text-muted-foreground text-[10px] truncate">
          {PLATFORM_LABELS[content.platform]}
          {content.scheduled_time && ` · ${content.scheduled_time.slice(0, 5)}`}
        </span>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────

export default function CalendarPage() {
  const navigate      = useNavigate();
  const queryClient   = useQueryClient();

  // Views
  const [topView,    setTopView]    = useState<TopView>('calendar');
  const [calSubView, setCalSubView] = useState<CalSubView>('month');
  const [ganttScale, setGanttScale] = useState<GanttScale>('semana');
  const [ganttGroup, setGanttGroup] = useState<GanttGroup>('none');

  // Navigation
  const [currentDate, setCurrentDate] = useState(new Date());

  // Filters
  const [statusFilter,   setStatusFilter]   = useState('all');
  const [platformFilter, setPlatformFilter] = useState('all');

  // DnD state
  const [activeContent, setActiveContent] = useState<Content | null>(null);
  const [updatingId,    setUpdatingId]    = useState<string | null>(null);

  const { data: contents = [], isLoading } = useContents();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  // ── Filtered data ──────────────────────────────────────────────────────

  const filtered = useMemo(() =>
    contents.filter((c) => {
      if (statusFilter   !== 'all' && c.status   !== statusFilter)   return false;
      if (platformFilter !== 'all' && c.platform !== platformFilter) return false;
      return true;
    }),
    [contents, statusFilter, platformFilter],
  );

  const scheduled   = useMemo(() => filtered.filter((c) =>  c.scheduled_datetime), [filtered]);
  const unscheduled = useMemo(() => filtered.filter((c) => !c.scheduled_datetime), [filtered]);

  // ── Navigation helpers ────────────────────────────────────────────────

  const prev = () => {
    if (topView === 'gantt' && ganttScale === 'dia') setCurrentDate(addDays(currentDate, -7));
    else if (topView === 'gantt' || calSubView === 'month') setCurrentDate(subMonths(currentDate, 1));
    else if (calSubView === 'week') setCurrentDate(subWeeks(currentDate, 1));
  };
  const next = () => {
    if (topView === 'gantt' && ganttScale === 'dia') setCurrentDate(addDays(currentDate, 7));
    else if (topView === 'gantt' || calSubView === 'month') setCurrentDate(addMonths(currentDate, 1));
    else if (calSubView === 'week') setCurrentDate(addWeeks(currentDate, 1));
  };
  const today = () => setCurrentDate(new Date());

  const showNav = topView === 'kanban'
    ? false
    : topView === 'gantt' || calSubView !== 'list';

  // ── Kanban: status update ─────────────────────────────────────────────

  const updateStatus = useCallback(async (contentId: string, newStatus: ContentStatus) => {
    const oldData = queryClient.getQueryData<Content[]>(['contents']);
    const prev = oldData?.find((c) => c.id === contentId);
    if (!prev || prev.status === newStatus) return;

    queryClient.setQueryData<Content[]>(['contents'], (old) =>
      old?.map((c) => c.id === contentId ? { ...c, status: newStatus } : c),
    );
    setUpdatingId(contentId);

    try {
      const { error } = await supabase
        .from('contents')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', contentId);

      if (error) throw error;

      // Refetch to sync with server (cache already shows correct state)
      queryClient.invalidateQueries({ queryKey: ['contents'] });
      toast.success(`Movido para "${STATUS_LABELS[newStatus]}"`);
    } catch {
      // Rollback to previous state
      queryClient.setQueryData<Content[]>(['contents'], oldData);
      toast.error('Falha ao atualizar status — alteração revertida');
    } finally {
      setUpdatingId(null);
    }
  }, [queryClient]);

  // ── DnD handlers ─────────────────────────────────────────────────────

  const handleDragStart = (event: DragStartEvent) => {
    const content = contents.find((c) => c.id === event.active.id);
    setActiveContent(content ?? null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveContent(null);
    const { active, over } = event;
    if (!over) return;

    const targetStatus = over.data.current?.status as ContentStatus | undefined;
    if (!targetStatus) return;

    updateStatus(active.id as string, targetStatus);
  };

  // ── Calendar geometry ─────────────────────────────────────────────────

  const monthStart = startOfMonth(currentDate);
  const monthEnd   = endOfMonth(currentDate);
  const calStart   = startOfWeek(monthStart, { locale: ptBR });
  const calEnd     = endOfWeek(monthEnd, { locale: ptBR });
  const calDays    = eachDayOfInterval({ start: calStart, end: calEnd });
  const weekStart  = startOfWeek(currentDate, { locale: ptBR });
  const weekEnd    = endOfWeek(currentDate, { locale: ptBR });
  const weekDays   = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const getContentsForDay = (day: Date) =>
    scheduled.filter((c) =>
      c.scheduled_datetime && isSameDay(parseISO(c.scheduled_datetime), day),
    );

  // ── Gantt geometry ────────────────────────────────────────────────────

  const { days: ganttDays, pxPerDay } = GANTT_SCALE_CONFIG[ganttScale];
  const ganttStart = startOfDay(
    ganttScale === 'dia' ? addDays(currentDate, -3) : startOfMonth(currentDate),
  );
  const ganttEnd   = addDays(ganttStart, ganttDays - 1);
  const ganttDayList = eachDayOfInterval({ start: ganttStart, end: ganttEnd });

  // Gantt grouped rows
  const ganttRows = useMemo(() => {
    if (ganttGroup === 'none') return [{ label: null, items: filtered }];
    if (ganttGroup === 'platform') {
      const groups: Record<string, Content[]> = {};
      filtered.forEach((c) => {
        (groups[c.platform] ??= []).push(c);
      });
      return Object.entries(groups).map(([k, items]) => ({
        label: PLATFORM_LABELS[k as keyof typeof PLATFORM_LABELS] ?? k,
        items,
      }));
    }
    if (ganttGroup === 'responsavel') {
      const groups: Record<string, Content[]> = {};
      filtered.forEach((c) => {
        const name = c.profiles?.name ?? 'Sem responsável';
        (groups[name] ??= []).push(c);
      });
      return Object.entries(groups).map(([label, items]) => ({ label, items }));
    }
    // by status
    return KANBAN_STATUS_ORDER.filter((s) => filtered.some((c) => c.status === s)).map((s) => ({
      label: STATUS_LABELS[s],
      items: filtered.filter((c) => c.status === s),
    }));
  }, [filtered, ganttGroup]);

  const dateLabel = (() => {
    if (topView === 'kanban') return 'Fluxo operacional';
    if (topView === 'gantt')
      return `${format(ganttStart, 'dd MMM', { locale: ptBR })} — ${format(ganttEnd, 'dd MMM yyyy', { locale: ptBR })}`;
    if (calSubView === 'week')
      return `${format(weekStart, 'dd MMM', { locale: ptBR })} — ${format(weekEnd, 'dd MMM yyyy', { locale: ptBR })}`;
    if (calSubView === 'list') return 'Todos os agendamentos';
    return format(currentDate, 'MMMM yyyy', { locale: ptBR });
  })();

  // ── Summary counts ─────────────────────────────────────────────────────

  const summaryCounts = useMemo(() => {
    const byStatus: Partial<Record<ContentStatus, number>> = {};
    filtered.forEach((c) => { byStatus[c.status] = (byStatus[c.status] ?? 0) + 1; });
    return {
      total:       filtered.length,
      scheduled:   scheduled.length,
      unscheduled: unscheduled.length,
      byStatus,
    };
  }, [filtered, scheduled, unscheduled]);

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <AppLayout>
      <div className="space-y-0 animate-fade-in">

        {/* ═══════════════ UNIFIED TOOLBAR ═══════════════ */}
        <div
          className="rounded-xl mb-5 overflow-hidden"
          style={{ background: SURFACE, border: `1px solid ${BORDER}` }}
        >
          {/* Row 1: Title + View perspective switcher */}
          <div
            className="flex items-center justify-between px-5 py-3"
            style={{ borderBottom: `1px solid ${BORDER}` }}
          >
            <div className="flex items-center gap-3 min-w-0">
              <h1 className="font-display text-lg font-bold text-foreground tracking-tight shrink-0">
                Planejamento
              </h1>
              {/* Summary pills */}
              <div className="hidden sm:flex items-center gap-1.5">
                <span
                  className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                  style={{ background: 'hsl(240 11% 13%)', color: 'hsl(240 5% 65%)' }}
                >
                  {summaryCounts.total} conteúdo{summaryCounts.total !== 1 ? 's' : ''}
                </span>
                {summaryCounts.unscheduled > 0 && (
                  <span
                    className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: 'hsl(38 90% 50% / 0.12)', color: 'hsl(38 90% 50%)' }}
                  >
                    {summaryCounts.unscheduled} sem data
                  </span>
                )}
              </div>
            </div>

            {/* View perspective switcher — always visible, always same position */}
            <div
              className="flex items-center rounded-lg p-0.5 gap-px shrink-0"
              style={{ background: 'hsl(240 15% 5%)', border: `1px solid ${BORDER}` }}
            >
              {([
                { id: 'calendar', icon: CalendarIcon, label: 'Calendário' },
                { id: 'kanban',   icon: KanbanSquare, label: 'Kanban'     },
                { id: 'gantt',    icon: GanttChart,   label: 'Gantt'      },
              ] as const).map(({ id, icon: Icon, label }) => (
                <button
                  key={id}
                  onClick={() => setTopView(id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all"
                  style={{
                    background: topView === id ? 'hsl(258 82% 64%)' : 'transparent',
                    color:      topView === id ? '#fff' : 'hsl(240 5% 52%)',
                  }}
                  title={label}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Row 2: Shared filters + contextual controls + navigation */}
          <div className="flex items-center justify-between gap-3 px-4 py-2.5 flex-wrap">
            {/* Left: Navigation */}
            <div className="flex items-center gap-2">
              {showNav ? (
                <>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={prev}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <button
                    onClick={today}
                    className="text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded-md transition-colors"
                    style={{ color: 'hsl(258 82% 64%)' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'hsl(258 82% 64% / 0.1)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                  >
                    Hoje
                  </button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={next}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </>
              ) : null}
              <span className="font-display font-semibold text-sm text-foreground/60 capitalize select-none">
                {dateLabel}
              </span>
            </div>

            {/* Right: Shared filters + context controls */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Shared filters — always visible regardless of view */}
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-8 w-[130px] text-xs border-0 bg-transparent hover:bg-white/5"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  {Object.entries(STATUS_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={platformFilter} onValueChange={setPlatformFilter}>
                <SelectTrigger className="h-8 w-[110px] text-xs border-0 bg-transparent hover:bg-white/5"><SelectValue placeholder="Plataforma" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {Object.entries(PLATFORM_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Divider */}
              <div className="h-5 w-px mx-0.5" style={{ background: BORDER }} />

              {/* Calendar sub-view */}
              {topView === 'calendar' && (
                <div
                  className="flex items-center rounded-md p-0.5 gap-px"
                  style={{ background: 'hsl(240 15% 5%)' }}
                >
                  {([
                    { id: 'month', icon: LayoutGrid, label: 'Mês'    },
                    { id: 'week',  icon: CalendarIcon, label: 'Semana' },
                    { id: 'list',  icon: List,        label: 'Lista'  },
                  ] as const).map(({ id, icon: Icon, label }) => (
                    <button
                      key={id}
                      onClick={() => setCalSubView(id)}
                      className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-all"
                      style={{
                        background: calSubView === id ? 'hsl(240 15% 13%)' : 'transparent',
                        color:      calSubView === id ? 'hsl(240 5% 90%)'  : 'hsl(240 5% 45%)',
                      }}
                    >
                      <Icon className="h-3 w-3" />
                      <span className="hidden md:inline">{label}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Gantt sub-controls */}
              {topView === 'gantt' && (
                <>
                  <Select value={ganttScale} onValueChange={(v) => setGanttScale(v as GanttScale)}>
                    <SelectTrigger className="h-8 w-[100px] text-xs border-0 bg-transparent hover:bg-white/5"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dia">Escala: Dia</SelectItem>
                      <SelectItem value="semana">Escala: Semana</SelectItem>
                      <SelectItem value="mes">Escala: Mês</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={ganttGroup} onValueChange={(v) => setGanttGroup(v as GanttGroup)}>
                    <SelectTrigger className="h-8 w-[140px] text-xs border-0 bg-transparent hover:bg-white/5"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem agrupamento</SelectItem>
                      <SelectItem value="platform">Por plataforma</SelectItem>
                      <SelectItem value="status">Por status</SelectItem>
                      <SelectItem value="responsavel">Por responsável</SelectItem>
                    </SelectContent>
                  </Select>
                </>
              )}

              {/* Active filter indicator */}
              {(statusFilter !== 'all' || platformFilter !== 'all') && (
                <button
                  onClick={() => { setStatusFilter('all'); setPlatformFilter('all'); }}
                  className="text-[10px] font-semibold px-2 py-1 rounded-md transition-colors"
                  style={{ color: 'hsl(0 70% 55%)', background: 'hsl(0 70% 55% / 0.1)' }}
                >
                  Limpar filtros
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Unscheduled alert — visible in all views except list & kanban (kanban shows all statuses, list shows only scheduled) */}
        {!isLoading && topView !== 'kanban' && !(topView === 'calendar' && calSubView === 'list') && unscheduled.length > 0 && (
          <div
            className="flex items-start gap-3 p-4 rounded-xl mb-4"
            style={{ background: 'hsl(38 90% 50% / 0.08)', border: '1px solid hsl(38 90% 50% / 0.25)' }}
          >
            <AlertCircle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium">
                {unscheduled.length} conteúdo{unscheduled.length > 1 ? 's' : ''} sem agendamento
              </p>
              <div className="flex flex-wrap gap-1 mt-1.5">
                {unscheduled.slice(0, 5).map((c) => (
                  <Badge
                    key={c.id}
                    variant="outline"
                    className="text-[10px] cursor-pointer"
                    onClick={() => navigate(`/contents/${c.id}`)}
                  >
                    {c.title}
                  </Badge>
                ))}
                {unscheduled.length > 5 && (
                  <Badge variant="outline" className="text-[10px]">+{unscheduled.length - 5}</Badge>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════ CALENDAR ═══════════════════════════════════ */}
        {!isLoading && topView === 'calendar' && (
          <>
            {/* Month */}
            {calSubView === 'month' && (
              <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${BORDER}`, background: SURFACE }}>
                <div className="grid grid-cols-7" style={{ borderBottom: `1px solid ${BORDER}` }}>
                  {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((d) => (
                    <div key={d} className="p-2 text-center text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                      {d}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7">
                  {calDays.map((day, i) => {
                    const dayContents = getContentsForDay(day);
                    const inMonth = isSameMonth(day, currentDate);
                    const todayDay = isToday(day);
                    return (
                      <div
                        key={i}
                        className="min-h-[110px] p-1.5"
                        style={{
                          borderBottom: `1px solid ${BORDER_INNER}`,
                          borderRight:  `1px solid ${BORDER_INNER}`,
                          background:   todayDay ? 'hsl(258 82% 64% / 0.07)' : !inMonth ? 'hsl(240 15% 4%)' : undefined,
                        }}
                      >
                        <div
                          className="text-xs font-medium mb-1"
                          style={{
                            color: todayDay ? 'hsl(258 82% 72%)' : !inMonth ? 'hsl(240 5% 28%)' : 'hsl(240 5% 52%)',
                            fontWeight: todayDay ? 700 : undefined,
                          }}
                        >
                          {format(day, 'd')}
                        </div>
                        <div className="space-y-1">
                          {dayContents.slice(0, 3).map((c) => (
                            <CalCard key={c.id} content={c} onClick={(id) => navigate(`/contents/${id}`)} />
                          ))}
                          {dayContents.length > 3 && (
                            <div className="text-[10px] text-muted-foreground text-center">
                              +{dayContents.length - 3}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Week */}
            {calSubView === 'week' && (
              <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${BORDER}`, background: SURFACE }}>
                <div className="grid grid-cols-7">
                  {weekDays.map((day, i) => {
                    const dayContents = getContentsForDay(day);
                    const todayDay = isToday(day);
                    return (
                      <div key={i} style={{ borderRight: i < 6 ? `1px solid ${BORDER_INNER}` : undefined, background: todayDay ? 'hsl(258 82% 64% / 0.06)' : undefined }}>
                        <div className="p-3 text-center" style={{ borderBottom: `1px solid ${BORDER}` }}>
                          <div className="text-[10px] uppercase tracking-wide" style={{ color: todayDay ? 'hsl(258 82% 72%)' : 'hsl(240 5% 42%)' }}>
                            {format(day, 'EEE', { locale: ptBR })}
                          </div>
                          <div className="text-lg font-display font-semibold" style={{ color: todayDay ? 'hsl(258 82% 72%)' : 'hsl(240 5% 85%)' }}>
                            {format(day, 'd')}
                          </div>
                        </div>
                        <div className="p-2 space-y-1.5 min-h-[300px]">
                          {dayContents.length === 0
                            ? <p className="text-[10px] text-muted-foreground/30 text-center mt-8">—</p>
                            : dayContents.map((c) => (
                                <CalCard key={c.id} content={c} onClick={(id) => navigate(`/contents/${id}`)} />
                              ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* List */}
            {calSubView === 'list' && (
              <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${BORDER}`, background: SURFACE }}>
                {scheduled.length === 0 ? (
                  <div className="text-center py-12 text-sm text-muted-foreground">
                    Nenhum conteúdo agendado ainda.
                  </div>
                ) : (
                  <div>
                    {scheduled.map((c) => (
                      <div
                        key={c.id}
                        className="flex items-center justify-between px-5 py-3.5 cursor-pointer transition-colors"
                        style={{ borderBottom: `1px solid ${BORDER_INNER}` }}
                        onClick={() => navigate(`/contents/${c.id}`)}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.025)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                      >
                        <div className="flex items-center gap-5">
                          <div className="text-center min-w-[44px]">
                            <div className="font-display font-bold text-xl text-foreground/90">
                              {format(parseISO(c.scheduled_datetime!), 'dd')}
                            </div>
                            <div className="text-[10px] text-muted-foreground uppercase">
                              {format(parseISO(c.scheduled_datetime!), 'MMM', { locale: ptBR })}
                            </div>
                          </div>
                          <div>
                            <div className="font-medium text-sm text-foreground/90">{c.title}</div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {PLATFORM_LABELS[c.platform]} · {FORMAT_LABELS[c.format as keyof typeof FORMAT_LABELS]}
                              {c.scheduled_time && ` · ${c.scheduled_time.slice(0, 5)}`}
                            </div>
                          </div>
                        </div>
                        <ContentStatusBadge status={c.status} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* ═════════════════════════════════════ KANBAN ═══════════════════════════════════ */}
        {!isLoading && topView === 'kanban' && (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div className="flex gap-3 overflow-x-auto pb-4" style={{ minHeight: '60vh' }}>
              {KANBAN_STATUS_ORDER.map((status) => (
                <KanbanColumn
                  key={status}
                  status={status}
                  cards={filtered.filter((c) => c.status === status)}
                  updatingId={updatingId}
                  onCardClick={(id) => navigate(`/contents/${id}`)}
                />
              ))}
            </div>

            <DragOverlay dropAnimation={{ duration: 150, easing: 'ease' }}>
              {activeContent && <KanbanOverlayCard content={activeContent} />}
            </DragOverlay>
          </DndContext>
        )}

        {/* ══════════════════════════════════════ GANTT ════════════════════════════════════ */}
        {!isLoading && topView === 'gantt' && (
          <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${BORDER}`, background: SURFACE }}>
            <div className="overflow-x-auto">
              <div style={{ minWidth: 220 + ganttDayList.length * pxPerDay }}>

                {/* Header: day columns */}
                <div
                  className="flex items-end sticky top-0 z-10"
                  style={{ background: 'hsl(240 15% 5%)', borderBottom: `1px solid ${BORDER}` }}
                >
                  <div
                    className="shrink-0 px-3 py-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
                    style={{ width: 220, borderRight: `1px solid ${BORDER}` }}
                  >
                    Conteúdo
                  </div>
                  {ganttDayList.map((day) => {
                    const todayDay = isToday(day);
                    const isMonthStart = day.getDate() === 1;
                    const isWeekStart  = day.getDay() === 0;
                    const showLabel = ganttScale === 'dia'
                      || (ganttScale === 'semana' && (isWeekStart || isMonthStart))
                      || (ganttScale === 'mes' && isMonthStart);
                    return (
                      <div
                        key={day.toISOString()}
                        className="shrink-0 text-center pb-1.5 pt-2"
                        style={{
                          width: pxPerDay,
                          borderRight: `1px solid ${isMonthStart && ganttScale !== 'dia' ? BORDER : BORDER_INNER}`,
                          background: todayDay ? 'hsl(258 82% 64% / 0.14)' : undefined,
                        }}
                      >
                        {isMonthStart && ganttScale !== 'dia' && (
                          <div
                            className="text-[8px] font-bold uppercase"
                            style={{ color: 'hsl(258 82% 72%)' }}
                          >
                            {format(day, 'MMM', { locale: ptBR })}
                          </div>
                        )}
                        {showLabel && (
                          <div
                            className="text-[9px] font-semibold"
                            style={{ color: todayDay ? 'hsl(258 82% 72%)' : 'hsl(240 5% 42%)' }}
                          >
                            {format(day, 'd')}
                          </div>
                        )}
                        {ganttScale === 'dia' && (
                          <div
                            className="text-[8px] uppercase"
                            style={{ color: todayDay ? 'hsl(258 82% 72%)' : 'hsl(240 5% 30%)' }}
                          >
                            {format(day, 'EEE', { locale: ptBR }).slice(0, 3)}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Today vertical line (sticky) */}
                <div className="relative">
                  {/* Rows */}
                  {ganttRows.map((group, gi) => (
                    <div key={gi}>
                      {group.label && (
                        <div
                          className="flex items-center px-3 py-1.5"
                          style={{
                            background: 'hsl(240 15% 5%)',
                            borderBottom: `1px solid ${BORDER}`,
                            borderTop: gi > 0 ? `1px solid ${BORDER}` : undefined,
                          }}
                        >
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                            {group.label}
                          </span>
                          <span className="ml-2 text-[10px] text-muted-foreground/50">{group.items.length}</span>
                        </div>
                      )}

                      {group.items.length === 0 ? (
                        <div className="flex items-center px-3" style={{ height: 40, borderBottom: `1px solid ${BORDER_INNER}` }}>
                          <div style={{ width: 220, borderRight: `1px solid ${BORDER}`, height: '100%' }} />
                          <span className="text-xs text-muted-foreground/30 px-4">Nenhum conteúdo</span>
                        </div>
                      ) : (
                        group.items.map((c) => (
                          <GanttRow
                            key={c.id}
                            content={c}
                            ganttStart={ganttStart}
                            pxPerDay={pxPerDay}
                            totalDays={ganttDays}
                            onClick={(id) => navigate(`/contents/${id}`)}
                          />
                        ))
                      )}
                    </div>
                  ))}

                  {/* Today column overlay */}
                  {(() => {
                    const todayOffset = differenceInCalendarDays(startOfDay(new Date()), ganttStart);
                    if (todayOffset < 0 || todayOffset >= ganttDays) return null;
                    return (
                      <div
                        className="absolute top-0 bottom-0 pointer-events-none"
                        style={{
                          left:     220 + todayOffset * pxPerDay + pxPerDay / 2,
                          width:    1,
                          background: 'hsl(258 82% 64%)',
                          opacity:  0.35,
                        }}
                      />
                    );
                  })()}
                </div>

                {/* Unscheduled footer */}
                {unscheduled.length > 0 && (
                  <div style={{ borderTop: `1px solid hsl(38 90% 50% / 0.25)` }}>
                    <div
                      className="flex items-center px-3 py-1.5"
                      style={{ background: 'hsl(38 90% 50% / 0.07)', borderBottom: `1px solid ${BORDER_INNER}` }}
                    >
                      <AlertCircle className="h-3 w-3 text-warning mr-1.5" />
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-warning">
                        Sem data agendada ({unscheduled.length})
                      </span>
                    </div>
                    {unscheduled.map((c) => (
                      <div
                        key={c.id}
                        className="flex items-center cursor-pointer transition-colors"
                        style={{ height: 40, borderBottom: `1px solid ${BORDER_INNER}` }}
                        onClick={() => navigate(`/contents/${c.id}`)}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.025)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                      >
                        <div
                          className="shrink-0 flex items-center gap-2 px-3 overflow-hidden"
                          style={{ width: 220, borderRight: `1px solid ${BORDER}`, height: '100%' }}
                        >
                          <span className="h-1.5 w-1.5 rounded-full shrink-0 bg-warning/50" />
                          <span className="text-xs text-foreground/50 truncate">{c.title}</span>
                        </div>
                        <span className="text-[10px] text-warning/50 italic px-4">— sem data —</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
