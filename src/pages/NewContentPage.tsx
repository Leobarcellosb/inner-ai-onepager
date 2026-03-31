import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/AppLayout';
import { AIImprovePanel } from '@/components/AIImprovePanel';
import { ScheduleSection } from '@/components/ScheduleSection';
import { ReferenceSelector } from '@/components/ReferenceSelector';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Sparkles, Save, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { PLATFORM_LABELS, FORMAT_LABELS, STATUS_LABELS, STATUSES_REQUIRING_SCHEDULE } from '@/types';
import type { ContentPlatform, ContentFormat, ContentStatus } from '@/types';

export default function NewContentPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [selectedRefId, setSelectedRefId] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: '',
    theme: '',
    platform: 'instagram' as ContentPlatform,
    format: 'post_estatico' as ContentFormat,
    objective: '',
    target_audience: '',
    funnel_stage: '',
    raw_text: '',
    improved_text: '',
    cta: '',
    status: 'rascunho' as ContentStatus,
    scheduled_date: null as string | null,
    scheduled_time: null as string | null,
    scheduled_datetime: null as string | null,
    posting_timezone: 'America/Sao_Paulo',
  });

  const updateField = (field: string, value: string | null) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const computeScheduledDatetime = (date: string | null, time: string | null): string | null => {
    if (!date || !time) return null;
    return `${date}T${time}:00`;
  };

  const handleScheduleDateChange = (date: string | null) => {
    setForm((prev) => ({
      ...prev,
      scheduled_date: date,
      scheduled_datetime: computeScheduledDatetime(date, prev.scheduled_time),
    }));
  };

  const handleScheduleTimeChange = (time: string | null) => {
    setForm((prev) => ({
      ...prev,
      scheduled_time: time,
      scheduled_datetime: computeScheduledDatetime(prev.scheduled_date, time),
    }));
  };

  const handleStatusChange = (newStatus: string) => {
    if (STATUSES_REQUIRING_SCHEDULE.includes(newStatus as ContentStatus) && (!form.scheduled_date || !form.scheduled_time)) {
      toast.error('Defina data e horário da postagem antes de alterar para este status.');
      return;
    }
    updateField('status', newStatus);
  };

  const handleOpenAIPanel = () => {
    if (!form.raw_text.trim()) {
      toast.error('Escreva um texto base primeiro.');
      return;
    }
    setAiPanelOpen(true);
  };

  const handleReferenceSelect = (refId: string | null, analysis: any) => {
    setSelectedRefId(refId);
    if (analysis) {
      // Pre-fill strategic direction from analysis
      setForm(prev => ({
        ...prev,
        objective: prev.objective || analysis.probable_objective || '',
        target_audience: prev.target_audience || analysis.probable_audience || '',
      }));
    }
  };

  const handleSave = async () => {
    if (!form.title.trim()) {
      toast.error('Título é obrigatório.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.from('contents').insert({
      ...form,
      created_by: user!.id,
    });

    if (error) {
      const msg = error.message?.includes('RAISE') ? error.message.replace(/.*RAISE.*: /, '') : error.message;
      toast.error(msg || 'Erro ao salvar conteúdo.');
    } else {
      toast.success('Conteúdo salvo!');
      navigate('/contents');
    }
    setLoading(false);
  };

  return (
    <AppLayout>
      <div className="max-w-4xl space-y-6 animate-fade-in">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/contents')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="font-display text-2xl font-bold">Novo Conteúdo</h1>
            <p className="text-sm text-muted-foreground">Crie um novo conteúdo para a marca</p>
          </div>
        </div>

        {/* Reference selector - strategic base */}
        <ReferenceSelector selectedReferenceId={selectedRefId} onSelect={handleReferenceSelect} />

        {/* Schedule section - prominent */}
        <ScheduleSection
          scheduledDate={form.scheduled_date}
          scheduledTime={form.scheduled_time}
          onDateChange={handleScheduleDateChange}
          onTimeChange={handleScheduleTimeChange}
          currentStatus={form.status}
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-base font-display">Informações</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Título *</Label>
                <Input value={form.title} onChange={(e) => updateField('title', e.target.value)} placeholder="Título do conteúdo" />
              </div>
              <div className="space-y-2">
                <Label>Tema</Label>
                <Input value={form.theme} onChange={(e) => updateField('theme', e.target.value)} placeholder="Ex: Produtividade com IA" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Plataforma</Label>
                  <Select value={form.platform} onValueChange={(v) => updateField('platform', v)}>
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
                  <Select value={form.format} onValueChange={(v) => updateField('format', v)}>
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
                <Input value={form.objective} onChange={(e) => updateField('objective', e.target.value)} placeholder="Objetivo do conteúdo" />
              </div>
              <div className="space-y-2">
                <Label>Público-alvo</Label>
                <Input value={form.target_audience} onChange={(e) => updateField('target_audience', e.target.value)} placeholder="Público-alvo" />
              </div>
              <div className="space-y-2">
                <Label>CTA</Label>
                <Input value={form.cta} onChange={(e) => updateField('cta', e.target.value)} placeholder="Call to action" />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={handleStatusChange}>
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
            <CardHeader>
              <CardTitle className="text-base font-display">Texto</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Texto base</Label>
                <Textarea
                  value={form.raw_text}
                  onChange={(e) => updateField('raw_text', e.target.value)}
                  placeholder="Escreva o texto base do conteúdo..."
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
              {form.improved_text && (
                <div className="space-y-2">
                  <Label>Texto melhorado pela IA</Label>
                  <Textarea
                    value={form.improved_text}
                    onChange={(e) => updateField('improved_text', e.target.value)}
                    className="min-h-[180px] resize-y bg-accent/5 border-accent/20"
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => navigate('/contents')}>Cancelar</Button>
          <Button onClick={handleSave} disabled={loading} className="bg-accent text-accent-foreground hover:bg-accent/90">
            <Save className="h-4 w-4 mr-2" />
            {loading ? 'Salvando...' : 'Salvar Conteúdo'}
          </Button>
        </div>
      </div>

      <AIImprovePanel
        open={aiPanelOpen}
        onOpenChange={setAiPanelOpen}
        originalText={form.raw_text}
        onAccept={(text) => updateField('improved_text', text)}
      />
    </AppLayout>
  );
}
