import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BookOpen, ImageIcon, Brain, Lightbulb, ArrowRight } from 'lucide-react';

export default function IntelligenceDashboardPage() {
  const { data: stats = { editorial: 0, references: 0, analyzed: 0, playbooks: 0 } } = useQuery({
    queryKey: ['intelligence', 'stats'],
    queryFn: async () => {
      const [editRes, refRes, analyzedRes, pbRes] = await Promise.all([
        supabase.from('editorial_guidelines').select('id', { count: 'exact', head: true }),
        supabase.from('references').select('id', { count: 'exact', head: true }),
        supabase.from('references').select('id', { count: 'exact', head: true }).eq('analysis_status', 'analisado'),
        supabase.from('playbooks').select('id', { count: 'exact', head: true }),
      ]);
      return {
        editorial: editRes.count || 0,
        references: refRes.count || 0,
        analyzed: analyzedRes.count || 0,
        playbooks: pbRes.count || 0,
      };
    },
  });

  const sections = [
    {
      title: 'Linha Editorial',
      description: 'Regras estratégicas de comunicação da marca Inner AI',
      icon: BookOpen,
      stat: stats.editorial > 0 ? 'Configurada' : 'Pendente',
      statColor: stats.editorial > 0 ? 'text-success' : 'text-warning',
      statDot: stats.editorial > 0 ? 'bg-success' : 'bg-warning',
      path: '/intelligence/editorial',
      action: stats.editorial > 0 ? 'Editar' : 'Configurar',
      featured: false,
    },
    {
      title: 'Referências',
      description: 'Biblioteca de posts, campanhas e peças criativas para análise',
      icon: ImageIcon,
      stat: `${stats.references} referências`,
      statColor: 'text-info',
      statDot: 'bg-info',
      path: '/intelligence/references',
      action: 'Explorar',
      featured: false,
    },
    {
      title: 'Análise com IA',
      description: 'Engenharia reversa completa de referências criativas via visão multimodal',
      icon: Brain,
      stat: `${stats.analyzed} analisadas`,
      statColor: 'text-accent',
      statDot: 'bg-accent',
      path: '/intelligence/ai-analysis',
      action: 'Analisar',
      featured: true,
    },
    {
      title: 'Playbooks',
      description: 'Frameworks, aprendizados e padrões validados pelo time',
      icon: Lightbulb,
      stat: `${stats.playbooks} playbooks`,
      statColor: 'text-foreground/60',
      statDot: 'bg-foreground/40',
      path: '/intelligence/playbooks',
      action: 'Acessar',
      featured: false,
    },
  ];

  return (
    <AppLayout>
      <div className="space-y-8 animate-fade-in">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span
              className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] px-2.5 py-1 rounded-full"
              style={{ background: 'hsl(258 82% 64% / 0.12)', color: 'hsl(258 82% 72%)' }}
            >
              <Brain className="h-3 w-3" /> Central de Inteligência
            </span>
          </div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-foreground mt-3">
            Inteligência Criativa
          </h1>
          <p className="text-muted-foreground mt-1.5 max-w-xl">
            Repertório estratégico, direcionamento de marca e análise de mercado com IA.
          </p>
        </div>

        {/* Section cards */}
        <div className="grid gap-4 md:grid-cols-2">
          {sections.map((s) => (
            <Link key={s.title} to={s.path} className="group block">
              <div
                className={`relative rounded-xl p-6 transition-all duration-200 hover:-translate-y-0.5 ${
                  s.featured
                    ? 'border border-accent/20 hover:border-accent/40'
                    : 'border border-border/80 hover:border-border bg-card'
                }`}
                style={s.featured ? {
                  background: 'linear-gradient(135deg, hsl(var(--card)) 0%, hsl(258 30% 9%) 100%)',
                } : undefined}
              >
                {s.featured && (
                  <div
                    className="absolute inset-0 rounded-xl pointer-events-none"
                    style={{
                      background: 'radial-gradient(ellipse 80% 60% at 100% 0%, hsl(258 82% 64% / 0.08) 0%, transparent 60%)',
                    }}
                  />
                )}

                <div className="relative flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    {/* Icon */}
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg mt-0.5 ${s.featured ? '' : 'bg-muted'}`}
                      style={s.featured ? {
                        background: 'hsl(258 82% 64% / 0.15)',
                      } : undefined}
                    >
                      <s.icon
                        className="h-5 w-5"
                        style={{ color: s.featured ? 'hsl(258 82% 72%)' : 'hsl(240 5% 70%)' }}
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-display font-semibold text-foreground">{s.title}</h3>
                        {s.featured && (
                          <Badge
                            className="text-[9px] px-1.5 py-0 font-bold uppercase tracking-wide"
                            style={{ background: 'hsl(258 82% 64% / 0.2)', color: 'hsl(258 82% 72%)', border: 'none' }}
                          >
                            IA
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">{s.description}</p>
                    </div>
                  </div>

                  <ArrowRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors shrink-0 mt-0.5" />
                </div>

                <div className="relative mt-5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`h-1.5 w-1.5 rounded-full ${s.statDot}`} />
                    <span className={`text-xs font-medium ${s.statColor}`}>{s.stat}</span>
                  </div>
                  <span className="text-xs text-muted-foreground/60 group-hover:text-muted-foreground transition-colors font-medium">
                    {s.action} →
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
