import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BookOpen, ImageIcon, Brain, Lightbulb, ArrowRight, Sparkles } from 'lucide-react';

export default function IntelligenceDashboardPage() {
  const [stats, setStats] = useState({ editorial: 0, references: 0, analyzed: 0, playbooks: 0 });

  useEffect(() => {
    const fetchStats = async () => {
      const [editRes, refRes, analyzedRes, pbRes] = await Promise.all([
        supabase.from('editorial_guidelines').select('id', { count: 'exact', head: true }),
        supabase.from('references').select('id', { count: 'exact', head: true }),
        supabase.from('references').select('id', { count: 'exact', head: true }).eq('analysis_status', 'analisado'),
        supabase.from('playbooks').select('id', { count: 'exact', head: true }),
      ]);
      setStats({
        editorial: editRes.count || 0,
        references: refRes.count || 0,
        analyzed: analyzedRes.count || 0,
        playbooks: pbRes.count || 0,
      });
    };
    fetchStats();
  }, []);

  const sections = [
    {
      title: 'Linha Editorial',
      description: 'Regras estratégicas de comunicação da marca',
      icon: BookOpen,
      stat: stats.editorial > 0 ? 'Configurada' : 'Pendente',
      statColor: stats.editorial > 0 ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning',
      path: '/intelligence/editorial',
      action: stats.editorial > 0 ? 'Editar' : 'Configurar',
    },
    {
      title: 'Referências',
      description: 'Biblioteca de posts, campanhas e peças criativas',
      icon: ImageIcon,
      stat: `${stats.references} referências`,
      statColor: 'bg-info/10 text-info',
      path: '/intelligence/references',
      action: 'Explorar',
    },
    {
      title: 'Análises com IA',
      description: 'Engenharia reversa estratégica de referências',
      icon: Brain,
      stat: `${stats.analyzed} analisadas`,
      statColor: 'bg-accent/10 text-accent',
      path: '/intelligence/references',
      action: 'Ver análises',
    },
    {
      title: 'Playbooks',
      description: 'Aprendizados, frameworks e padrões do time',
      icon: Lightbulb,
      stat: `${stats.playbooks} playbooks`,
      statColor: 'bg-primary/10 text-primary',
      path: '/intelligence/playbooks',
      action: 'Acessar',
    },
  ];

  return (
    <AppLayout>
      <div className="space-y-8">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
            <Sparkles className="h-5 w-5 text-accent" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight">Central de Inteligência</h1>
            <p className="text-sm text-muted-foreground">Repertório, direcionamento e inteligência aplicada</p>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {sections.map((s) => (
            <Card key={s.title} className="group relative overflow-hidden transition-shadow hover:shadow-md">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                      <s.icon className="h-4 w-4 text-foreground" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{s.title}</CardTitle>
                      <CardDescription className="text-xs">{s.description}</CardDescription>
                    </div>
                  </div>
                  <Badge variant="secondary" className={s.statColor}>{s.stat}</Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <Button asChild variant="outline" size="sm" className="w-full">
                  <Link to={s.path}>
                    {s.action} <ArrowRight className="ml-1 h-3 w-3" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
