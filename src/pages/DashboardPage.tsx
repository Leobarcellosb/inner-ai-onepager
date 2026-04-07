import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useContents } from '@/hooks/useContents';
import { AppLayout } from '@/components/AppLayout';
import { BrainAlerts } from '@/components/BrainAlerts';
import { ContentStatusBadge } from '@/components/StatusBadge';
import { Badge } from '@/components/ui/badge';
import {
  FileText,
  Eye,
  Clock,
  PenTool,
  CheckCircle,
  Activity,
  CalendarDays,
  AlertCircle,
} from 'lucide-react';
import { format, parseISO, isThisWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PLATFORM_LABELS } from '@/types';
import type { Content } from '@/types';

export default function DashboardPage() {
  const navigate = useNavigate();

  const { data: allContents = [] } = useContents();

  // Single query for brief counts
  const { data: briefStats } = useQuery({
    queryKey: ['briefs', 'dashboard'],
    queryFn: async () => {
      const { data } = await supabase.from('briefs').select('status');
      return { emAndamento: data?.filter((b) => b.status === 'em_andamento').length ?? 0 };
    },
  });

  // Derive everything from the single query
  const stats = useMemo(() => ({
    total: allContents.length,
    emRevisao: allContents.filter((c) => c.status === 'copy_review' || c.status === 'final_review').length,
    aguardandoDesign: allContents.filter((c) => c.status === 'design_queue' || c.status === 'designing').length,
    briefsEmAndamento: briefStats?.emAndamento ?? 0,
    prontos: allContents.filter((c) => c.status === 'approved').length,
  }), [allContents, briefStats]);

  const recentContents = useMemo(
    () => [...allContents].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 5),
    [allContents],
  );

  const now = new Date().toISOString();
  const upcomingPosts = useMemo(
    () => allContents.filter((c) => c.scheduled_datetime && c.scheduled_datetime >= now).slice(0, 5),
    [allContents, now],
  );
  const unscheduledPosts = useMemo(
    () => allContents.filter((c) => !c.scheduled_datetime && c.status !== 'published'),
    [allContents],
  );
  const thisWeekPosts = useMemo(
    () => allContents.filter((c) => c.scheduled_datetime && isThisWeek(parseISO(c.scheduled_datetime), { locale: ptBR })),
    [allContents],
  );

  const widgets = [
    { title: 'Conteúdos', value: stats.total, icon: FileText, accent: 'hsl(var(--muted-foreground))', dim: 'hsl(var(--muted))' },
    { title: 'Em Revisão', value: stats.emRevisao, icon: Eye, accent: 'hsl(38 90% 50%)', dim: 'hsl(38 90% 50% / 0.1)' },
    { title: 'Aguard. Design', value: stats.aguardandoDesign, icon: Clock, accent: 'hsl(258 82% 64%)', dim: 'hsl(258 82% 64% / 0.1)' },
    { title: 'Briefs Ativos', value: stats.briefsEmAndamento, icon: PenTool, accent: 'hsl(217 88% 58%)', dim: 'hsl(217 88% 58% / 0.1)' },
    { title: 'Prontos', value: stats.prontos, icon: CheckCircle, accent: 'hsl(142 60% 42%)', dim: 'hsl(142 60% 42% / 0.1)' },
  ];

  return (
    <AppLayout>
      <div className="space-y-8 animate-fade-in">
        {/* Header */}
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Visão operacional dos conteúdos e publicações</p>
        </div>

        {/* Brain alerts */}
        <BrainAlerts />

        {/* Stat widgets */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {widgets.map((w) => (
            <div
              key={w.title}
              className="rounded-xl p-5 border border-border/80 bg-card"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground mb-2">
                    {w.title}
                  </p>
                  <p className="font-display text-3xl font-bold" style={{ color: w.accent }}>
                    {w.value}
                  </p>
                </div>
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-lg shrink-0"
                  style={{ background: w.dim }}
                >
                  <w.icon className="h-4 w-4" style={{ color: w.accent }} />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Scheduling row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Upcoming posts */}
          <div className="rounded-xl border border-border/80 overflow-hidden bg-card">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-border/60">
              <CalendarDays className="h-4 w-4 text-accent" />
              <span className="font-display font-semibold text-sm">Próximos Posts</span>
            </div>
            <div className="p-4">
              {upcomingPosts.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">Nenhum post agendado.</p>
              ) : (
                <div className="space-y-1">
                  {upcomingPosts.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between py-2 px-2 -mx-2 rounded-lg cursor-pointer hover:bg-white/5 transition-colors"
                      onClick={() => navigate(`/contents/${c.id}`)}
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate text-foreground/90">{c.title}</div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          {c.scheduled_datetime && format(parseISO(c.scheduled_datetime), "dd/MM · HH:mm")}
                          {' · '}{PLATFORM_LABELS[c.platform]}
                        </div>
                      </div>
                      <ContentStatusBadge status={c.status} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Unscheduled */}
          <div
            className="rounded-xl border overflow-hidden bg-card"
            style={{
              borderColor: unscheduledPosts.length > 0 ? 'hsl(38 90% 50% / 0.3)' : undefined,
            }}
          >
            <div className="flex items-center gap-2 px-5 py-4 border-b border-border/60">
              <AlertCircle
                className="h-4 w-4"
                style={{ color: unscheduledPosts.length > 0 ? 'hsl(38 90% 50%)' : 'hsl(240 5% 50%)' }}
              />
              <span className="font-display font-semibold text-sm">Sem Agendamento</span>
              {unscheduledPosts.length > 0 && (
                <Badge
                  className="ml-auto text-[10px] font-bold"
                  style={{ background: 'hsl(38 90% 50% / 0.15)', color: 'hsl(38 90% 50%)', border: 'none' }}
                >
                  {unscheduledPosts.length}
                </Badge>
              )}
            </div>
            <div className="p-4">
              {unscheduledPosts.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">Tudo agendado.</p>
              ) : (
                <div className="space-y-1">
                  {unscheduledPosts.slice(0, 5).map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between py-2 px-2 -mx-2 rounded-lg cursor-pointer hover:bg-white/5 transition-colors"
                      onClick={() => navigate(`/contents/${c.id}`)}
                    >
                      <span className="text-sm font-medium truncate text-foreground/90">{c.title}</span>
                      <ContentStatusBadge status={c.status} />
                    </div>
                  ))}
                  {unscheduledPosts.length > 5 && (
                    <p className="text-[10px] text-muted-foreground mt-2">+{unscheduledPosts.length - 5} mais</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* This week */}
          <div className="rounded-xl border border-border/80 overflow-hidden bg-card">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-border/60">
              <CalendarDays className="h-4 w-4 text-info" />
              <span className="font-display font-semibold text-sm">Esta Semana</span>
              <Badge
                className="ml-auto text-[10px]"
                style={{ background: 'hsl(217 88% 58% / 0.15)', color: 'hsl(217 88% 58%)', border: 'none' }}
              >
                {thisWeekPosts.length}
              </Badge>
            </div>
            <div className="p-4">
              {thisWeekPosts.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">Nenhum post esta semana.</p>
              ) : (
                <div className="space-y-1">
                  {thisWeekPosts.slice(0, 5).map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between py-2 px-2 -mx-2 rounded-lg cursor-pointer transition-colors"
                      onClick={() => navigate(`/contents/${c.id}`)}
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate text-foreground/90">{c.title}</div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          {c.scheduled_datetime && format(parseISO(c.scheduled_datetime), "EEE dd · HH:mm", { locale: ptBR })}
                        </div>
                      </div>
                      <ContentStatusBadge status={c.status} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Recent activity */}
        <div className="rounded-xl border border-border/80 overflow-hidden bg-card">
          <div className="flex items-center gap-2 px-6 py-4 border-b border-border/60">
            <Activity className="h-4 w-4 text-accent" />
            <span className="font-display font-semibold text-sm">Atividade Recente</span>
          </div>
          <div className="divide-y divide-border/50">
            {recentContents.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Nenhum conteúdo criado ainda.</p>
            ) : (
              recentContents.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between px-6 py-3 cursor-pointer hover:bg-white/[0.02] transition-colors"
                  onClick={() => navigate(`/contents/${c.id}`)}
                >
                  <span className="text-sm text-foreground/90 font-medium">{c.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(c.created_at).toLocaleDateString('pt-BR')}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
