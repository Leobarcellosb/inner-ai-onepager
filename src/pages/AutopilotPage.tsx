import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Zap, Loader2, Check, Shield, Pencil, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { PLATFORM_LABELS, FORMAT_LABELS } from '@/types';
import { ensureScheduledDate, ensureScheduledTime } from '@/lib/pipeline';

const SURFACE = 'hsl(240 13% 7%)';
const BORDER = 'hsl(240 11% 13%)';

interface GeneratedItem {
  title: string;
  hook: string;
  full_text: string;
  cta: string;
  format: string;
  platform: string;
  pillar: string;
  priority: string;
  date: string;
  time: string;
  _selected: boolean;
  _editing: boolean;
}

export default function AutopilotPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [count, setCount] = useState('5');
  const [autoApprove, setAutoApprove] = useState(false);
  const [step, setStep] = useState<'config' | 'review' | 'done'>('config');
  const [running, setRunning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState<GeneratedItem[]>([]);
  const [savedCount, setSavedCount] = useState(0);

  const handleGenerate = async () => {
    setRunning(true);
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 1);

      const { data, error } = await supabase.functions.invoke('autopilot', {
        body: {
          count: parseInt(count),
          start_date: startDate.toISOString().slice(0, 10),
          auto_approve: false, // Never auto-insert — we review first
          dry_run: true,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      // If the function inserted (old behavior), show result directly
      if (data?.created > 0) {
        queryClient.invalidateQueries({ queryKey: ['contents'] });
        setSavedCount(data.created);
        setStep('done');
        toast.success(`${data.created} conteúdos criados`);
        return;
      }

      // New behavior: items returned for review
      const generated = (data?.items ?? data?.plan ?? []).map((item: Record<string, string>) => ({
        ...item,
        _selected: true,
        _editing: false,
      }));

      if (generated.length === 0) {
        toast.error('Nenhum conteúdo gerado.');
        return;
      }

      setItems(generated);
      setStep('review');
      toast.success(`${generated.length} conteúdos gerados — revise antes de salvar`);
    } catch (e: any) {
      toast.error(e.message || 'Erro no autopilot');
    } finally {
      setRunning(false);
    }
  };

  const toggleItem = (idx: number) => {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, _selected: !item._selected } : item));
  };

  const toggleEdit = (idx: number) => {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, _editing: !item._editing } : item));
  };

  const updateItem = (idx: number, field: string, value: string) => {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  };

  const removeItem = (idx: number) => {
    setItems(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    if (!user) return;
    const selected = items.filter(i => i._selected);
    if (selected.length === 0) { toast.error('Selecione pelo menos 1 item.'); return; }
    setSaving(true);

    try {
      const validPlatforms = new Set(Object.keys(PLATFORM_LABELS));
      const validFormats = new Set(Object.keys(FORMAT_LABELS));
      const status = autoApprove ? 'copy_approved' as const : 'writing' as const;

      const records = selected.map(item => ({
        title: item.title,
        theme: item.pillar || '',
        platform: validPlatforms.has(item.platform) ? item.platform : 'instagram',
        format: validFormats.has(item.format) ? item.format : 'post_estatico',
        objective: '',
        raw_text: item.full_text || item.hook || '',
        cta: item.cta || '',
        created_by: user.id,
        status,
        priority: (['low','medium','high','urgent'].includes(item.priority) ? item.priority : 'medium') as 'low'|'medium'|'high'|'urgent',
        content_type: item.format || 'post',
        scheduled_date: ensureScheduledDate(item.date),
        scheduled_time: ensureScheduledTime(item.time),
        source_origin: 'autopilot',
        copy_auto_approved: autoApprove,
        copy_auto_approved_by: autoApprove ? user.id : null,
        copy_auto_approved_at: autoApprove ? new Date().toISOString() : null,
      }));

      const { error } = await supabase.from('contents').insert(records);
      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['contents'] });
      setSavedCount(records.length);
      setStep('done');
      toast.success(`${records.length} conteúdos salvos no Pipeline`);
    } catch (e: any) {
      toast.error(e.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const selectedCount = items.filter(i => i._selected).length;

  return (
    <AppLayout>
      <div className="max-w-3xl space-y-6 animate-fade-in">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight flex items-center gap-2">
            <Zap className="h-6 w-6 text-warning" />
            Autopilot
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gera conteúdos completos com IA — revise antes de enviar para o pipeline
          </p>
        </div>

        {/* STEP 1: Config */}
        {step === 'config' && (
          <div className="space-y-4">
            <div className="rounded-xl p-5 space-y-4" style={{ background: SURFACE, border: `1px solid ${BORDER}` }}>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">Quantidade</label>
                  <Select value={count} onValueChange={setCount}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="3">3 conteúdos</SelectItem>
                      <SelectItem value="5">5 conteúdos</SelectItem>
                      <SelectItem value="7">7 (1 semana)</SelectItem>
                      <SelectItem value="10">10 conteúdos</SelectItem>
                      <SelectItem value="14">14 (2 semanas)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">Ao salvar</label>
                  <div className="flex gap-2">
                    <button onClick={() => setAutoApprove(false)}
                      className="flex-1 flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all"
                      style={{ background: !autoApprove ? 'hsl(217 88% 58% / 0.12)' : 'transparent', color: !autoApprove ? 'hsl(217 88% 58%)' : 'hsl(240 5% 50%)', border: `1px solid ${!autoApprove ? 'hsl(217 88% 58% / 0.3)' : BORDER}` }}>
                      <Shield className="h-3.5 w-3.5" />Com revisão
                    </button>
                    <button onClick={() => setAutoApprove(true)}
                      className="flex-1 flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all"
                      style={{ background: autoApprove ? 'hsl(38 90% 50% / 0.12)' : 'transparent', color: autoApprove ? 'hsl(38 90% 50%)' : 'hsl(240 5% 50%)', border: `1px solid ${autoApprove ? 'hsl(38 90% 50% / 0.3)' : BORDER}` }}>
                      <Zap className="h-3.5 w-3.5" />Auto-aprovar
                    </button>
                  </div>
                </div>
              </div>

              <p className="text-[10px] text-muted-foreground/70 px-1">
                {autoApprove ? 'Copy auto-aprovada — itens entram direto na fila de design.' : 'Itens entram como "Escrita" — o time revisa a copy antes do design.'}
              </p>

              <Button onClick={handleGenerate} disabled={running} className="w-full font-semibold" style={{ background: 'hsl(38 90% 50%)', color: '#000' }}>
                {running ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Zap className="h-4 w-4 mr-2" />}
                {running ? 'Gerando...' : `Gerar ${count} conteúdos`}
              </Button>
            </div>

            <div className="rounded-xl p-5 space-y-3" style={{ background: SURFACE, border: `1px solid ${BORDER}` }}>
              <h3 className="text-xs font-semibold text-foreground/70">Como funciona</h3>
              <div className="space-y-2 text-[11px] text-muted-foreground">
                <p>1. O autopilot lê o <strong>Cérebro da Marca</strong></p>
                <p>2. Gera conteúdos completos com texto, CTA, formato e data</p>
                <p>3. Você <strong>revisa, edita ou descarta</strong> cada item</p>
                <p>4. Só depois de aprovar, os itens entram no pipeline</p>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: Review */}
        {step === 'review' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{selectedCount}/{items.length} selecionados</span>
              <Button variant="ghost" size="sm" onClick={() => setStep('config')} className="text-xs">Voltar</Button>
            </div>

            <div className="space-y-2">
              {items.map((item, i) => (
                <div key={i} className="rounded-xl overflow-hidden transition-all"
                  style={{ background: SURFACE, border: `1px solid ${BORDER}`, opacity: item._selected ? 1 : 0.4 }}>
                  <div className="flex items-start gap-3 px-4 py-3">
                    <button onClick={() => toggleItem(i)} className="mt-1 shrink-0 flex h-5 w-5 items-center justify-center rounded border transition-colors"
                      style={{ borderColor: item._selected ? 'hsl(142 60% 42%)' : BORDER, background: item._selected ? 'hsl(142 60% 42%)' : 'transparent' }}>
                      {item._selected && <Check className="h-3 w-3 text-white" />}
                    </button>

                    <div className="flex-1 min-w-0 space-y-1">
                      <p className="text-sm font-medium text-foreground/90">{item.title}</p>
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                        <span>{item.date} {item.time}</span>
                        <span className="text-muted-foreground/30">·</span>
                        <span>{PLATFORM_LABELS[item.platform as keyof typeof PLATFORM_LABELS] ?? item.platform}</span>
                        <span className="text-muted-foreground/30">·</span>
                        <span>{FORMAT_LABELS[item.format as keyof typeof FORMAT_LABELS] ?? item.format}</span>
                        {item.pillar && <Badge variant="outline" className="text-[8px]">{item.pillar}</Badge>}
                      </div>
                      {!item._editing && item.full_text && (
                        <p className="text-[11px] text-foreground/60 line-clamp-3 leading-relaxed whitespace-pre-line">{item.full_text}</p>
                      )}
                      {!item._editing && item.cta && (
                        <p className="text-[10px] text-accent font-medium">CTA: {item.cta}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => toggleEdit(i)} className="p-1 rounded hover:bg-white/5 text-muted-foreground hover:text-foreground">
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button onClick={() => removeItem(i)} className="p-1 rounded hover:bg-white/5 text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>

                  {item._editing && (
                    <div className="px-4 pb-3 space-y-2" style={{ borderTop: `1px solid ${BORDER}` }}>
                      <div className="space-y-1 pt-2">
                        <label className="text-[9px] text-muted-foreground">Texto completo</label>
                        <Textarea value={item.full_text} onChange={(e) => updateItem(i, 'full_text', e.target.value)}
                          className="min-h-[100px] text-xs resize-y" />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="text-[9px] text-muted-foreground">CTA</label>
                          <input value={item.cta} onChange={(e) => updateItem(i, 'cta', e.target.value)}
                            className="h-7 w-full text-xs rounded-md border border-border bg-background px-2" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] text-muted-foreground">Título</label>
                          <input value={item.title} onChange={(e) => updateItem(i, 'title', e.target.value)}
                            className="h-7 w-full text-xs rounded-md border border-border bg-background px-2" />
                        </div>
                      </div>
                      <button onClick={() => toggleEdit(i)} className="text-[9px] text-accent hover:underline">Fechar edição</button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <Button onClick={handleSave} disabled={saving || selectedCount === 0} className="w-full font-semibold"
              style={{ background: 'hsl(142 60% 42%)', color: '#fff' }}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
              {saving ? 'Salvando...' : `Salvar ${selectedCount} conteúdo${selectedCount !== 1 ? 's' : ''} no Pipeline`}
            </Button>
          </div>
        )}

        {/* STEP 3: Done */}
        {step === 'done' && (
          <div className="rounded-xl p-12 text-center" style={{ background: SURFACE, border: `1px solid ${BORDER}` }}>
            <Check className="h-12 w-12 text-success mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-foreground mb-2">{savedCount} conteúdos criados</h2>
            <p className="text-sm text-muted-foreground mb-6">
              {autoApprove ? 'Conteúdos na fila de design — prontos para produção visual.' : 'Conteúdos em escrita — prontos para revisão da copy.'}
            </p>
            <div className="flex gap-3 justify-center">
              <Button onClick={() => navigate('/pipeline')} style={{ background: 'hsl(258 82% 64%)', color: '#fff' }}>Pipeline</Button>
              <Button variant="outline" onClick={() => navigate('/calendar')}>Calendário</Button>
              <Button variant="ghost" onClick={() => { setStep('config'); setItems([]); }}>Gerar mais</Button>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
