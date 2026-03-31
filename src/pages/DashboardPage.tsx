import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AppLayout } from '@/components/AppLayout';
import {
  FileText,
  Eye,
  Clock,
  PenTool,
  CheckCircle,
  Activity,
} from 'lucide-react';

interface DashboardStats {
  total: number;
  emRevisao: number;
  aguardandoDesign: number;
  briefsEmAndamento: number;
  prontos: number;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    total: 0,
    emRevisao: 0,
    aguardandoDesign: 0,
    briefsEmAndamento: 0,
    prontos: 0,
  });
  const [recentContents, setRecentContents] = useState<any[]>([]);

  useEffect(() => {
    fetchStats();
    fetchRecent();
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
