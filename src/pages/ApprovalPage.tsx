import { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { callAIClaude } from '@/lib/ai';
import { toast } from 'sonner';
import { useContents } from '@/hooks/useContents';
import { AppLayout } from '@/components/AppLayout';
import { ContentStatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  CheckCircle,
  RotateCcw,
  ExternalLink,
  Loader2,
  CalendarDays,
  PenLine,
  Palette,
  Brain,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PLATFORM_LABELS, FORMAT_LABELS } from '@/types';
import { createNotification } from '@/lib/notifications';
import { recordApproval, recordRejection } from '@/lib/brain-memory';
import { auditLog } from '@/lib/audit';
import type { Content, ContentStatus } from '@/types';

type ApprovalLevel = 'copy' | 'final';

const LEVEL_CONFIG: Record<ApprovalLevel, {
  label: string;
  description: string;
  icon: React.ElementType;
  accent: string;
  sourceStatus: ContentStatus;
  approveToStatus: ContentStatus;
  rejectToStatus: ContentStatus;
  approveLabel: string;
  rejectLabel: string;
  approveMsg: string;
}> = {
  copy: {
    label: 'Aprovação de Copy',
    description: 'Revisar texto e aprovar copy para enviar ao design',
    icon: PenLine,
    accent: 'hsl(217 88% 58%)',
    sourceStatus: 'copy_review',
    approveToStatus: 'copy_approved',
    rejectToStatus: 'writing',
    approveLabel: 'Aprovar Copy',
    rejectLabel: 'Devolver para Escrita',
    approveMsg: 'Copy aprovada!',
  },
  final: {
    label: 'Aprovação Final',
    description: 'Revisar texto + peça visual e aprovar para publicação',
    icon: Palette,
    accent: 'hsl(142 60% 42%)',
    sourceStatus: 'final_review',
    approveToStatus: 'approved',
    rejectToStatus: 'designing',
    approveLabel: 'Aprovar Final',
    rejectLabel: 'Devolver para Design',
    approveMsg: 'Conteúdo aprovado!',
  },
};

export default function ApprovalPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [activeLevel, setActiveLevel] = useState<ApprovalLevel>('copy');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [feedbackId, setFeedbackId] = useState<string | null>(null);
  const [feedbackText, setFeedbackText] = useState('');
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [reviews, setReviews] = useState<Record<string, { alignment_score: number; verdict: string; strengths: string[]; issues: string[]; suggestions: string[]; summary: string }>>({});

  const { data: rawContents = [], isLoading } = useContents();
  const allContents = useMemo(() => rawContents.filter(c => c.status === 'copy_review' || c.status === 'final_review'), [rawContents]);

  const config = LEVEL_CONFIG[activeLevel];
  const contents = useMemo(
    () => allContents.filter((c) => c.status === config.sourceStatus),
    [allContents, config.sourceStatus],
  );

  const copyCount = allContents.filter((c) => c.status === 'copy_review').length;
  const finalCount = allContents.filter((c) => c.status === 'final_review').length;

  const handleBrainReview = useCallback(async (content: Content) => {
    setReviewingId(content.id);
    try {
      const result = await callAIClaude<{ review: { alignment_score: number; verdict: string; strengths: string[]; issues: string[]; suggestions: string[]; summary: string } }>('brain-review', {
        text: content.improved_text || content.raw_text,
        title: content.title,
        cta: content.cta,
        platform: content.platform,
        format: content.format,
      });
      setReviews(prev => ({ ...prev, [content.id]: result.review }));
    } catch (e: any) {
      toast.error(e.message || 'Erro na revisão com IA');
    } finally {
      setReviewingId(null);
    }
  }, []);

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['contents'] });
  };

  const handleApprove = useCallback(async (content: Content) => {
    setProcessingId(content.id);
    try {
      const { error } = await supabase
        .from('contents')
        .update({ status: config.approveToStatus, updated_at: new Date().toISOString() })
        .eq('id', content.id);
      if (error) {
        const msg = error.message?.includes('RAISE') ? error.message.replace(/.*RAISE.*: /, '') : error.message;
        throw new Error(msg);
      }

      if (content.assigned_to && content.assigned_to !== user?.id) {
        await createNotification(content.assigned_to, content.id, `"${content.title}" — ${config.approveMsg}`);
      }
      if (content.created_by !== user?.id) {
        await createNotification(content.created_by, content.id, `"${content.title}" — ${config.approveMsg}`);
      }

      invalidateAll();
      if (user?.id) {
        recordApproval(content, user.id);
        auditLog('approve', 'content', content.id, user.id, { level: activeLevel, title: content.title, from: content.status, to: config.approveToStatus });
      }
      toast.success(config.approveMsg);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao aprovar');
    } finally {
      setProcessingId(null);
    }
  }, [config, queryClient, user?.id]);

  const handleReject = useCallback(async (content: Content) => {
    if (!feedbackText.trim()) {
      toast.error('Escreva o feedback antes de devolver.');
      return;
    }
    setProcessingId(content.id);
    try {
      const { error } = await supabase
        .from('contents')
        .update({ status: config.rejectToStatus, updated_at: new Date().toISOString() })
        .eq('id', content.id);
      if (error) {
        const msg = error.message?.includes('RAISE') ? error.message.replace(/.*RAISE.*: /, '') : error.message;
        throw new Error(msg);
      }

      const target = activeLevel === 'copy' ? content.created_by : content.assigned_to;
      if (target && target !== user?.id) {
        await createNotification(
          target,
          content.id,
          `Ajuste em "${content.title}": ${feedbackText}`,
        );
      }

      invalidateAll();
      if (user?.id) {
        recordRejection(content, feedbackText, user.id);
        auditLog('reject', 'content', content.id, user.id, { level: activeLevel, title: content.title, feedback: feedbackText.slice(0, 200) });
      }
      setFeedbackId(null);
      setFeedbackText('');
      toast.success('Feedback enviado');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao devolver');
    } finally {
      setProcessingId(null);
    }
  }, [feedbackText, config, activeLevel, queryClient, user?.id]);

  return (
    <AppLayout>
      <div className="space-y-5 animate-fade-in">
        {/* Header */}
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Aprovação</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Aprovar copy estratégica e peça visual final
          </p>
        </div>

        {/* Level tabs */}
        <div
          className="flex items-center gap-1 rounded-xl p-1 bg-card border border-border"
        >
          {([
            { id: 'copy' as const, icon: PenLine, label: 'Copy', count: copyCount, accent: LEVEL_CONFIG.copy.accent },
            { id: 'final' as const, icon: Palette, label: 'Final', count: finalCount, accent: LEVEL_CONFIG.final.accent },
          ]).map(({ id, icon: Icon, label, count, accent }) => (
            <button
              key={id}
              onClick={() => { setActiveLevel(id); setFeedbackId(null); setFeedbackText(''); }}
              className="flex items-center gap-2 flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all"
              style={{
                background: activeLevel === id ? `${accent}15` : 'transparent',
                color: activeLevel === id ? accent : 'hsl(240 5% 50%)',
                borderLeft: activeLevel === id ? `3px solid ${accent}` : '3px solid transparent',
              }}
            >
              <Icon className="h-4 w-4" />
              <span>{label}</span>
              {count > 0 && (
                <Badge
                  className="ml-auto text-[10px] font-bold"
                  style={{ background: `${accent}20`, color: accent, border: 'none' }}
                >
                  {count}
                </Badge>
              )}
            </button>
          ))}
        </div>

        {/* Level description */}
        <p className="text-xs text-muted-foreground px-1">{config.description}</p>

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : contents.length === 0 ? (
          <div
            className="rounded-xl p-12 text-center bg-card border border-border"
          >
            <CheckCircle className="h-10 w-10 mx-auto mb-3" style={{ color: `${config.accent}30` }} />
            <p className="text-sm text-muted-foreground">
              Nenhum conteúdo pendente de {activeLevel === 'copy' ? 'revisão de copy' : 'aprovação final'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {contents.map((c) => (
              <div
                key={c.id}
                className="rounded-xl overflow-hidden bg-card border border-border"
              >
                {/* Card header */}
                <div
                  className="flex items-start justify-between px-5 py-4 cursor-pointer hover:bg-white/[0.02] transition-colors border-b border-border"
                  onClick={() => navigate(`/contents/${c.id}`)}
                >
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold text-foreground/90 truncate">{c.title}</h3>
                    <div className="flex items-center gap-2 mt-1.5 text-[11px] text-muted-foreground">
                      <span>{PLATFORM_LABELS[c.platform]}</span>
                      <span className="text-muted-foreground/40">·</span>
                      <span>{FORMAT_LABELS[c.format as keyof typeof FORMAT_LABELS]}</span>
                      {c.profiles?.name && (
                        <>
                          <span className="text-muted-foreground/40">·</span>
                          <span>{c.profiles.name}</span>
                        </>
                      )}
                    </div>
                    {c.scheduled_datetime && (
                      <div className="flex items-center gap-1 mt-1.5 text-[10px] text-accent">
                        <CalendarDays className="h-3 w-3" />
                        {format(parseISO(c.scheduled_datetime), "dd MMM · HH:mm", { locale: ptBR })}
                      </div>
                    )}
                  </div>
                  <ContentStatusBadge status={c.status} />
                </div>

                {/* Body: text preview + figma (final only) */}
                <div className="px-5 py-4 space-y-3">
                  {/* Text preview — always shown */}
                  {(c.improved_text || c.raw_text) && (
                    <div>
                      <span className="text-[9px] uppercase tracking-wider text-muted-foreground/60 font-semibold">
                        {c.improved_text ? 'Texto final' : 'Texto base'}
                      </span>
                      <p className="text-xs text-foreground/70 mt-1 leading-relaxed line-clamp-5 whitespace-pre-line">
                        {c.improved_text || c.raw_text}
                      </p>
                    </div>
                  )}

                  {/* CTA */}
                  {c.cta && (
                    <div>
                      <span className="text-[9px] uppercase tracking-wider text-muted-foreground/60 font-semibold">CTA</span>
                      <p className="text-xs text-foreground/70 mt-0.5">{c.cta}</p>
                    </div>
                  )}

                  {/* Figma link — prominent for final review */}
                  {activeLevel === 'final' && c.figma_link && (
                    <a
                      href={c.figma_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium text-white transition-colors"
                      style={{ background: 'hsl(258 82% 64%)', boxShadow: '0 0 12px hsl(258 82% 64% / 0.2)' }}
                    >
                      <ExternalLink className="h-4 w-4" />
                      Abrir peça no Figma
                    </a>
                  )}

                  {activeLevel === 'final' && !c.figma_link && (
                    <div
                      className="flex items-center gap-2 py-2 px-3 rounded-lg text-xs"
                      style={{ background: 'hsl(38 90% 50% / 0.08)', border: '1px solid hsl(38 90% 50% / 0.2)' }}
                    >
                      <ExternalLink className="h-3.5 w-3.5 text-warning" />
                      <span className="text-warning/80">Sem link do Figma — peça visual não anexada</span>
                    </div>
                  )}
                </div>

                {/* Brain review result */}
                {reviews[c.id] && (() => {
                  const r = reviews[c.id];
                  const scoreColor = r.alignment_score >= 80 ? 'hsl(142 60% 42%)' : r.alignment_score >= 50 ? 'hsl(38 90% 50%)' : 'hsl(0 72% 51%)';
                  const verdictLabel = r.verdict === 'approved' ? 'Aprovado pela IA' : r.verdict === 'needs_revision' ? 'Precisa de ajustes' : 'Reprovado';
                  return (
                    <div className="px-5 py-3 space-y-2 border-t border-border" style={{ background: 'hsl(258 82% 64% / 0.03)' }}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Brain className="h-3.5 w-3.5 text-accent" />
                          <span className="text-[10px] font-semibold text-accent">Revisão do Cérebro</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-bold" style={{ color: scoreColor }}>{r.alignment_score}</span>
                          <span className="text-[9px] text-muted-foreground">/100</span>
                          <Badge className="text-[8px]" style={{ background: `${scoreColor}15`, color: scoreColor, border: 'none' }}>
                            {verdictLabel}
                          </Badge>
                        </div>
                      </div>
                      <p className="text-[11px] text-foreground/70">{r.summary}</p>
                      {r.strengths.length > 0 && (
                        <div>
                          <span className="text-[9px] uppercase tracking-wider text-success/70 font-semibold">Pontos fortes</span>
                          {r.strengths.map((s, i) => (
                            <p key={i} className="text-[10px] text-foreground/60 flex gap-1.5"><span className="text-success shrink-0">+</span>{s}</p>
                          ))}
                        </div>
                      )}
                      {r.issues.length > 0 && (
                        <div>
                          <span className="text-[9px] uppercase tracking-wider text-destructive/70 font-semibold">Problemas</span>
                          {r.issues.map((s, i) => (
                            <p key={i} className="text-[10px] text-foreground/60 flex gap-1.5"><span className="text-destructive shrink-0">!</span>{s}</p>
                          ))}
                        </div>
                      )}
                      {r.suggestions.length > 0 && (
                        <div>
                          <span className="text-[9px] uppercase tracking-wider text-info/70 font-semibold">Sugestões</span>
                          {r.suggestions.map((s, i) => (
                            <p key={i} className="text-[10px] text-foreground/60 flex gap-1.5"><span className="text-info shrink-0">→</span>{s}</p>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Actions */}
                <div
                  className="px-5 py-3 flex items-center gap-2 border-t border-border"
                >
                  <Button
                    size="sm"
                    onClick={() => handleBrainReview(c)}
                    disabled={reviewingId === c.id}
                    variant="outline"
                    className="text-accent border-accent/30"
                  >
                    {reviewingId === c.id ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Brain className="h-3.5 w-3.5 mr-1" />}
                    {reviewingId === c.id ? 'Analisando...' : 'Revisar com IA'}
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleApprove(c)}
                    disabled={processingId === c.id}
                    className="flex-1 font-semibold"
                    style={{ background: config.accent, color: '#fff' }}
                  >
                    {processingId === c.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                    ) : (
                      <CheckCircle className="h-3.5 w-3.5 mr-1.5" />
                    )}
                    {config.approveLabel}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setFeedbackId(feedbackId === c.id ? null : c.id)}
                    disabled={processingId === c.id}
                  >
                    <RotateCcw className="h-3.5 w-3.5 mr-1" />
                    {config.rejectLabel}
                  </Button>
                </div>

                {/* Feedback input */}
                {feedbackId === c.id && (
                  <div className="px-5 pb-4 space-y-2">
                    <Textarea
                      placeholder={activeLevel === 'copy'
                        ? 'O que precisa ser ajustado no texto?'
                        : 'Descreva o ajuste visual necessário...'
                      }
                      value={feedbackText}
                      onChange={(e) => setFeedbackText(e.target.value)}
                      className="min-h-[80px] text-xs resize-none"
                    />
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => { setFeedbackId(null); setFeedbackText(''); }}
                      >
                        Cancelar
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleReject(c)}
                        disabled={processingId === c.id || !feedbackText.trim()}
                        className="bg-warning/90 text-white hover:bg-warning"
                      >
                        Enviar Feedback
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
