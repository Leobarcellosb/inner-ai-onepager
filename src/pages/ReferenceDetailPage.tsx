import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Brain, Loader2, ImageIcon, Lightbulb, FileText, PenTool, Trash2, Power, ThumbsUp, Minus, ThumbsDown } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { PLATFORM_LABELS, FORMAT_LABELS } from '@/types';

interface Reference {
  id: string;
  title: string;
  source_name: string;
  source_type: string;
  platform: string;
  format: string;
  reference_image_url: string | null;
  caption_or_observed_copy: string;
  observed_hook: string;
  objective_guess: string;
  audience_guess: string;
  tags: string[];
  analysis_status: string;
  is_active: boolean;
  quality: 'strong' | 'neutral' | 'weak';
}

interface Analysis {
  id: string;
  analysis_summary: string;
  piece_type: string;
  probable_objective: string;
  probable_audience: string;
  main_hook: string;
  copy_structure: string;
  central_promise: string;
  persuasion_mechanisms: string;
  emotional_angle: string;
  rational_angle: string;
  visual_hierarchy: string;
  observed_color_pattern: string;
  observed_typography_style: string;
  visual_composition: string;
  highlight_elements: string;
  observed_cta: string;
  why_it_works: string;
  strengths: string;
  weaknesses: string;
  fatigue_risks: string;
  adaptation_for_inner_ai: string;
  inspired_generation_prompt: string;
  inspired_copy_prompt: string;
  execution_checklist: string;
}

const ANALYSIS_SECTIONS: { key: keyof Analysis; label: string; group: string }[] = [
  { key: 'analysis_summary', label: 'Resumo Executivo', group: 'Visão Geral' },
  { key: 'piece_type', label: 'Tipo de Peça', group: 'Visão Geral' },
  { key: 'probable_objective', label: 'Objetivo Provável', group: 'Visão Geral' },
  { key: 'probable_audience', label: 'Público Provável', group: 'Visão Geral' },
  { key: 'main_hook', label: 'Hook Principal', group: 'Decodificação da Copy' },
  { key: 'copy_structure', label: 'Estrutura da Copy', group: 'Decodificação da Copy' },
  { key: 'central_promise', label: 'Promessa Central', group: 'Decodificação da Copy' },
  { key: 'observed_cta', label: 'CTA Observado', group: 'Decodificação da Copy' },
  { key: 'persuasion_mechanisms', label: 'Mecanismos de Persuasão', group: 'Psicologia' },
  { key: 'emotional_angle', label: 'Ângulo Emocional', group: 'Psicologia' },
  { key: 'rational_angle', label: 'Ângulo Racional', group: 'Psicologia' },
  { key: 'visual_hierarchy', label: 'Hierarquia Visual', group: 'Design' },
  { key: 'observed_color_pattern', label: 'Padrão de Cores', group: 'Design' },
  { key: 'observed_typography_style', label: 'Tipografia', group: 'Design' },
  { key: 'visual_composition', label: 'Composição Visual', group: 'Design' },
  { key: 'highlight_elements', label: 'Elementos de Destaque', group: 'Design' },
  { key: 'why_it_works', label: 'Por que Funciona', group: 'Avaliação' },
  { key: 'strengths', label: 'Pontos Fortes', group: 'Avaliação' },
  { key: 'weaknesses', label: 'Pontos Fracos', group: 'Avaliação' },
  { key: 'fatigue_risks', label: 'Riscos de Saturação', group: 'Avaliação' },
  { key: 'adaptation_for_inner_ai', label: 'Como Adaptar para a Inner AI', group: 'Ação' },
  { key: 'inspired_generation_prompt', label: 'Prompt de Geração Inspirado', group: 'Ação' },
  { key: 'inspired_copy_prompt', label: 'Prompt de Copy Inspirado', group: 'Ação' },
  { key: 'execution_checklist', label: 'Checklist de Execução', group: 'Ação' },
];

