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
import { Sparkles, Save, ArrowLeft, PenTool } from 'lucide-react';
import { toast } from 'sonner';
import { PLATFORM_LABELS, FORMAT_LABELS, STATUS_LABELS, STATUSES_REQUIRING_SCHEDULE } from '@/types';
import type { Content, ContentStatus } from '@/types';

export default function ContentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [content, setContent] = useState<Content | null>(null);
  const [loading, setLoading] = useState(false);
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [briefPanelOpen, setBriefPanelOpen] = useState(false);

  useEffect(() => {
    if (id) fetchContent();
  }, [id]);

  const fetchContent = async () => {
    const { data } = await supabase.from('contents').select('*').eq('id', id!).single();
    if (data) setContent(data as Content);
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

    // Validate scheduling for terminal statuses
    if (STATUSES_REQUIRING_SCHEDULE.includes(content.status) && (!content.scheduled_date || !content.scheduled_time)) {
      toast.error('Defina data e horário da postagem antes de concluir este conteúdo.');
      return;
    }

    setLoading(true);
    const { id: _id, created_at, created_by, profiles, ...updateData } = content;
    const { error } = await supabase.from('contents').update(updateData).eq('id', content.id);
    if (error) {
      toast.error('Erro ao salvar.');
    } else {
      toast.success('Conteúdo atualizado!');
    }
    setLoading(false);
  };

  const handleOpenAIPanel = () => {
    if (!content?.raw_text?.trim()) {
      toast.error('Escreva um texto base primeiro.');
      return;
    }
    setAiPanelOpen(true);
  };

  const handleStatusChange = (newStatus: string) => {
    if (STATUSES_REQUIRING_SCHEDULE.includes(newStatus as ContentStatus) && (!content?.scheduled_date || !content?.scheduled_time)) {
      toast.error('Defina data e horário da postagem antes de alterar para este status.');
      return;
    }
    updateField('status', newStatus);
  };

  const handleBriefCreated = () => {
    setContent((prev) => prev ? { ...prev, status: 'aguardando_design' as ContentStatus } : null);
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

  const showScheduleWarning = STATUSES_REQUIRING_SCHEDULE.includes(content.status) ||
    content.status === 'em_design' || content.status === 'aguardando_design';

  return (
    <AppLayout>
      <div className="max-w-4xl space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/contents')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="font-display text-2xl font-bold">{content.title}</h1>
              <div className="flex items-center gap-2 mt-1">
                <ContentStatusBadge status={content.status} />
                <span className="text-sm text-muted-foreground">
                  {PLATFORM_LABELS[content.platform]} · {FORMAT_LABELS[content.format as keyof typeof FORMAT_LABELS]}
                </span>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => setBriefPanelOpen(true)}
              variant="outline"
              className="border-accent text-accent hover:bg-accent/10"
            >
              <PenTool className="h-4 w-4 mr-2" />
              Gerar Brief
            </Button>
            <Button onClick={handleSave} disabled={loading} className="bg-accent text-accent-foreground hover:bg-accent/90">
              <Save className="h-4 w-4 mr-2" />
              {loading ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </div>

        {/* Schedule section - prominent */}
        <ScheduleSection
          scheduledDate={content.scheduled_date}
          scheduledTime={content.scheduled_time}
          onDateChange={handleScheduleDateChange}
          onTimeChange={handleScheduleTimeChange}
          currentStatus={content.status}
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={content.status} onValueChange={handleStatusChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
        </div>
      </div>

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
