import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/AppLayout';
import { AIImprovePanel } from '@/components/AIImprovePanel';
import { BriefGeneratorPanel } from '@/components/BriefGeneratorPanel';
import { ScheduleSection } from '@/components/ScheduleSection';
import { ContentStatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Sparkles, Save, ArrowLeft, PenTool, ExternalLink, Link as LinkIcon, ChevronRight, ChevronLeft, Zap, Loader2, LayoutGrid, Copy, ClipboardCopy } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { notifyStatusChange } from '@/lib/notifications';
import { PipelineBar, getNextTransition, getPrevTransition } from '@/components/PipelineBar';
import { recordOptimization } from '@/lib/brain-memory';
import { auditLog } from '@/lib/audit';
import { validateTransition, getMissingRequirements, getStageGuidance } from '@/lib/pipeline';
import { PLATFORM_LABELS, FORMAT_LABELS, STATUS_LABELS } from '@/types';
import type { Content, ContentStatus } from '@/types';

export default function ContentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [content, setContent] = useState<Content | null>(null);
  const [loading, setLoading] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [optimizeResult, setOptimizeResult] = useState<{ changes: string[]; score_before: number; score_after: number } | null>(null);
  const [carouselOpen, setCarouselOpen] = useState(false);
  const [carouselSlides, setCarouselSlides] = useState('5');
  const [carouselLoading, setCarouselLoading] = useState(false);
  const [carousel, setCarousel] = useState<{ carousel_title: string; total_slides?: number; slides: { position: number; type: string; headline: string; body: string; visual_direction: string; designer_note: string }[] } | null>(null);
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [briefPanelOpen, setBriefPanelOpen] = useState(false);

  useEffect(() => {
    if (id) fetchContent();
  }, [id]);

  const fetchContent = async () => {
    const { data, error } = await supabase.from('contents').select('*').eq('id', id!).single();
    if (error || !data) {
      toast.error('Conteúdo não encontrado.');
      navigate('/contents');
      return;
    }
    setContent(data as Content);
    if (data.carousel_script && typeof data.carousel_script === 'object') {
      setCarousel(data.carousel_script as any);
      if (data.carousel_slide_count) setCarouselSlides(String(data.carousel_slide_count));
    }
  };

  const updateField = (field: string, value: string | null) => {
    setContent((prev) => prev ? { ...prev, [field]: value } : null);
  };

  const computeScheduledDatetime = (date: string | null, time: string | null): string | null => {
    if (!date || !time) return null;
    return `${date}T${time}:00`;
  };

  const handleScheduleDateChange = (date: string | null) => {
    const time = content?.scheduled_time || null;
    setContent((prev) => prev ? {
      ...prev,
      scheduled_date: date,
      scheduled_datetime: computeScheduledDatetime(date, time),
    } : null);
  };

  const handleScheduleTimeChange = (time: string | null) => {
    const date = content?.scheduled_date || null;
    setContent((prev) => prev ? {
      ...prev,
      scheduled_time: time,
      scheduled_datetime: computeScheduledDatetime(date, time),
    } : null);
  };

  const handleSave = async () => {
    if (!content) return;
    setLoading(true);
    try {
      // Exclude: id, timestamps, status (handled by pipeline), computed fields, relations
      const {
        id: _id, created_at: _ca, created_by: _cb, profiles: _p,
        status: _status, scheduled_datetime: _sdt, updated_at: _ua,
        approved_copy_at: _ac, sent_to_design_at: _sd, design_started_at: _ds,
        final_approved_at: _fa, published_at: _pa,
        ...fieldsOnly
      } = content;

      const { error } = await supabase.from('contents').update(fieldsOnly).eq('id', content.id);
      if (error) {
        const msg = error.message?.includes('RAISE') ? error.message.replace(/.*RAISE.*: /, '') : error.message;
        throw new Error(msg || 'Erro ao salvar.');
      }
      queryClient.invalidateQueries({ queryKey: ['contents'] });
      toast.success('Conteúdo atualizado!');
    } catch (e: any) {
      toast.error(e.message || 'Erro ao salvar.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAIPanel = () => {
    if (!content?.raw_text?.trim()) {
      toast.error('Escreva um texto base primeiro.');
      return;
    }
    setAiPanelOpen(true);
  };

  const handleAdvanceStatus = async (newStatus: ContentStatus) => {
    if (!content) return;
    const error = validateTransition(content, newStatus);
    if (error) {
      toast.error(error);
      return;
    }
    try {
      const { error: dbError } = await supabase
        .from('contents')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', content.id);
      if (dbError) {
        const msg = dbError.message?.includes('RAISE') ? dbError.message.replace(/.*RAISE.*: /, '') : dbError.message;
        throw new Error(msg);
      }
      // Refetch to get DB-computed fields + invalidate all views
      await fetchContent();
      queryClient.invalidateQueries({ queryKey: ['contents'] });
      toast.success(`Status → ${STATUS_LABELS[newStatus]}`);
      if (user?.id) {
        notifyStatusChange(content.id, content.title, newStatus, content.assigned_to, content.created_by, user.id);
        auditLog('status_change', 'content', content.id, user.id, { from: content.status, to: newStatus, title: content.title, via: 'detail_page' });
      }
    } catch (e: any) {
      toast.error(e.message || 'Erro ao mudar status.');
    }
  };

  const handleBriefCreated = () => {
    fetchContent();
  };

  const canSkipToDesign = content && ['idea', 'writing', 'copy_review', 'copy_approved'].includes(content.status);

  const handleSkipToDesign = async () => {
    if (!content || !user) return;
    const path: ContentStatus[] = ['idea', 'writing', 'copy_review', 'copy_approved', 'design_queue'];
    const startIdx = path.indexOf(content.status as ContentStatus);
    if (startIdx < 0) return;
    const steps = path.slice(startIdx + 1);
    if (steps.length === 0) return;

    try {
      // Walk through each step (trigger enforces ±1)
      for (const step of steps) {
        const payload: Record<string, unknown> = { status: step, updated_at: new Date().toISOString() };
        // On the final step, stamp the auto-approval audit fields
        if (step === 'design_queue') {
          payload.copy_auto_approved = true;
          payload.copy_auto_approved_by = user.id;
          payload.copy_auto_approved_at = new Date().toISOString();
        }
        const { error } = await supabase.from('contents').update(payload).eq('id', content.id);
        if (error) {
          const msg = error.message?.includes('RAISE') ? error.message.replace(/.*RAISE.*: /, '') : error.message;
          throw new Error(msg);
        }
      }
      await fetchContent();
      queryClient.invalidateQueries({ queryKey: ['contents'] });
      toast.success('Copy pré-aprovada — enviado para fila de design');
    } catch (e: any) {
      toast.error(e.message || 'Erro ao avançar para design');
    }
  };

  const handleGenerateCarousel = async () => {
    if (!content) return;
    setCarouselLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-carousel', {
        body: {
          theme: content.title,
          base_text: content.improved_text || content.raw_text || '',
          slide_count: parseInt(carouselSlides),
          platform: content.platform,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const c = data.carousel;
      setCarousel(c);

      // Persist carousel to DB
      await supabase.from('contents').update({
        carousel_script: c,
        carousel_slide_count: c.slides?.length ?? parseInt(carouselSlides),
      }).eq('id', content.id);

      setContent(prev => prev ? { ...prev, carousel_script: c, carousel_slide_count: c.slides?.length } : null);
      queryClient.invalidateQueries({ queryKey: ['contents'] });
      toast.success(`Carrossel de ${c.slides.length} slides gerado e salvo`);
    } catch (e: any) {
      toast.error(e.message || 'Erro ao gerar carrossel');
    } finally {
      setCarouselLoading(false);
    }
  };

  const handleUpdateSlide = (position: number, field: string, value: string) => {
    if (!carousel) return;
    const updated = {
      ...carousel,
      slides: carousel.slides.map(s => s.position === position ? { ...s, [field]: value } : s),
    };
    setCarousel(updated);
  };

  const handleSaveCarousel = async () => {
    if (!content || !carousel) return;
    try {
      await supabase.from('contents').update({ carousel_script: carousel }).eq('id', content.id);
      setContent(prev => prev ? { ...prev, carousel_script: carousel as any } : null);
      queryClient.invalidateQueries({ queryKey: ['contents'] });
      toast.success('Roteiro salvo');
    } catch {
      toast.error('Erro ao salvar roteiro');
    }
  };

  const handleOptimize = async () => {
    if (!content?.raw_text?.trim()) { toast.error('Escreva o texto antes de otimizar.'); return; }
    setOptimizing(true);
    setOptimizeResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('optimize-content', {
        body: {
          text: content.improved_text || content.raw_text,
          title: content.title,
          cta: content.cta,
          platform: content.platform,
          format: content.format,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const r = data.result;
      setContent(prev => prev ? {
        ...prev,
        improved_text: r.optimized_text || prev.improved_text,
        cta: r.optimized_cta || prev.cta,
      } : null);
      setOptimizeResult({
        changes: Array.isArray(r.changes) ? r.changes : [],
        score_before: r.score_before ?? 0,
        score_after: r.score_after ?? 0,
      });
      if (user?.id) {
        recordOptimization(content.id, content.improved_text || content.raw_text || '', r.optimized_text || '', r.score_before ?? 0, r.score_after ?? 0, user.id);
      }
      toast.success(`Otimizado: ${r.score_before} → ${r.score_after} pontos`);
    } catch (e: any) {
      toast.error(e.message || 'Erro ao otimizar');
    } finally {
      setOptimizing(false);
    }
  };

  if (!content) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent" />
        </div>
      </AppLayout>
    );
  }


  return (
    <AppLayout>
      <div className="space-y-4 animate-fade-in">
        {/* Header — compact with badges */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <Button variant="ghost" size="icon" className="shrink-0 mt-0.5" onClick={() => navigate('/contents')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-0">
              <h1 className="font-display text-xl font-bold truncate">{content.title}</h1>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <ContentStatusBadge status={content.status} />
                <span className="text-xs text-muted-foreground">{PLATFORM_LABELS[content.platform]}</span>
                <span className="text-muted-foreground/30 text-xs">·</span>
                <span className="text-xs text-muted-foreground">{FORMAT_LABELS[content.format as keyof typeof FORMAT_LABELS]}</span>
                {(content as any).priority && (content as any).priority !== 'medium' && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold" style={{
                    background: (content as any).priority === 'urgent' ? 'hsl(0 72% 51% / 0.12)' : (content as any).priority === 'high' ? 'hsl(38 90% 50% / 0.12)' : 'hsl(var(--muted))',
                    color: (content as any).priority === 'urgent' ? 'hsl(0 72% 51%)' : (content as any).priority === 'high' ? 'hsl(38 90% 50%)' : 'hsl(var(--muted-foreground))',
                  }}>
                    {(content as any).priority}
                  </span>
                )}
                {content.source_origin && content.source_origin !== 'manual' && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                    {content.source_origin}
                  </span>
                )}
                {content.copy_auto_approved && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold" style={{ background: 'hsl(38 90% 50% / 0.12)', color: 'hsl(38 90% 50%)' }}>
                    PRÉ-APROVADO
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            {content.raw_text?.trim() && (
              <Button onClick={handleOptimize} disabled={optimizing} variant="outline" size="sm" className="text-warning border-warning/30 hover:bg-warning/10">
                {optimizing ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Zap className="h-3.5 w-3.5 mr-1" />}
                Otimizar
              </Button>
            )}
            {canSkipToDesign && (
              <Button onClick={handleSkipToDesign} variant="outline" size="sm" className="text-xs">Design</Button>
            )}
            <Button onClick={() => setBriefPanelOpen(true)} variant="outline" size="sm" className="border-accent text-accent hover:bg-accent/10">
              <PenTool className="h-3.5 w-3.5 mr-1" /> Brief
            </Button>
            <Button onClick={handleSave} disabled={loading} size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90">
              <Save className="h-3.5 w-3.5 mr-1" /> {loading ? '...' : 'Salvar'}
            </Button>
          </div>
        </div>

        {/* Pipeline progress + contextual guidance */}
        <div
          className="rounded-xl overflow-hidden bg-card border border-border"
        >
          {/* Progress bar */}
          <div className="px-5 pt-4 pb-3">
            <PipelineBar currentStatus={content.status} />

            {content.copy_auto_approved && (
              <div className="flex items-center gap-2 mt-2 px-1">
                <span
                  className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                  style={{ background: 'hsl(38 90% 50% / 0.12)', color: 'hsl(38 90% 50%)' }}
                >
                  Copy pré-aprovada
                </span>
                {content.copy_auto_approved_at && (
                  <span className="text-[9px] text-muted-foreground">
                    em {new Date(content.copy_auto_approved_at).toLocaleDateString('pt-BR')}
                  </span>
                )}
                <span className="text-[9px] text-muted-foreground">
                  · origem: {content.source_origin === 'import' ? 'importação' : 'aprovação manual'}
                </span>
              </div>
            )}
          </div>

          {/* Optimization result */}
          {optimizeResult && (
            <div className="px-5 pb-3 space-y-2 border-t border-border">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold text-warning flex items-center gap-1">
                  <Zap className="h-3 w-3" /> Otimização aplicada
                </span>
                <div className="flex items-center gap-2 text-[11px]">
                  <span className="text-muted-foreground">{optimizeResult.score_before}</span>
                  <span className="text-muted-foreground/40">→</span>
                  <span className="font-bold" style={{ color: optimizeResult.score_after >= 80 ? 'hsl(142 60% 42%)' : 'hsl(38 90% 50%)' }}>
                    {optimizeResult.score_after}
                  </span>
                </div>
              </div>
              {optimizeResult.changes.length > 0 && (
                <div className="space-y-0.5">
                  {optimizeResult.changes.map((c, i) => (
                    <p key={i} className="text-[10px] text-foreground/60 flex gap-1.5">
                      <span className="text-warning shrink-0">→</span>{c}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Stage guidance */}
          {(() => {
            const guidance = getStageGuidance(content);
            const missing = getMissingRequirements(content);
            return (
              <div className="px-5 pb-3 space-y-2">
                {/* Hint text */}
                <p className="text-xs text-muted-foreground leading-relaxed">{guidance.hint}</p>

                {/* Action checklist */}
                {guidance.actions.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {guidance.actions.map((a) => {
                      const isMissing = missing.includes(a);
                      return (
                        <span
                          key={a}
                          className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${!isMissing ? 'bg-muted text-muted-foreground' : ''}`}
                          style={isMissing
                            ? { background: 'hsl(38 90% 50% / 0.1)', color: 'hsl(38 90% 50%)' }
                            : undefined
                          }
                        >
                          {a}
                        </span>
                      );
                    })}
                  </div>
                )}

                {/* Missing requirements */}
                {missing.length > 0 && !missing.every((m) => guidance.actions.includes(m)) && (
                  <div className="flex items-start gap-2">
                    <span className="text-[10px] text-warning/80 shrink-0 mt-px">Pendente:</span>
                    <div className="flex flex-wrap gap-1">
                      {missing.filter((m) => !guidance.actions.includes(m)).map((m) => (
                        <span
                          key={m}
                          className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                          style={{ background: 'hsl(38 90% 50% / 0.1)', color: 'hsl(38 90% 50%)' }}
                        >
                          {m}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Transition buttons */}
          <div
            className="flex items-center justify-between px-5 py-3 border-t border-border"
          >
            {(() => {
              const prev = getPrevTransition(content.status);
              return prev ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleAdvanceStatus(prev.status)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <ChevronLeft className="h-3.5 w-3.5 mr-1" />
                  {prev.label}
                </Button>
              ) : <div />;
            })()}
            {(() => {
              const next = getNextTransition(content.status);
              if (!next) return <span className="text-xs text-success font-semibold">Publicado</span>;
              const blocked = validateTransition(content, next.status);
              return (
                <Button
                  size="sm"
                  onClick={() => handleAdvanceStatus(next.status)}
                  disabled={!!blocked}
                  className="font-semibold"
                  style={blocked
                    ? { opacity: 0.5 }
                    : { background: 'hsl(258 82% 64%)', color: '#fff' }
                  }
                  title={blocked ?? undefined}
                >
                  {next.label}
                  <ChevronRight className="h-3.5 w-3.5 ml-1" />
                </Button>
              );
            })()}
          </div>
        </div>

        {/* Main grid: 3 columns on wide screens */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="glass-card">
            <CardHeader><CardTitle className="text-base font-display">Informações</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Título</Label>
                <Input value={content.title} onChange={(e) => updateField('title', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Tema</Label>
                <Input value={content.theme} onChange={(e) => updateField('theme', e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Plataforma</Label>
                  <Select value={content.platform} onValueChange={(v) => updateField('platform', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(PLATFORM_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Formato</Label>
                  <Select value={content.format} onValueChange={(v) => updateField('format', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(FORMAT_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Objetivo</Label>
                <Input value={content.objective} onChange={(e) => updateField('objective', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Público-alvo</Label>
                <Input value={content.target_audience} onChange={(e) => updateField('target_audience', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>CTA</Label>
                <Input value={content.cta} onChange={(e) => updateField('cta', e.target.value)} />
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader><CardTitle className="text-base font-display">Texto</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Texto base</Label>
                <Textarea
                  value={content.raw_text}
                  onChange={(e) => updateField('raw_text', e.target.value)}
                  className="min-h-[180px] resize-y"
                />
              </div>
              <Button
                onClick={handleOpenAIPanel}
                variant="outline"
                className="w-full border-accent text-accent hover:bg-accent/10"
              >
                <Sparkles className="h-4 w-4 mr-2" />
                Melhorar com IA
              </Button>
              {content.improved_text && (
                <div className="space-y-2">
                  <Label>Texto melhorado pela IA</Label>
                  <Textarea
                    value={content.improved_text}
                    onChange={(e) => updateField('improved_text', e.target.value)}
                    className="min-h-[180px] resize-y bg-accent/5 border-accent/20"
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Right column: Schedule + Design + Meta */}
          <div className="space-y-4">
            {/* Schedule compact */}
            <ScheduleSection
              scheduledDate={content.scheduled_date}
              scheduledTime={content.scheduled_time}
              onDateChange={handleScheduleDateChange}
              onTimeChange={handleScheduleTimeChange}
              currentStatus={content.status}
            />

            {/* Design handoff */}
            <div
              className={`rounded-lg p-4 space-y-3 bg-card border ${content.figma_link ? 'border-accent/20' : 'border-border'}`}
            >
              <p className="text-xs font-semibold text-foreground/70 flex items-center gap-1.5">
                <ExternalLink className="h-3.5 w-3.5 text-accent" />
                Design
              </p>
              <div className="space-y-2">
                <Label className="text-[10px] text-muted-foreground">Link do Figma</Label>
                <div className="flex gap-1.5">
                  <Input
                    value={content.figma_link ?? ''}
                    onChange={(e) => updateField('figma_link', e.target.value || null)}
                    placeholder="https://figma.com/..."
                    className="h-8 text-xs flex-1"
                  />
                  {content.figma_link && (
                    <a href={content.figma_link} target="_blank" rel="noopener noreferrer"
                      className="flex h-8 w-8 items-center justify-center rounded-md border border-border hover:bg-white/5 shrink-0">
                      <ExternalLink className="h-3 w-3 text-info" />
                    </a>
                  )}
                </div>
                {!content.figma_link && ['designing', 'final_review'].includes(content.status) && (
                  <p className="text-[9px] text-warning/60">Adicione o Figma para avançar</p>
                )}
              </div>
            </div>

            {/* Milestones compact */}
            <div
              className="rounded-lg p-4 space-y-2 bg-card border border-border"
            >
              <p className="text-xs font-semibold text-foreground/70">Timeline</p>
              <div className="space-y-1">
                {[
                  { label: 'Criado', date: content.created_at, color: 'hsl(240 5% 50%)' },
                  { label: 'Copy aprovada', date: content.approved_copy_at, color: 'hsl(38 90% 50%)' },
                  { label: 'Design', date: content.design_started_at, color: 'hsl(258 82% 64%)' },
                  { label: 'Aprovado', date: content.final_approved_at, color: 'hsl(142 60% 42%)' },
                  { label: 'Publicado', date: content.published_at, color: 'hsl(0 0% 88%)' },
                ].filter(m => m.date).map((m, i) => (
                  <div key={i} className="flex items-center justify-between text-[10px]">
                    <span className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: m.color }} />
                      <span style={{ color: m.color }}>{m.label}</span>
                    </span>
                    <span className="text-muted-foreground/40">{new Date(m.date!).toLocaleDateString('pt-BR')}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Meta */}
            <div className="text-[9px] text-muted-foreground/40 space-y-0.5 px-1">
              {content.content_type && <p>tipo: {content.content_type}</p>}
              <p>atualizado: {new Date(content.updated_at).toLocaleDateString('pt-BR')}</p>
            </div>
          </div>
        </div>

      </div>

      {/* Carousel generator */}
      {content.format === 'carrossel' && (
        <div
          className="rounded-xl overflow-hidden bg-card border border-border"
        >
          <button
            onClick={() => setCarouselOpen(!carouselOpen)}
            className="flex items-center justify-between w-full px-5 py-3 text-sm font-semibold text-foreground/80 hover:text-foreground transition-colors"
          >
            <span className="flex items-center gap-2">
              <LayoutGrid className="h-4 w-4 text-accent" />
              Roteiro de Carrossel
              {carousel && <span className="text-[9px] text-success font-normal ml-1">({carousel.slides.length} slides)</span>}
            </span>
            <ChevronRight className={`h-4 w-4 transition-transform ${carouselOpen ? 'rotate-90' : ''}`} />
          </button>

          {carouselOpen && (
            <div className="px-5 pb-5 space-y-4 border-t border-border">
              <div className="flex items-center gap-3 pt-3">
                <select
                  value={carouselSlides}
                  onChange={(e) => setCarouselSlides(e.target.value)}
                  className="h-8 rounded-md border border-border bg-background px-2 text-xs"
                >
                  {[3,4,5,6,7,8,9,10].map(n => <option key={n} value={String(n)}>{n} slides</option>)}
                </select>
                <Button
                  size="sm"
                  onClick={handleGenerateCarousel}
                  disabled={carouselLoading}
                  style={{ background: 'hsl(258 82% 64%)', color: '#fff' }}
                >
                  {carouselLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Sparkles className="h-3.5 w-3.5 mr-1" />}
                  {carouselLoading ? 'Gerando...' : 'Gerar roteiro'}
                </Button>
              </div>

              {carousel && (
                <div className="space-y-2">
                  {carousel.slides.map((slide) => {
                    const typeColors: Record<string, string> = {
                      hook: 'hsl(38 90% 50%)', value: 'hsl(217 88% 58%)', proof: 'hsl(142 60% 42%)',
                      transition: 'hsl(258 82% 64%)', cta: 'hsl(0 72% 55%)',
                    };
                    const color = typeColors[slide.type] || 'hsl(240 5% 50%)';
                    return (
                      <div key={slide.position} className="flex gap-3 p-3 rounded-lg bg-secondary">
                        <div className="flex flex-col items-center gap-1 shrink-0 w-10">
                          <div className="flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ background: color }}>
                            {slide.position}
                          </div>
                          <span className="text-[8px] font-semibold uppercase" style={{ color }}>{slide.type}</span>
                        </div>
                        <div className="flex-1 space-y-1">
                          <input
                            value={slide.headline}
                            onChange={(e) => handleUpdateSlide(slide.position, 'headline', e.target.value)}
                            className="w-full text-sm font-medium text-foreground/90 bg-transparent border-0 border-b border-transparent focus:border-accent/30 outline-none px-0 py-0.5"
                          />
                          <input
                            value={slide.body || ''}
                            onChange={(e) => handleUpdateSlide(slide.position, 'body', e.target.value)}
                            placeholder="Texto complementar..."
                            className="w-full text-xs text-foreground/60 bg-transparent border-0 border-b border-transparent focus:border-accent/30 outline-none px-0 py-0.5"
                          />
                          <input
                            value={slide.visual_direction || ''}
                            onChange={(e) => handleUpdateSlide(slide.position, 'visual_direction', e.target.value)}
                            placeholder="Direção visual..."
                            className="w-full text-[10px] text-muted-foreground/50 bg-transparent border-0 border-b border-transparent focus:border-accent/30 outline-none px-0 py-0.5"
                          />
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const text = [slide.headline, slide.body].filter(Boolean).join('\n');
                            navigator.clipboard.writeText(text);
                            toast.success(`Slide ${slide.position} copiado`);
                          }}
                          className="shrink-0 p-1.5 rounded hover:bg-white/10 text-muted-foreground/40 hover:text-foreground transition-colors self-start mt-0.5"
                          title="Copiar texto do slide"
                        >
                          <Copy className="h-3 w-3" />
                        </button>
                      </div>
                    );
                  })}

                  <div className="flex gap-2 mt-2">
                    <Button size="sm" variant="outline" onClick={handleSaveCarousel} className="flex-1 text-xs">
                      <Save className="h-3 w-3 mr-1" />
                      Salvar edições
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs"
                      onClick={() => {
                        if (!carousel) return;
                        const full = carousel.slides.map(s =>
                          `[Slide ${s.position}]\n${s.headline}${s.body ? '\n' + s.body : ''}`
                        ).join('\n\n');
                        navigator.clipboard.writeText(full);
                        toast.success('Roteiro completo copiado');
                      }}
                    >
                      <ClipboardCopy className="h-3 w-3 mr-1" />
                      Copiar tudo
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <AIImprovePanel
        open={aiPanelOpen}
        onOpenChange={setAiPanelOpen}
        originalText={content.raw_text}
        onAccept={(text) => updateField('improved_text', text)}
      />

      <BriefGeneratorPanel
        open={briefPanelOpen}
        onOpenChange={setBriefPanelOpen}
        contentId={content.id}
        contentTitle={content.title}
        defaults={{
          theme: content.theme,
          objective: content.objective,
          platform: content.platform,
          format: content.format,
          targetAudience: content.target_audience,
          rawText: content.raw_text,
        }}
        onBriefCreated={handleBriefCreated}
      />
    </AppLayout>
  );
}
