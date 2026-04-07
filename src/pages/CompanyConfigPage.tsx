import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Save, Loader2, Brain, Users, MessageSquare, ShieldCheck, Sparkles, X } from 'lucide-react';
import { toast } from 'sonner';
import type { CompanyConfig } from '@/types';

interface ConfigSection {
  key: 'icp_json' | 'editorial_guidelines_json' | 'voice_tone_json' | 'rules_json';
  title: string;
  description: string;
  icon: React.ElementType;
  accent: string;
  fields: { key: string; label: string; placeholder: string }[];
}

const SECTIONS: ConfigSection[] = [
  {
    key: 'icp_json',
    title: 'ICP — Perfil de Cliente Ideal',
    description: 'Quem é o público-alvo da marca. Usado pela IA para adaptar linguagem e abordagem.',
    icon: Users,
    accent: 'hsl(217 88% 58%)',
    fields: [
      { key: 'persona', label: 'Persona principal', placeholder: 'Ex: Empreendedor digital, 25-40 anos, busca escalar usando tecnologia...' },
      { key: 'pain_points', label: 'Dores e desafios', placeholder: 'Ex: Falta de tempo, dificuldade em criar conteúdo consistente...' },
      { key: 'desires', label: 'Desejos e motivações', placeholder: 'Ex: Automatizar processos, parecer profissional, crescer nas redes...' },
      { key: 'language_style', label: 'Como esse público fala', placeholder: 'Ex: Informal mas inteligente, usa termos de marketing digital...' },
    ],
  },
  {
    key: 'editorial_guidelines_json',
    title: 'Linha Editorial',
    description: 'Posicionamento, pilares e identidade da marca. Guia toda a criação de conteúdo.',
    icon: Brain,
    accent: 'hsl(258 82% 64%)',
    fields: [
      { key: 'positioning', label: 'Posicionamento da marca', placeholder: 'Ex: Plataforma de IA para marketing que democratiza inteligência criativa...' },
      { key: 'pillars', label: 'Pilares de conteúdo', placeholder: 'Ex: Educação, Autoridade, Bastidores, Cases...' },
      { key: 'hook_patterns', label: 'Padrões de gancho', placeholder: 'Ex: curiosidade, dor direta, estatística chocante, pergunta provocadora...' },
      { key: 'copy_style', label: 'Estilo de copy', placeholder: 'Ex: curto, direto, sem floreios, frases de impacto...' },
      { key: 'visual_patterns', label: 'Padrões visuais', placeholder: 'Ex: alto contraste, texto grande, fundos escuros, tipografia bold...' },
      { key: 'visual_identity', label: 'Identidade visual', placeholder: 'Ex: Dark mode, minimalista, paleta violeta + preto...' },
      { key: 'creative_principles', label: 'Princípios criativos', placeholder: 'Ex: Menos é mais. Dados > opinião. Mostre, não conte...' },
    ],
  },
  {
    key: 'voice_tone_json',
    title: 'Voz e Tom',
    description: 'Como a marca fala. A IA usa isso para manter consistência em textos e briefs.',
    icon: MessageSquare,
    accent: 'hsl(142 60% 42%)',
    fields: [
      { key: 'voice', label: 'Voz da marca', placeholder: 'Ex: Confiante, direta, inteligente sem ser arrogante...' },
      { key: 'tone_formal', label: 'Tom formal (ex: LinkedIn)', placeholder: 'Ex: Profissional, dados, autoridade técnica...' },
      { key: 'tone_casual', label: 'Tom casual (ex: Instagram)', placeholder: 'Ex: Próximo, educativo, levemente provocador...' },
      { key: 'forbidden_terms', label: 'Termos proibidos', placeholder: 'Ex: "hackeie", "guru", "fórmula mágica", "segredo"...' },
      { key: 'preferred_terms', label: 'Termos preferidos', placeholder: 'Ex: "inteligência", "sistema", "estratégia", "plataforma"...' },
      { key: 'cta_patterns', label: 'Padrões de CTA', placeholder: 'Ex: "Comece agora", "Teste grátis", "Veja como funciona"...' },
    ],
  },
  {
    key: 'rules_json',
    title: 'Regras Operacionais',
    description: 'Regras de negócio que a IA deve seguir ao gerar ou analisar conteúdo.',
    icon: ShieldCheck,
    accent: 'hsl(38 90% 50%)',
    fields: [
      { key: 'always_include', label: 'Sempre incluir', placeholder: 'Ex: CTA forte, gancho inicial, prova social...' },
      { key: 'never_include', label: 'Nunca incluir', placeholder: 'Ex: linguagem formal, texto longo, jargão corporativo...' },
      { key: 'content_structure', label: 'Estrutura padrão do conteúdo', placeholder: 'Ex: gancho → tensão → solução → CTA' },
      { key: 'content_rules', label: 'Regras gerais de conteúdo', placeholder: 'Ex: Máximo 2200 caracteres no Instagram. Sempre terminar com pergunta nos stories...' },
      { key: 'design_rules', label: 'Regras de design', placeholder: 'Ex: Logo sempre no canto inferior direito. Nunca usar mais de 3 cores por peça...' },
      { key: 'approval_rules', label: 'Regras de aprovação', placeholder: 'Ex: Todo conteúdo precisa de aprovação do gestor...' },
    ],
  },
];

