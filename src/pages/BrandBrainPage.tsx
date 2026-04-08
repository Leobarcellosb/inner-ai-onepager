import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/AppLayout';
import { Badge } from '@/components/ui/badge';
import {
  Brain,
  ImageIcon,
  Sparkles,
  BookOpen,
  Settings,
  ArrowRight,
  Lightbulb,
  Film,
} from 'lucide-react';

interface BrainCard {
  title: string;
  description: string;
  icon: React.ElementType;
  accent: string;
  url: string;
  statKey?: string;
}

const CARDS: BrainCard[] = [
  {
    title: 'Configuração da Marca',
    description: 'ICP, linha editorial, voz, tom, regras e aprendizados de referências',
    icon: Settings,
    accent: 'hsl(258 82% 64%)',
    url: '/config',
    statKey: 'config',
  },
  {
    title: 'Gerador de Ideias',
    description: 'Gere ideias alinhadas com estratégia, ICP e aprendizados',
    icon: Lightbulb,
    accent: 'hsl(38 90% 50%)',
    url: '/ideas',
  },
  {
    title: 'Stories',
    description: 'Sequências de stories com IA — prontas para design',
    icon: Film,
    accent: 'hsl(200 85% 55%)',
    url: '/stories',
  },
  {
    title: 'Referências',
    description: 'Biblioteca de referências — padrões extraídos alimentam o cérebro',
    icon: ImageIcon,
    accent: 'hsl(217 88% 58%)',
    url: '/intelligence/references',
    statKey: 'references',
  },
  {
    title: 'Análise com IA',
    description: 'Análise multimodal de peças — extrai copy, visual, estrutura e ganchos',
    icon: Sparkles,
    accent: 'hsl(142 60% 42%)',
    url: '/intelligence/ai-analysis',
    statKey: 'analyzed',
  },
  {
    title: 'Base de Conhecimento',
    description: 'Alimente o cérebro com documentos, artigos e insights',
    icon: BookOpen,
    accent: 'hsl(200 85% 55%)',
    url: '/knowledge',
    statKey: 'knowledge',
  },
  {
    title: 'Playbooks',
    description: 'Frameworks criativos e templates reutilizáveis',
    icon: BookOpen,
    accent: 'hsl(0 0% 75%)',
    url: '/intelligence/playbooks',
    statKey: 'playbooks',
  },
];

export default function BrandBrainPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: stats = { config: 0, references: 0, analyzed: 0, playbooks: 0, learnings: 0, knowledge: 0 } } = useQuery({
    queryKey: ['brain', 'stats'],
    queryFn: async () => {
      const [cfgRes, refRes, analyzedRes, pbRes, kbRes] = await Promise.all([
        supabase.from('company_config').select('id', { count: 'exact', head: true }),
        supabase.from('references').select('id', { count: 'exact', head: true }),
        supabase.from('references').select('id', { count: 'exact', head: true }).eq('analysis_status', 'analisado'),
        supabase.from('playbooks').select('id', { count: 'exact', head: true }),
        supabase.from('knowledge_entries').select('id', { count: 'exact', head: true }),
      ]);

      // Count learnings from company_config
      let learnings = 0;
      const { data: cfg } = await supabase.from('company_config').select('learnings_json').limit(1).single();
      if (cfg?.learnings_json) {
        const L = cfg.learnings_json as Record<string, unknown[]>;
        learnings = Object.values(L).reduce((sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0);
      }

      return {
        config: cfgRes.count || 0,
        references: refRes.count || 0,
        analyzed: analyzedRes.count || 0,
        playbooks: pbRes.count || 0,
        knowledge: kbRes.count || 0,
        learnings,
      };
    },
  });

  const statLabels: Record<string, string> = {
    config: stats.config > 0 ? 'Configurado' : 'Não configurado',
    references: `${stats.references} referência${stats.references !== 1 ? 's' : ''}`,
    knowledge: `${stats.knowledge} documento${stats.knowledge !== 1 ? 's' : ''}`,
    analyzed: `${stats.analyzed} analisada${stats.analyzed !== 1 ? 's' : ''}`,
    playbooks: `${stats.playbooks} playbook${stats.playbooks !== 1 ? 's' : ''}`,
  };

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight flex items-center gap-2">
            <Brain className="h-6 w-6 text-accent" />
            Cérebro da Marca
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Central cognitiva — configuração, inteligência criativa e aprendizados
          </p>
        </div>

        {/* Stats bar */}
        <div
          className="flex items-center gap-4 px-5 py-3 rounded-xl overflow-x-auto bg-card border border-border"
        >
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground">Referências:</span>
            <span className="text-xs font-semibold text-foreground/80">{stats.references}</span>
          </div>
          <div className="h-4 w-px bg-border" />
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground">Analisadas:</span>
            <span className="text-xs font-semibold text-accent">{stats.analyzed}</span>
          </div>
          <div className="h-4 w-px bg-border" />
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground">Aprendizados:</span>
            <span className="text-xs font-semibold text-warning">{stats.learnings}</span>
          </div>
          <div className="h-4 w-px bg-border" />
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground">Playbooks:</span>
            <span className="text-xs font-semibold text-foreground/80">{stats.playbooks}</span>
          </div>
          <div className="h-4 w-px bg-border" />
          <Badge
            className="text-[9px] ml-auto"
            style={{
              background: stats.config > 0 ? 'hsl(142 60% 42% / 0.12)' : 'hsl(0 72% 51% / 0.12)',
              color: stats.config > 0 ? 'hsl(142 60% 42%)' : 'hsl(0 72% 51%)',
              border: 'none',
            }}
          >
            {stats.config > 0 ? 'Cérebro ativo' : 'Não configurado'}
          </Badge>
        </div>

        {/* Cards grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {CARDS.map((card) => (
            <div
              key={card.url}
              onClick={() => navigate(card.url)}
              className="rounded-xl p-5 cursor-pointer transition-all hover:brightness-110 group bg-card border border-border"
              style={{
                borderLeft: `3px solid ${card.accent}`,
              }}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <card.icon className="h-5 w-5 shrink-0" style={{ color: card.accent }} />
                  <div>
                    <h3 className="text-sm font-semibold text-foreground/90">{card.title}</h3>
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                      {card.description}
                    </p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-accent transition-colors shrink-0 mt-0.5" />
              </div>
              {card.statKey && (
                <div className="mt-3 text-[10px] text-muted-foreground/60">
                  {statLabels[card.statKey]}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
