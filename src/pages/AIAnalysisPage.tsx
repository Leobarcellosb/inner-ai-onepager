import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { callAIClaude } from '@/lib/ai';
import { AppLayout } from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Brain, Upload, Loader2, ImageIcon, FileText, Lightbulb, X, Sparkles, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { PLATFORM_LABELS } from '@/types';

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
  reference_id: string;
}

const ANALYSIS_GROUPS: { title: string; icon: React.ReactNode; sections: { key: keyof Analysis; label: string }[] }[] = [
  {
    title: 'Visão Geral',
    icon: <Sparkles className="h-4 w-4" />,
    sections: [
      { key: 'analysis_summary', label: 'Resumo Executivo' },
      { key: 'piece_type', label: 'Tipo de Peça' },
      { key: 'probable_objective', label: 'Objetivo Provável' },
      { key: 'probable_audience', label: 'Público Provável' },
    ],
  },
  {
    title: 'Decodificação da Copy',
    icon: <FileText className="h-4 w-4" />,
    sections: [
      { key: 'main_hook', label: 'Hook Principal' },
      { key: 'copy_structure', label: 'Estrutura da Copy' },
      { key: 'central_promise', label: 'Promessa Central' },
      { key: 'observed_cta', label: 'CTA Observado' },
    ],
  },
  {
    title: 'Psicologia & Persuasão',
    icon: <Brain className="h-4 w-4" />,
    sections: [
      { key: 'persuasion_mechanisms', label: 'Mecanismos de Persuasão' },
      { key: 'emotional_angle', label: 'Ângulo Emocional' },
      { key: 'rational_angle', label: 'Ângulo Racional' },
    ],
  },
  {
    title: 'Design & Visual',
    icon: <ImageIcon className="h-4 w-4" />,
    sections: [
      { key: 'visual_hierarchy', label: 'Hierarquia Visual' },
      { key: 'observed_color_pattern', label: 'Padrão de Cores' },
      { key: 'observed_typography_style', label: 'Tipografia' },
      { key: 'visual_composition', label: 'Composição Visual' },
      { key: 'highlight_elements', label: 'Elementos de Destaque' },
    ],
  },
  {
    title: 'Avaliação',
    icon: <CheckCircle2 className="h-4 w-4" />,
    sections: [
      { key: 'why_it_works', label: 'Por que Funciona' },
      { key: 'strengths', label: 'Pontos Fortes' },
      { key: 'weaknesses', label: 'Pontos Fracos' },
      { key: 'fatigue_risks', label: 'Riscos de Saturação' },
    ],
  },
  {
    title: 'Ação & Adaptação',
    icon: <Lightbulb className="h-4 w-4" />,
    sections: [
      { key: 'adaptation_for_inner_ai', label: 'Como Adaptar para a Inner AI' },
      { key: 'inspired_generation_prompt', label: 'Prompt de Geração Inspirado' },
      { key: 'inspired_copy_prompt', label: 'Prompt de Copy Inspirado' },
      { key: 'execution_checklist', label: 'Checklist de Execução' },
    ],
  },
];

type AnalysisStep = 'upload' | 'analyzing' | 'done';