export default function CompanyConfigPage() {
  const { user } = useAuth();
  const [config, setConfig] = useState<CompanyConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('company_config')
      .select('*')
      .eq('company_id', user.id)
      .single()
      .then(({ data }) => {
        if (data) setConfig(data as CompanyConfig);
        setLoaded(true);
      });
  }, [user]);

  const getField = (section: ConfigSection['key'], field: string): string => {
    const json = config?.[section];
    if (typeof json === 'object' && json !== null) return (json as Record<string, string>)[field] ?? '';
    return '';
  };

  const setField = (section: ConfigSection['key'], field: string, value: string) => {
    setConfig((prev) => {
      const base = prev ?? {
        id: '',
        company_id: user?.id ?? '',
        icp_json: {},
        editorial_guidelines_json: {},
        voice_tone_json: {},
        rules_json: {},
        updated_at: '',
      };
      return {
        ...base,
        [section]: { ...(base[section] as Record<string, unknown>), [field]: value },
      };
    });
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const payload = {
        company_id: user.id,
        icp_json: config?.icp_json ?? {},
        editorial_guidelines_json: config?.editorial_guidelines_json ?? {},
        voice_tone_json: config?.voice_tone_json ?? {},
        rules_json: config?.rules_json ?? {},
      };

      if (config?.id) {
        const { error } = await supabase
          .from('company_config')
          .update(payload)
          .eq('id', config.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('company_config')
          .insert(payload)
          .select()
          .single();
        if (error) throw error;
        if (data) setConfig(data as CompanyConfig);
      }
      toast.success('Configuração salva! A IA usará esse contexto automaticamente.');
    } catch (e: any) {
      toast.error(e.message || 'Erro ao salvar configuração.');
    } finally {
      setSaving(false);
    }
  };

  if (!loaded) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-4xl space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight">Cérebro da Marca</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Configuração global usada pela IA em toda a plataforma
            </p>
          </div>
          <Button
            onClick={handleSave}
            disabled={saving}
            style={{ background: 'hsl(258 82% 64%)', color: '#fff' }}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            {saving ? 'Salvando...' : 'Salvar tudo'}
          </Button>
        </div>

        {/* Learnings from references */}
        {(() => {
          const learn = config?.learnings_json as Record<string, string[]> | undefined;
          const categories: { key: string; label: string; accent: string }[] = [
            { key: 'hooks', label: 'Ganchos', accent: 'hsl(38 90% 50%)' },
            { key: 'copy_patterns', label: 'Copy', accent: 'hsl(217 88% 58%)' },
            { key: 'visual_patterns', label: 'Visual', accent: 'hsl(258 82% 64%)' },
            { key: 'structures', label: 'Estruturas', accent: 'hsl(142 60% 42%)' },
            { key: 'ctas', label: 'CTAs', accent: 'hsl(200 85% 55%)' },
          ];
          const hasAny = learn && categories.some(c => (learn[c.key] ?? []).length > 0);
          if (!hasAny) return null;

          const removeLearning = (category: string, index: number) => {
            if (!config || !learn) return;
            const arr = [...(learn[category] ?? [])];
            arr.splice(index, 1);
            setConfig({
              ...config,
              learnings_json: { ...learn, [category]: arr } as any,
            });
          };

          return (
            <div
              className="rounded-xl overflow-hidden bg-card border border-border"
            >
              <div
                className="flex items-center gap-3 px-5 py-4 border-b border-border"
                style={{ borderLeft: '3px solid hsl(258 82% 64%)' }}
              >
                <Sparkles className="h-5 w-5 text-accent" />
                <div>
                  <h2 className="text-sm font-semibold text-foreground">Aprendizados de Referências</h2>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Padrões extraídos automaticamente das análises. Remova os que não servem.
                  </p>
                </div>
              </div>
              <div className="p-5 space-y-4">
                {categories.map(({ key, label, accent }) => {
                  const items = learn?.[key] ?? [];
                  if (items.length === 0) return null;
                  return (
                    <div key={key}>
                      <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: accent }}>
                        {label} ({items.length})
                      </span>
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {items.map((item, i) => (
                          <span
                            key={i}
                            className="group flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg text-foreground/70 leading-snug max-w-full"
                            style={{ background: `${accent}10`, border: `1px solid ${accent}20` }}
                          >
                            <span className="truncate max-w-[300px]">{item}</span>
                            <button
                              onClick={() => removeLearning(key, i)}
                              className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {SECTIONS.map((section) => (
          <div
            key={section.key}
            className="rounded-xl overflow-hidden bg-card border border-border"
          >
            <div
              className="flex items-center gap-3 px-5 py-4 border-b border-border"
              style={{ borderLeft: `3px solid ${section.accent}` }}
            >
              <section.icon className="h-5 w-5" style={{ color: section.accent }} />
              <div>
                <h2 className="text-sm font-semibold text-foreground">{section.title}</h2>
                <p className="text-[11px] text-muted-foreground mt-0.5">{section.description}</p>
              </div>
            </div>
            <div className="p-5 space-y-4">
              {section.fields.map((field) => (
                <div key={field.key} className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">{field.label}</Label>
                  <Textarea
                    value={getField(section.key, field.key)}
                    onChange={(e) => setField(section.key, field.key, e.target.value)}
                    placeholder={field.placeholder}
                    className="min-h-[80px] resize-y text-sm bg-background"
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </AppLayout>
  );
}
