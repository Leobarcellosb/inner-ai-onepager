import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/AppLayout';
import { ContentStatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChevronLeft, ChevronRight, CalendarIcon, List, LayoutGrid, AlertCircle } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, isSameMonth, isSameDay, addMonths, subMonths, addWeeks, subWeeks, isToday, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PLATFORM_LABELS, FORMAT_LABELS, STATUS_LABELS, STATUS_COLORS } from '@/types';
import type { Content, ContentPlatform, ContentStatus } from '@/types';

type CalendarView = 'month' | 'week' | 'list';

export default function CalendarPage() {
  const navigate = useNavigate();
  const [contents, setContents] = useState<Content[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<CalendarView>('month');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [platformFilter, setPlatformFilter] = useState<string>('all');

  useEffect(() => {
    fetchContents();
  }, []);

  const fetchContents = async () => {
    const { data } = await supabase
      .from('contents')
      .select('*')
      .order('scheduled_datetime', { ascending: true });
    if (data) setContents(data as Content[]);
  };

  const filtered = useMemo(() => {
    return contents.filter((c) => {
      if (statusFilter !== 'all' && c.status !== statusFilter) return false;
      if (platformFilter !== 'all' && c.platform !== platformFilter) return false;
      return true;
    });
  }, [contents, statusFilter, platformFilter]);

  const scheduledContents = useMemo(() => filtered.filter((c) => c.scheduled_datetime), [filtered]);
  const unscheduledContents = useMemo(() => filtered.filter((c) => !c.scheduled_datetime), [filtered]);

  // Month view
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, { locale: ptBR });
  const calendarEnd = endOfWeek(monthEnd, { locale: ptBR });
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  // Week view
  const weekStart = startOfWeek(currentDate, { locale: ptBR });
  const weekEnd = endOfWeek(currentDate, { locale: ptBR });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const getContentsForDay = (day: Date) => {
    return scheduledContents.filter((c) => {
      if (!c.scheduled_datetime) return false;
      return isSameDay(parseISO(c.scheduled_datetime), day);
    });
  };

  const navigatePrev = () => {
    if (view === 'month') setCurrentDate(subMonths(currentDate, 1));
    else if (view === 'week') setCurrentDate(subWeeks(currentDate, 1));
  };

  const navigateNext = () => {
    if (view === 'month') setCurrentDate(addMonths(currentDate, 1));
    else if (view === 'week') setCurrentDate(addWeeks(currentDate, 1));
  };

  const navigateToday = () => setCurrentDate(new Date());

  const ContentCard = ({ content }: { content: Content }) => (
    <div
      onClick={() => navigate(`/contents/${content.id}`)}
      className="cursor-pointer rounded-md border border-border/50 bg-card p-2 hover:bg-muted/50 transition-colors text-xs space-y-1"
    >
      <div className="font-medium truncate text-foreground">{content.title}</div>
      <div className="flex items-center gap-1 flex-wrap">
        <Badge variant="outline" className={`text-[10px] px-1 py-0 ${STATUS_COLORS[content.status]}`}>
          {STATUS_LABELS[content.status]}
        </Badge>
        <span className="text-muted-foreground text-[10px]">
          {PLATFORM_LABELS[content.platform]}
        </span>
      </div>
      {content.scheduled_time && (
        <div className="text-muted-foreground text-[10px]">
          🕐 {content.scheduled_time.slice(0, 5)}
        </div>
      )}
    </div>
  );

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="font-display text-2xl font-bold">Calendário Editorial</h1>
          <p className="text-sm text-muted-foreground mt-1">Visualize e gerencie o agendamento dos conteúdos</p>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={navigatePrev}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={navigateToday}>Hoje</Button>
            <Button variant="outline" size="icon" onClick={navigateNext}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <h2 className="font-display font-semibold text-lg ml-2 capitalize">
              {view === 'month'
                ? format(currentDate, 'MMMM yyyy', { locale: ptBR })
                : view === 'week'
                  ? `${format(weekStart, 'dd MMM', { locale: ptBR })} — ${format(weekEnd, 'dd MMM yyyy', { locale: ptBR })}`
                  : 'Todos os agendamentos'
              }
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px] h-9 text-sm"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {Object.entries(STATUS_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={platformFilter} onValueChange={setPlatformFilter}>
              <SelectTrigger className="w-[140px] h-9 text-sm"><SelectValue placeholder="Plataforma" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {Object.entries(PLATFORM_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Tabs value={view} onValueChange={(v) => setView(v as CalendarView)}>
              <TabsList className="h-9">
                <TabsTrigger value="month" className="text-xs px-3"><LayoutGrid className="h-3.5 w-3.5 mr-1" />Mês</TabsTrigger>
                <TabsTrigger value="week" className="text-xs px-3"><CalendarIcon className="h-3.5 w-3.5 mr-1" />Semana</TabsTrigger>
                <TabsTrigger value="list" className="text-xs px-3"><List className="h-3.5 w-3.5 mr-1" />Lista</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        {/* Unscheduled alert */}
        {unscheduledContents.length > 0 && (
          <Card className="border-warning/30 bg-warning/5">
            <CardContent className="p-4 flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-warning shrink-0" />
              <div>
                <p className="text-sm font-medium text-foreground">
                  {unscheduledContents.length} conteúdo{unscheduledContents.length > 1 ? 's' : ''} sem agendamento
                </p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {unscheduledContents.slice(0, 5).map((c) => (
                    <Badge
                      key={c.id}
                      variant="outline"
                      className="text-[10px] cursor-pointer hover:bg-muted"
                      onClick={() => navigate(`/contents/${c.id}`)}
                    >
                      {c.title}
                    </Badge>
                  ))}
                  {unscheduledContents.length > 5 && (
                    <Badge variant="outline" className="text-[10px]">
                      +{unscheduledContents.length - 5} mais
                    </Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Month View */}
        {view === 'month' && (
          <div className="glass-card rounded-lg overflow-hidden">
            <div className="grid grid-cols-7 border-b border-border">
              {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((d) => (
                <div key={d} className="p-2 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {calendarDays.map((day, idx) => {
                const dayContents = getContentsForDay(day);
                const inMonth = isSameMonth(day, currentDate);
                const today = isToday(day);
                return (
                  <div
                    key={idx}
                    className={`min-h-[110px] border-b border-r border-border/50 p-1.5 ${
                      !inMonth ? 'bg-muted/30' : ''
                    } ${today ? 'bg-accent/5' : ''}`}
                  >
                    <div className={`text-xs font-medium mb-1 ${
                      today ? 'text-accent font-bold' : !inMonth ? 'text-muted-foreground/50' : 'text-muted-foreground'
                    }`}>
                      {format(day, 'd')}
                    </div>
                    <div className="space-y-1">
                      {dayContents.slice(0, 3).map((c) => (
                        <ContentCard key={c.id} content={c} />
                      ))}
                      {dayContents.length > 3 && (
                        <div className="text-[10px] text-muted-foreground text-center">
                          +{dayContents.length - 3} mais
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Week View */}
        {view === 'week' && (
          <div className="glass-card rounded-lg overflow-hidden">
            <div className="grid grid-cols-7">
              {weekDays.map((day, idx) => {
                const dayContents = getContentsForDay(day);
                const today = isToday(day);
                return (
                  <div key={idx} className={`border-r border-border/50 last:border-r-0 ${today ? 'bg-accent/5' : ''}`}>
                    <div className={`p-3 border-b border-border text-center ${today ? 'text-accent font-bold' : ''}`}>
                      <div className="text-xs text-muted-foreground uppercase">
                        {format(day, 'EEE', { locale: ptBR })}
                      </div>
                      <div className="text-lg font-display font-semibold">
                        {format(day, 'd')}
                      </div>
                    </div>
                    <div className="p-2 space-y-2 min-h-[300px]">
                      {dayContents.length === 0 ? (
                        <p className="text-[10px] text-muted-foreground text-center mt-4">Nenhum post</p>
                      ) : (
                        dayContents.map((c) => <ContentCard key={c.id} content={c} />)
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* List View */}
        {view === 'list' && (
          <div className="space-y-2">
            {scheduledContents.length === 0 ? (
              <Card className="glass-card">
                <CardContent className="p-8 text-center text-muted-foreground">
                  Nenhum conteúdo agendado ainda.
                </CardContent>
              </Card>
            ) : (
              scheduledContents.map((c) => (
                <Card
                  key={c.id}
                  className="glass-card cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => navigate(`/contents/${c.id}`)}
                >
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="text-center min-w-[60px]">
                        <div className="text-lg font-display font-bold text-foreground">
                          {c.scheduled_datetime ? format(parseISO(c.scheduled_datetime), 'dd') : '—'}
                        </div>
                        <div className="text-xs text-muted-foreground capitalize">
                          {c.scheduled_datetime ? format(parseISO(c.scheduled_datetime), 'MMM', { locale: ptBR }) : ''}
                        </div>
                      </div>
                      <div>
                        <div className="font-medium text-foreground">{c.title}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {PLATFORM_LABELS[c.platform]} · {FORMAT_LABELS[c.format as keyof typeof FORMAT_LABELS]}
                          {c.scheduled_time && ` · ${c.scheduled_time.slice(0, 5)}`}
                        </div>
                      </div>
                    </div>
                    <ContentStatusBadge status={c.status} />
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