export default function ReferenceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [ref, setRef] = useState<Reference | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    if (!id) return;
    supabase.from('references').select('*').eq('id', id).single().then(({ data, error }) => {
      if (error || !data) {
        toast.error('Referência não encontrada.');
        navigate('/intelligence/references');
        return;
      }
      setRef(data as Reference);
    });
    supabase.from('reference_analyses').select('*').eq('reference_id', id).limit(1).single().then(({ data }) => {
      if (data) setAnalysis(data as Analysis);
    });
  }, [id]);

  const handleAnalyze = async () => {
    if (!ref) return;
    setAnalyzing(true);
    try {
      await supabase.from('references').update({ analysis_status: 'em_analise' }).eq('id', ref.id);
      const { data, error } = await supabase.functions.invoke('analyze-reference', {
        body: {
          referenceId: ref.id,
          title: ref.title,
          platform: ref.platform,
          format: ref.format,
          caption: ref.caption_or_observed_copy,
          hook: ref.observed_hook,
          imageUrl: ref.reference_image_url,
          sourceName: ref.source_name,
        },
      });
      if (error) throw error;
      if (data?.analysis) {
        setAnalysis(data.analysis);
        setRef(prev => prev ? { ...prev, analysis_status: 'analisado' } : null);
        toast.success('Análise concluída!');
      }
    } catch (e: any) {
      toast.error(e.message || 'Erro na análise');
      await supabase.from('references').update({ analysis_status: 'erro' }).eq('id', ref.id);
      setRef(prev => prev ? { ...prev, analysis_status: 'erro' } : null);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSaveAsPlaybook = async () => {
    if (!analysis || !ref) return;
    const { error } = await supabase.from('playbooks').insert({
      title: `Análise: ${ref.title}`,
      category: 'Engenharia Reversa',
      summary: analysis.analysis_summary,
      framework: analysis.copy_structure,
      examples: analysis.why_it_works,
      recommended_use_cases: analysis.adaptation_for_inner_ai,
      created_by: (await supabase.auth.getUser()).data.user?.id || '',
    });
    if (error) { toast.error(error.message); return; }
    toast.success('Salvo como playbook!');
  };

  if (!ref) return <AppLayout><div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin" /></div></AppLayout>;

  const handleSetQuality = async (quality: 'strong' | 'neutral' | 'weak') => {
    if (!ref || ref.quality === quality) return;
    try {
      const { error } = await supabase.from('references').update({ quality }).eq('id', ref.id);
      if (error) throw error;
      setRef({ ...ref, quality });
      queryClient.invalidateQueries({ queryKey: ['references'] });
      const labels = { strong: 'Forte', neutral: 'Neutro', weak: 'Fraco' };
      toast.success(`Qualidade: ${labels[quality]}`);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao avaliar');
    }
  };

  const handleToggleActive = async () => {
    if (!ref) return;
    try {
      const { error } = await supabase.from('references').update({ is_active: !ref.is_active }).eq('id', ref.id);
      if (error) throw error;
      setRef({ ...ref, is_active: !ref.is_active });
      queryClient.invalidateQueries({ queryKey: ['references'] });
      queryClient.invalidateQueries({ queryKey: ['brain'] });
      toast.success(ref.is_active ? 'Referência desativada' : 'Referência reativada');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao alterar status');
    }
  };

  const handleDeleteRef = async () => {
    if (!ref || !confirm(`Excluir "${ref.title}"? A análise e imagem serão removidas.`)) return;
    try {
      const { error } = await supabase.from('references').delete().eq('id', ref.id);
      if (error) throw error;
      if (ref.reference_image_url) {
        try {
          const url = new URL(ref.reference_image_url);
          const pathMatch = url.pathname.match(/\/object\/public\/reference-images\/(.+)/);
          if (pathMatch) await supabase.storage.from('reference-images').remove([decodeURIComponent(pathMatch[1])]);
        } catch { /* non-blocking */ }
      }
      queryClient.invalidateQueries({ queryKey: ['references'] });
      queryClient.invalidateQueries({ queryKey: ['brain'] });
      toast.success('Referência excluída');
      navigate('/intelligence/references');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao excluir');
    }
  };

  const groups = ANALYSIS_SECTIONS.reduce<Record<string, typeof ANALYSIS_SECTIONS>>((acc, s) => {
    (acc[s.group] = acc[s.group] || []).push(s);
    return acc;
  }, {});

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/intelligence/references')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h1 className="font-display text-xl font-bold tracking-tight">{ref.title}</h1>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>{PLATFORM_LABELS[ref.platform as keyof typeof PLATFORM_LABELS] || ref.platform}</span>
              <span>·</span>
              <span>{FORMAT_LABELS[ref.format as keyof typeof FORMAT_LABELS] || ref.format}</span>
              {ref.source_name && <><span>·</span><span>{ref.source_name}</span></>}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {analysis && (
              <>
                <Button variant="outline" size="sm" onClick={() => {
                  // Navigate to new content with reference pre-selected
                  navigate('/contents/new');
                  // Store analysis in sessionStorage for pickup
                  sessionStorage.setItem('referenceAnalysis', JSON.stringify({ refId: ref.id, analysis }));
                }}>
                  <FileText className="mr-1 h-3 w-3" /> Usar no Conteúdo
                </Button>
                <Button variant="outline" size="sm" onClick={handleSaveAsPlaybook}>
                  <Lightbulb className="mr-1 h-3 w-3" /> Salvar como Playbook
                </Button>
              </>
            )}
            <Button onClick={handleAnalyze} disabled={analyzing} size="sm">
              {analyzing ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Brain className="mr-1 h-3 w-3" />}
              {analyzing ? 'Analisando...' : analysis ? 'Reanalisar' : 'Analisar com IA'}
            </Button>
            <div className="flex items-center border border-border rounded-md overflow-hidden">
              {([
                { q: 'strong' as const, icon: ThumbsUp, tip: 'Forte' },
                { q: 'neutral' as const, icon: Minus, tip: 'Neutro' },
                { q: 'weak' as const, icon: ThumbsDown, tip: 'Fraco' },
              ]).map(({ q, icon: Icon, tip }) => (
                <button
                  key={q}
                  onClick={() => handleSetQuality(q)}
                  className={`px-2 py-1.5 transition-colors ${ref.quality === q
                    ? q === 'strong' ? 'bg-success/15 text-success' : q === 'weak' ? 'bg-destructive/15 text-destructive' : 'bg-muted text-muted-foreground'
                    : 'text-muted-foreground/40 hover:text-muted-foreground'}`}
                  title={tip}
                >
                  <Icon className="h-3.5 w-3.5" />
                </button>
              ))}
            </div>
            <Button
              onClick={handleToggleActive}
              variant="outline"
              size="sm"
              className={ref.is_active ? 'text-warning border-warning/30 hover:bg-warning/10' : 'text-success border-success/30 hover:bg-success/10'}
            >
              <Power className="h-3.5 w-3.5 mr-1" />
              {ref.is_active ? 'Desativar' : 'Reativar'}
            </Button>
            <Button onClick={handleDeleteRef} variant="outline" size="icon" className="h-8 w-8 text-destructive border-destructive/30 hover:bg-destructive/10">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-1 space-y-4">
            {ref.reference_image_url ? (
              <Card className="overflow-hidden">
                <img src={ref.reference_image_url} alt={ref.title} className="w-full object-contain" />
              </Card>
            ) : (
              <Card className="flex aspect-square items-center justify-center">
                <ImageIcon className="h-12 w-12 text-muted-foreground/30" />
              </Card>
            )}
            {ref.caption_or_observed_copy && (
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-xs uppercase text-muted-foreground">Copy Observada</CardTitle></CardHeader>
                <CardContent><p className="text-sm whitespace-pre-wrap">{ref.caption_or_observed_copy}</p></CardContent>
              </Card>
            )}
            {ref.observed_hook && (
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-xs uppercase text-muted-foreground">Hook</CardTitle></CardHeader>
                <CardContent><p className="text-sm">{ref.observed_hook}</p></CardContent>
              </Card>
            )}
            {ref.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {ref.tags.map(t => <Badge key={t} variant="outline" className="text-xs">{t}</Badge>)}
              </div>
            )}
          </div>

          <div className="lg:col-span-2 space-y-6">
            {!analysis && !analyzing && (
              <Card className="flex flex-col items-center justify-center py-12">
                <Brain className="mb-3 h-10 w-10 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground mb-4">Nenhuma análise realizada</p>
                <Button onClick={handleAnalyze}><Brain className="mr-2 h-4 w-4" /> Analisar com IA</Button>
              </Card>
            )}

            {analyzing && (
              <Card className="flex flex-col items-center justify-center py-12">
                <Loader2 className="mb-3 h-10 w-10 animate-spin text-accent" />
                <p className="text-sm text-muted-foreground">Gerando engenharia reversa...</p>
              </Card>
            )}

            {analysis && !analyzing && Object.entries(groups).map(([group, sections]) => (
              <div key={group}>
                <h2 className="mb-3 font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">{group}</h2>
                <div className="grid gap-3 md:grid-cols-2">
                  {sections.map((s) => {
                    const val = analysis[s.key];
                    if (!val) return null;
                    return (
                      <Card key={s.key} className={s.key === 'analysis_summary' || s.key === 'adaptation_for_inner_ai' ? 'md:col-span-2' : ''}>
                        <CardHeader className="pb-1">
                          <CardTitle className="text-xs font-medium text-muted-foreground">{s.label}</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm whitespace-pre-wrap">{val}</p>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
