import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AppLayout } from '@/components/AppLayout';
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

interface DashboardStats {
  total: number;
  emRevisao: number;
  aguardandoDesign: number;
  briefsEmAndamento: number;
  prontos: number;
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats>({
    total: 0,
    emRevisao: 0,
    aguardandoDesign: 0,
    briefsEmAndamento: 0,
    prontos: 0,
  });
  const [recentContents, setRecentContents] = useState<any[]>([]);
  const [upcomingPosts, setUpcomingPosts] = useState<Content[]>([]);
  const [unscheduledPosts, setUnscheduledPosts] = useState<Content[]>([]);
  const [thisWeekPosts, setThisWeekPosts] = useState<Content[]>([]);

  useEffect(() => {
    fetchStats();
    fetchRecent();
    fetchScheduling();
  }, []);

  const fetchStats = async () => {
    const { data: contents } = await supabase.from('contents').select('status');
    const { data: briefs } = await supabase.from('briefs').select('status');

    if (contents) {
      setStats({
        total: contents.length,
        emRevisao: contents.filter((c) => c.status === 'em_revisao').length,
        aguardandoDesign: contents.filter((c) => c.status === 'aguardando_design').length,
        briefsEmAndamento: briefs?.filter((b) => b.status === 'em_andamento').length || 0,
        prontos: contents.filter((c) => c.status === 'pronto').length,
      });
    }
  };

  const fetchRecent = async () => {
    const { data } = await supabase
      .from('contents')
      .select('id, title, status, created_at')
      .order('created_at', { ascending: false })
      .limit(5);
    if (data) setRecentContents(data);
  };

  const fetchScheduling = async () => {
    const { data: all } = await supabase
      .from('contents')
      .select('*')
      .order('scheduled_datetime', { ascending: true });

    if (!all) return;
    const contents = all as Content[];

    const now = new Date().toISOString();
    setUpcomingPosts(
      contents
        .filter((c) => c.scheduled_datetime && c.scheduled_datetime >= now)
        .slice(0, 5)
    );
    setUnscheduledPosts(
      contents.filter((c) => !c.scheduled_datetime && c.status !== 'publicado')
    );
    setThisWeekPosts(
      contents.filter((c) => c.scheduled_datetime && isThisWeek(parseISO(c.scheduled_datetime), { locale: ptBR }))
    );
  };

  const widgets = [
    { title: 'Total de Conteúdos', value: stats.total, icon: FileText, color: 'text-foreground' },
    { title: 'Em Revisão', value: stats.emRevisao, icon: Eye, color: 'text-warning' },
    { title: 'Aguardando Design', value: stats.aguardandoDesign, icon: Clock, color: 'text-accent' },
    { title: 'Briefs em Andamento', value: stats.briefsEmAndamento, icon: PenTool, color: 'text-info' },
    { title: 'Prontos', value: stats.prontos, icon: CheckCircle, color: 'text-success' },
  ];

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Visão geral dos seus conteúdos e briefs</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {widgets.map((w) => (
            <Card key={w.title} className="glass-card">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{w.title}</p>
                    <p className={`text-3xl font-display font-bold mt-1 ${w.color}`}>{w.value}</p>
                  </div>
                  <w.icon className={`h-8 w-8 ${w.color} opacity-30`} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Scheduling widgets row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Upcoming posts */}
          <Card className="glass-card">
            <CardHeader className="pb-2">
              <CardTitle className="font-display text-sm flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-accent" />
                Próximos Posts
              </CardTitle>
            </CardHeader>
            <CardContent>
              {upcomingPosts.length === 0 ? (
                <p className="text-xs text-muted-foreground py-3">Nenhum post agendado.</p>
              ) : (
                <div className="space-y-2">
                  {upcomingPosts.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between py-1.5 cursor-pointer hover:bg-muted/50 rounded px-1 -mx-1 transition-colors"
                      onClick={() => navigate(`/contents/${c.id}`)}
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{c.title}</div>
                        <div className="text-[10px] text-muted-foreground">
                          {c.scheduled_datetime && format(parseISO(c.scheduled_datetime), "dd/MM · HH:mm")}
                          {' · '}{PLATFORM_LABELS[c.platform]}
                        </div>
                      </div>
                      <ContentStatusBadge status={c.status} />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Unscheduled */}
          <Card className={`glass-card ${unscheduledPosts.length > 0 ? 'border-warning/30' : ''}`}>
            <CardHeader className="pb-2">
              <CardTitle className="font-display text-sm flex items-center gap-2">
                <AlertCircle className={`h-4 w-4 ${unscheduledPosts.length > 0 ? 'text-warning' : 'text-muted-foreground'}`} />
                Sem Agendamento
                {unscheduledPosts.length > 0 && (
                  <Badge variant="outline" className="text-[10px] bg-warning/10 text-warning border-warning/30">
                    {unscheduledPosts.length}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {unscheduledPosts.length === 0 ? (
                <p className="text-xs text-muted-foreground py-3">Todos os conteúdos estão agendados! 🎉</p>
              ) : (
                <div className="space-y-2">
                  {unscheduledPosts.slice(0, 5).map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between py-1.5 cursor-pointer hover:bg-muted/50 rounded px-1 -mx-1 transition-colors"
                      onClick={() => navigate(`/contents/${c.id}`)}
                    >
                      <span className="text-sm font-medium truncate">{c.title}</span>
                      <ContentStatusBadge status={c.status} />
                    </div>
                  ))}
                  {unscheduledPosts.length > 5 && (
                    <p className="text-[10px] text-muted-foreground">+{unscheduledPosts.length - 5} mais</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* This week */}
          <Card className="glass-card">
            <CardHeader className="pb-2">
              <CardTitle className="font-display text-sm flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-info" />
                Esta Semana
                <Badge variant="outline" className="text-[10px]">{thisWeekPosts.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {thisWeekPosts.length === 0 ? (
                <p className="text-xs text-muted-foreground py-3">Nenhum post esta semana.</p>
              ) : (
                <div className="space-y-2">
                  {thisWeekPosts.slice(0, 5).map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between py-1.5 cursor-pointer hover:bg-muted/50 rounded px-1 -mx-1 transition-colors"
                      onClick={() => navigate(`/contents/${c.id}`)}
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{c.title}</div>
                        <div className="text-[10px] text-muted-foreground">
                          {c.scheduled_datetime && format(parseISO(c.scheduled_datetime), "EEE dd · HH:mm", { locale: ptBR })}
                        </div>
                      </div>
                      <ContentStatusBadge status={c.status} />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="font-display text-lg flex items-center gap-2">
              <Activity className="h-5 w-5 text-accent" />
              Atividade Recente
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentContents.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">Nenhum conteúdo criado ainda.</p>
            ) : (
              <div className="space-y-3">
                {recentContents.map((c) => (
                  <div key={c.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                    <span className="text-sm font-medium text-foreground">{c.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(c.created_at).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