export default function AIAnalysisPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<AnalysisStep>('upload');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [platform, setPlatform] = useState('instagram');
  const [extraContext, setExtraContext] = useState('');
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [referenceId, setReferenceId] = useState<string | null>(null);
  const [referenceTitle, setReferenceTitle] = useState('');

  const handleFileSelect = useCallback((file: File) => {
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setImagePreview(e.target?.result as string);
    reader.readAsDataURL(file);
    setReferenceTitle(file.name.replace(/\.[^/.]+$/, ''));
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file?.type.startsWith('image/')) handleFileSelect(file);
  }, [handleFileSelect]);

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setReferenceTitle('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleAnalyze = async () => {
    if (!imageFile) { toast.error('Envie uma imagem para analisar.'); return; }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error('Você precisa estar autenticado.'); return; }

    setStep('analyzing');

    try {
      // 1. Upload image to storage
      const ext = imageFile.name.split('.').pop();
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('reference-images').upload(path, imageFile);
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from('reference-images').getPublicUrl(path);
      const imageUrl = urlData.publicUrl;

      // 2. Create reference record
      const title = referenceTitle || `Análise ${new Date().toLocaleDateString('pt-BR')}`;
      const { data: refData, error: refErr } = await supabase.from('references').insert({
        title,
        platform,
        format: 'post_estatico',
        reference_image_url: imageUrl,
        caption_or_observed_copy: extraContext,
        uploaded_by: user.id,
        created_by: user.id,
        analysis_status: 'em_analise',
      }).select('id').single();

      if (refErr) throw refErr;
      setReferenceId(refData.id);

      // 3. Invoke AI analysis
      const result = await callAIClaude<{ analysis: Analysis }>('analyze-reference', {
        referenceId: refData.id,
        title,
        platform,
        format: 'post_estatico',
        caption: extraContext,
        hook: '',
        imageUrl,
        sourceName: '',
      });

      if (result.analysis) {
        setAnalysis(result.analysis);
        setStep('done');
        toast.success('Análise concluída!');
      } else {
        throw new Error('Resposta inválida da IA');
      }
    } catch (e: any) {
      console.error('Analysis error:', e);
      toast.error(e.message || 'Erro ao analisar referência');
      setStep('upload');
      // Update status to error if we have a reference
      if (referenceId) {
        await supabase.from('references').update({ analysis_status: 'erro' }).eq('id', referenceId);
      }
    }
  };

  const handleSaveAsPlaybook = async () => {
    if (!analysis) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from('playbooks').insert({
      title: `Análise: ${referenceTitle || 'Referência'}`,
      category: 'Engenharia Reversa',
      summary: analysis.analysis_summary,
      framework: analysis.copy_structure,
      examples: analysis.why_it_works,
      recommended_use_cases: analysis.adaptation_for_inner_ai,
      created_by: user.id,
    });
    if (error) { toast.error(error.message); return; }
    toast.success('Salvo como playbook!');
  };

  const handleUseInContent = () => {
    if (!analysis || !referenceId) return;
    sessionStorage.setItem('referenceAnalysis', JSON.stringify({ refId: referenceId, analysis }));
    navigate('/contents/new');
  };

  const handleNewAnalysis = () => {
    setStep('upload');
    setImageFile(null);
    setImagePreview(null);
    setPlatform('instagram');
    setExtraContext('');
    setAnalysis(null);
    setReferenceId(null);
    setReferenceTitle('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <AppLayout>
      <div className="space-y-6 max-w-5xl">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
            <Brain className="h-5 w-5 text-accent" />
          </div>
          <div className="flex-1">
            <h1 className="font-display text-2xl font-bold tracking-tight">Análises com IA</h1>
            <p className="text-sm text-muted-foreground">
              Envie uma imagem e a IA faz a engenharia reversa estratégica completa
            </p>
          </div>
          {step === 'done' && (
            <Button onClick={handleNewAnalysis} variant="outline">
              <Upload className="mr-2 h-4 w-4" /> Nova Análise
            </Button>
          )}
        </div>

        {/* STEP: Upload */}
        {step === 'upload' && (
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Upload area */}
            <Card className="lg:col-span-2">
              <CardContent className="p-8">
                {!imagePreview ? (
                  <div
                    className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-muted-foreground/25 bg-muted/30 py-16 px-8 cursor-pointer transition-colors hover:border-accent/50 hover:bg-accent/5"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="mb-4 h-12 w-12 text-muted-foreground/40" />
                    <p className="text-base font-medium text-foreground mb-1">
                      Arraste uma imagem ou clique para enviar
                    </p>
                    <p className="text-sm text-muted-foreground">
                      PNG, JPG, WEBP — a IA fará toda a análise automaticamente
                    </p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileSelect(file);
                      }}
                    />
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-6 md:flex-row md:items-start">
                    <div className="relative w-full max-w-sm shrink-0">
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="w-full rounded-lg border object-contain max-h-80"
                      />
                      <Button
                        variant="destructive"
                        size="icon"
                        className="absolute -top-2 -right-2 h-7 w-7 rounded-full"
                        onClick={handleRemoveImage}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="flex-1 space-y-4 w-full">
                      <div>
                        <Label className="text-xs text-muted-foreground">Plataforma (opcional)</Label>
                        <Select value={platform} onValueChange={setPlatform}>
                          <SelectTrigger className="mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(PLATFORM_LABELS).map(([k, v]) => (
                              <SelectItem key={k} value={k}>{v}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Contexto adicional (opcional)</Label>
                        <Textarea
                          value={extraContext}
                          onChange={(e) => setExtraContext(e.target.value)}
                          placeholder="Ex: Campanha de lançamento, post de engajamento..."
                          className="mt-1 min-h-[80px] resize-y"
                        />
                      </div>
                      <Button
                        onClick={handleAnalyze}
                        size="lg"
                        className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
                      >
                        <Brain className="mr-2 h-5 w-5" />
                        Analisar com IA
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* STEP: Analyzing */}
        {step === 'analyzing' && (
          <Card className="flex flex-col items-center justify-center py-20">
            <div className="relative mb-6">
              <div className="absolute inset-0 animate-ping rounded-full bg-accent/20" />
              <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-accent/10">
                <Loader2 className="h-8 w-8 animate-spin text-accent" />
              </div>
            </div>
            <h2 className="font-display text-lg font-semibold mb-2">Analisando referência...</h2>
            <p className="text-sm text-muted-foreground max-w-md text-center">
              A IA está realizando a engenharia reversa estratégica completa. Isso pode levar alguns segundos.
            </p>
            {imagePreview && (
              <img src={imagePreview} alt="Analisando" className="mt-6 max-h-40 rounded-lg border opacity-60" />
            )}
          </Card>
        )}

        {/* STEP: Results */}
        {step === 'done' && analysis && (
          <div className="space-y-6">
            {/* Quick actions */}
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={handleUseInContent}>
                <FileText className="mr-1 h-3 w-3" /> Usar no Conteúdo
              </Button>
              <Button variant="outline" size="sm" onClick={handleSaveAsPlaybook}>
                <Lightbulb className="mr-1 h-3 w-3" /> Salvar como Playbook
              </Button>
            </div>

            {/* Image + Results grid */}
            <div className="grid gap-6 lg:grid-cols-3">
              {/* Image sidebar */}
              <div className="lg:col-span-1">
                {imagePreview && (
                  <Card className="overflow-hidden sticky top-4">
                    <img src={imagePreview} alt="Referência" className="w-full object-contain" />
                    <CardContent className="p-3">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant="secondary" className="bg-success/10 text-success">
                          Analisado
                        </Badge>
                        <span>{PLATFORM_LABELS[platform as keyof typeof PLATFORM_LABELS] || platform}</span>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Analysis sections */}
              <div className="lg:col-span-2 space-y-6">
                {ANALYSIS_GROUPS.map((group) => {
                  const hasContent = group.sections.some((s) => analysis[s.key]);
                  if (!hasContent) return null;
                  return (
                    <div key={group.title}>
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-accent">{group.icon}</span>
                        <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                          {group.title}
                        </h2>
                      </div>
                      <div className="grid gap-3 md:grid-cols-2">
                        {group.sections.map((s) => {
                          const val = analysis[s.key];
                          if (!val || s.key === 'id' || s.key === 'reference_id') return null;
                          const isWide = s.key === 'analysis_summary' || s.key === 'adaptation_for_inner_ai' || s.key === 'execution_checklist';
                          return (
                            <Card key={s.key} className={isWide ? 'md:col-span-2' : ''}>
                              <CardHeader className="pb-1 pt-4 px-4">
                                <CardTitle className="text-xs font-medium text-muted-foreground">
                                  {s.label}
                                </CardTitle>
                              </CardHeader>
                              <CardContent className="px-4 pb-4">
                                <p className="text-sm whitespace-pre-wrap">{val}</p>
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
