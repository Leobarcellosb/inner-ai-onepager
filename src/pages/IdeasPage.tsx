import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Lightbulb, Sparkles, Loader2, Plus, ArrowRight, CalendarDays, Check } from 'lucide-react';
import { toast } from 'sonner';
import { ensureScheduledDate, ensureScheduledTime } from '@/lib/pipeline';
import { format as fmtDate } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PLATFORM_LABELS, FORMAT_LABELS } from '@/types';
import { callAIClaude } from '@/lib/ai';

const OBJECTIVE_COLORS: Record<string, string> = {
  educar: 'hsl(217 88% 58%)',
  converter: 'hsl(142 60% 42%)',
  engajar: 'hsl(38 90% 50%)',
  autoridade: 'hsl(258 82% 64%)',
  awareness: 'hsl(200 85% 55%)',
};

interface Idea {
  title: string;
  hook: string;
  angle: string;
  format: string;
  objective: string;
  pillar: string;
  platform: string;
}

interface PlannedItem extends Idea {
  date: string;
  time: string;
  reason: string;
}

export default function IdeasPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(false);
  const [count, setCount] = useState('5');
  const [platform, setPlatform] = useState('all');
  const [pillar, setPillar] = useState('');
  const [theme, setTheme] = useState('');
  const [plan, setPlan] = useState<PlannedItem[]>([]);
  const [planning, setPlanning] = useState(false);
  const [weeks, setWeeks] = useState('1');
  const [postsPerWeek, setPostsPerWeek] = useState('5');
  const [saving, setSaving] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const result = await callAIClaude<{ ideas: Idea[] }>('generate-ideas', {
        topic: theme || pillar || 'conteúdo',
        count: parseInt(count),
      });
      const ideas = result.ideas ?? [];
      setIdeas(ideas);
      toast.success(`${ideas.length} ideias geradas!`);
    } catch (e: any) {
      toast.error(e.message || 'Erro ao gerar ideias');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateContent = async (idea: Idea) => {
    if (!user) return;
    try {
      const { data, error } = await supabase.from('contents').insert({
        title: idea.title,
        theme: idea.pillar || '',
        platform: idea.platform in PLATFORM_LABELS ? idea.platform : 'instagram',
        format: idea.format in FORMAT_LABELS ? idea.format : 'post_estatico',
        objective: idea.objective || '',
        raw_text: [idea.hook, idea.angle].filter(Boolean).join('\n\n'),
        created_by: user.id,
        status: 'idea',
        priority: 'medium',
        content_type: idea.format || 'post',
        scheduled_date: ensureScheduledDate(null),
        scheduled_time: ensureScheduledTime(null),
      }).select('id').single();
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['contents'] });
      toast.success('Conteúdo criado — abra para iniciar a escrita');
      navigate(`/contents/${data.id}`);
    } catch (e: any) {
      toast.error(e.message || 'Erro ao criar conteúdo');
    }
  };

  const handlePlanCalendar = async () => {
    if (ideas.length === 0) { toast.error('Gere ideias primeiro.'); return; }
    setPlanning(true);
    try {
      const today = new Date();
      const startDate = fmtDate(today, 'yyyy-MM-dd');
      const result = await callAIClaude<{ plan: PlannedItem[] }>('plan-calendar', {
        period: `${parseInt(weeks)} semanas a partir de ${startDate}`,
        frequency: `${parseInt(postsPerWeek)}x por semana`,
        goal: 'engajamento',
      });
      const planned = result.plan ?? [];
      setPlan(planned);
      toast.success(`Calendário com ${planned.length} posts planejado!`);
    } catch (e: any) {
      toast.error(e.message || 'Erro ao planejar calendário');
    } finally {
      setPlanning(false);
    }
  };

  const handleSavePlan = async () => {
    if (!user || plan.length === 0) return;
    setSaving(true);
    try {
      const records = plan.map((p) => ({
        title: p.title,
        theme: p.pillar || '',
        platform: p.platform in PLATFORM_LABELS ? p.platform : 'instagram',
        format: p.format in FORMAT_LABELS ? p.format : 'post_estatico',
        objective: p.objective || '',
        raw_text: p.hook || '',
        created_by: user.id,
        status: 'idea' as const,
        priority: 'medium' as const,
        content_type: p.format || 'post',
        scheduled_date: ensureScheduledDate(p.date),
        scheduled_time: ensureScheduledTime(p.time),
      }));
      const { error } = await supabase.from('contents').insert(records);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['contents'] });
      toast.success(`${records.length} conteúdos criados e agendados — visíveis no Pipeline`);
      navigate('/pipeline');
    } catch (e: any) {
      toast.error(e.message || 'Erro ao salvar calendário');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight flex items-center gap-2">
            <Lightbulb className="h-6 w-6 text-warning" />
            Gerador de Ideias
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Ideias alinhadas com sua estratégia, ICP e aprendizados de referências
          </p>
        </div>

        {/* Controls */}
        <div
          className="rounded-xl p-5 space-y-4 bg-card border border-border"
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Quantidade</Label>
              <Select value={count} onValueChange={setCount}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">3 ideias</SelectItem>
                  <SelectItem value="5">5 ideias</SelectItem>
                  <SelectItem value="10">10 ideias</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Plataforma</Label>
              <Select value={platform} onValueChange={setPlatform}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Qualquer" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Qualquer</SelectItem>
                  {Object.entries(PLATFORM_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Pilar editorial</Label>
              <Input
                value={pillar}
                onChange={(e) => setPillar(e.target.value)}
                placeholder="Ex: Educação"
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Tema / foco</Label>
              <Input
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                placeholder="Ex: produtividade"
                className="h-9 text-sm"
              />
            </div>
          </div>
          <Button
            onClick={handleGenerate}
            disabled={loading}
            className="w-full font-semibold"
            style={{ background: 'hsl(258 82% 64%)', color: '#fff' }}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Sparkles className="h-4 w-4 mr-2" />
            )}
            {loading ? 'Gerando ideias...' : 'Gerar ideias com IA'}
          </Button>
        </div>

        {/* Results */}
        {ideas.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">{ideas.length} ideias geradas — clique para criar conteúdo</p>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {ideas.map((idea, i) => {
              const objColor = OBJECTIVE_COLORS[idea.objective?.toLowerCase()] ?? 'hsl(240 5% 50%)';
              return (
                <div
                  key={i}
                  className="rounded-xl overflow-hidden group bg-card border border-border"
                >
                  <div className="p-5 space-y-3">
                    {/* Title + badges */}
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="text-sm font-semibold text-foreground/90 leading-snug flex-1">
                        {idea.title}
                      </h3>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {idea.pillar && (
                          <Badge variant="outline" className="text-[9px]">{idea.pillar}</Badge>
                        )}
                        <Badge
                          className="text-[9px] font-bold"
                          style={{ background: `${objColor}15`, color: objColor, border: 'none' }}
                        >
                          {idea.objective}
                        </Badge>
                      </div>
                    </div>

                    {/* Hook */}
                    <div>
                      <span className="text-[9px] uppercase tracking-wider text-muted-foreground/50 font-semibold">Gancho</span>
                      <p className="text-xs text-foreground/70 mt-0.5 leading-relaxed">{idea.hook}</p>
                    </div>

                    {/* Angle */}
                    <div>
                      <span className="text-[9px] uppercase tracking-wider text-muted-foreground/50 font-semibold">Ângulo</span>
                      <p className="text-xs text-foreground/70 mt-0.5 leading-relaxed">{idea.angle}</p>
                    </div>

                    {/* Meta + action */}
                    <div className="flex items-center justify-between pt-1">
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                        <span>{PLATFORM_LABELS[idea.platform as keyof typeof PLATFORM_LABELS] ?? idea.platform}</span>
                        <span className="text-muted-foreground/30">·</span>
                        <span>{FORMAT_LABELS[idea.format as keyof typeof FORMAT_LABELS] ?? idea.format}</span>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleCreateContent(idea)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-accent"
                      >
                        <Plus className="h-3.5 w-3.5 mr-1" />
                        Criar conteúdo
                        <ArrowRight className="h-3 w-3 ml-1" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
            </div>
          </div>
        )}

        {/* Plan calendar */}
        {ideas.length > 0 && (
          <div
            className="rounded-xl overflow-hidden bg-card border border-border"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-accent" />
                <span className="text-sm font-semibold">Distribuir no Calendário</span>
              </div>
              <div className="flex items-center gap-2">
                <Select value={postsPerWeek} onValueChange={setPostsPerWeek}>
                  <SelectTrigger className="h-8 w-[120px] text-xs border-0 bg-transparent"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3">3x / semana</SelectItem>
                    <SelectItem value="5">5x / semana</SelectItem>
                    <SelectItem value="7">7x / semana</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={weeks} onValueChange={setWeeks}>
                  <SelectTrigger className="h-8 w-[110px] text-xs border-0 bg-transparent"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 semana</SelectItem>
                    <SelectItem value="2">2 semanas</SelectItem>
                    <SelectItem value="4">4 semanas</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  onClick={handlePlanCalendar}
                  disabled={planning}
                  style={{ background: 'hsl(258 82% 64%)', color: '#fff' }}
                >
                  {planning ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <CalendarDays className="h-3.5 w-3.5 mr-1" />}
                  {planning ? 'Planejando...' : 'Planejar'}
                </Button>
              </div>
            </div>

            {plan.length > 0 && (
              <div>
                <div className="divide-y divide-border">
                  {plan.map((p, i) => {
                    const objColor = OBJECTIVE_COLORS[p.objective?.toLowerCase()] ?? 'hsl(240 5% 50%)';
                    const dateObj = new Date(p.date + 'T12:00:00');
                    return (
                      <div key={i} className="flex items-center gap-4 px-5 py-3 hover:bg-white/[0.02] transition-colors">
                        {/* Date */}
                        <div className="text-center shrink-0 w-14">
                          <div className="text-lg font-display font-bold text-foreground/80">
                            {fmtDate(dateObj, 'dd')}
                          </div>
                          <div className="text-[9px] uppercase text-muted-foreground">
                            {fmtDate(dateObj, 'EEE', { locale: ptBR })}
                          </div>
                        </div>

                        {/* Time */}
                        <div className="text-xs text-muted-foreground shrink-0 w-12">{p.time}</div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground/85 truncate">{p.title}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{p.reason}</p>
                        </div>

                        {/* Meta */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-[9px] text-muted-foreground">
                            {PLATFORM_LABELS[p.platform as keyof typeof PLATFORM_LABELS] ?? p.platform}
                          </span>
                          <Badge
                            className="text-[8px]"
                            style={{ background: `${objColor}15`, color: objColor, border: 'none' }}
                          >
                            {p.objective}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Save plan */}
                <div className="flex items-center justify-between px-5 py-3 border-t border-border">
                  <span className="text-xs text-muted-foreground">{plan.length} posts planejados</span>
                  <Button
                    size="sm"
                    onClick={handleSavePlan}
                    disabled={saving}
                    className="font-semibold"
                    style={{ background: 'hsl(142 60% 42%)', color: '#fff' }}
                  >
                    {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Check className="h-3.5 w-3.5 mr-1" />}
                    {saving ? 'Salvando...' : 'Salvar e agendar tudo'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Empty state */}
        {!loading && ideas.length === 0 && (
          <div
            className="rounded-xl p-12 text-center bg-card border border-border"
          >
            <Lightbulb className="h-10 w-10 text-warning/20 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              Configure o Cérebro da Marca e clique em gerar para receber ideias personalizadas
            </p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
