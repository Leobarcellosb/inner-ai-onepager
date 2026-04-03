import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PenTool, Sparkles, Brain } from 'lucide-react';
import { toast } from 'sonner';
import { generateBriefWithAI } from '@/lib/ai';
import { PLATFORM_LABELS, FORMAT_LABELS } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import type { ContentPlatform, ContentFormat, ContentStatus } from '@/types';

interface BriefGeneratorPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contentId: string;
  contentTitle: string;
  defaults: {
    theme: string;
    objective: string;
    platform: string;
    format: string;
    targetAudience: string;
    rawText: string;
  };
  onBriefCreated: () => void;
}

interface ReferenceForBrief {
  id: string;
  title: string;
  analysis: any;
}

export function BriefGeneratorPanel({
  open,
  onOpenChange,
  contentId,
  contentTitle,
  defaults,
  onBriefCreated,
}: BriefGeneratorPanelProps) {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [notes, setNotes] = useState('');
  const [form, setForm] = useState(defaults);
  const [analyzedRefs, setAnalyzedRefs] = useState<ReferenceForBrief[]>([]);
  const [selectedRefId, setSelectedRefId] = useState<string | null>(null);
  const [selectedAnalysis, setSelectedAnalysis] = useState<any>(null);

  useEffect(() => {
    supabase.from('references')
      .select('id, title, reference_analyses(analysis_summary, copy_structure, visual_hierarchy, visual_composition, observed_color_pattern, persuasion_mechanisms, adaptation_for_inner_ai, inspired_generation_prompt)')
      .eq('analysis_status', 'analisado')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (data) {
          setAnalyzedRefs(data.map((r: any) => ({ id: r.id, title: r.title, analysis: r.reference_analyses?.[0] })).filter((r: any) => r.analysis));
        }
      });
  }, [open]);

  const handleRefSelect = (refId: string) => {
    if (refId === 'none') { setSelectedRefId(null); setSelectedAnalysis(null); return; }
    const ref = analyzedRefs.find(r => r.id === refId);
    setSelectedRefId(refId);
    setSelectedAnalysis(ref?.analysis || null);
  };

  const updateForm = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleGenerate = async () => {
    if (!form.theme.trim()) {
      toast.error('Informe o tema do conteúdo.');
      return;
    }
    setLoading(true);
    try {
      const briefData = await generateBriefWithAI({
        theme: form.theme,
        objective: form.objective,
        platform: form.platform,
        format: form.format,
        targetAudience: form.targetAudience,
        rawText: form.rawText,
        notes,
        referenceAnalysis: selectedAnalysis || undefined,
      });

      const { data: { user: authUser }, error: authErr } = await supabase.auth.getUser();
      if (!authUser) { toast.error('Usuário não autenticado.'); return; }

      const briefPayload = {
        content_id: contentId,
        brief_title: `Brief: ${contentTitle}`,
        ...briefData,
        created_by: authUser.id,
      };
      const { error } = await supabase.from('briefs').insert(briefPayload);

      if (error) {
        toast.error('Erro ao salvar brief.');
      } else {
        // Only advance to design_queue if currently in copy_approved (valid ±1 transition)
        const { data: current } = await supabase.from('contents').select('status').eq('id', contentId).single();
        if (current?.status === 'copy_approved') {
          await supabase.from('contents').update({ status: 'design_queue' }).eq('id', contentId);
        }
        queryClient.invalidateQueries({ queryKey: ['contents'] });
        queryClient.invalidateQueries({ queryKey: ['briefs'] });
        toast.success('Brief gerado e salvo!');
        onBriefCreated();
        onOpenChange(false);
      }
    } catch (err: any) {
      toast.error(err.message || 'Erro ao gerar brief.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader className="pb-4">
          <SheetTitle className="font-display flex items-center gap-2">
            <PenTool className="h-5 w-5 text-accent" />
            Gerar Brief com IA
          </SheetTitle>
          <SheetDescription>
            A IA vai criar um brief estruturado e prático para o designer
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4">
          {analyzedRefs.length > 0 && (
            <div className="space-y-2 rounded-lg border border-accent/20 bg-accent/5 p-3">
              <Label className="flex items-center gap-1 text-xs font-medium">
                <Brain className="h-3 w-3 text-accent" /> Referência analisada (opcional)
              </Label>
              <Select value={selectedRefId || 'none'} onValueChange={handleRefSelect}>
                <SelectTrigger className="text-sm"><SelectValue placeholder="Selecionar referência..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma</SelectItem>
                  {analyzedRefs.map(r => <SelectItem key={r.id} value={r.id}>{r.title}</SelectItem>)}
                </SelectContent>
              </Select>
              {selectedAnalysis?.analysis_summary && (
                <p className="text-[11px] text-muted-foreground line-clamp-2">{selectedAnalysis.analysis_summary}</p>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label>Tema *</Label>
            <Input value={form.theme} onChange={(e) => updateForm('theme', e.target.value)} placeholder="Ex: Produtividade com IA" />
          </div>

          <div className="space-y-2">
            <Label>Objetivo</Label>
            <Input value={form.objective} onChange={(e) => updateForm('objective', e.target.value)} placeholder="Objetivo da peça" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Plataforma</Label>
              <Select value={form.platform} onValueChange={(v) => updateForm('platform', v)}>
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
              <Select value={form.format} onValueChange={(v) => updateForm('format', v)}>
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
            <Label>Público-alvo</Label>
            <Input value={form.targetAudience} onChange={(e) => updateForm('targetAudience', e.target.value)} placeholder="Público-alvo" />
          </div>

          <div className="space-y-2">
            <Label>Texto base (opcional)</Label>
            <Textarea
              value={form.rawText}
              onChange={(e) => updateForm('rawText', e.target.value)}
              placeholder="Cole aqui a copy ou texto de referência..."
              className="min-h-[80px] resize-y text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label>Observações adicionais</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Algo específico que o designer precisa saber?"
              className="min-h-[60px] resize-y text-sm"
            />
          </div>

          <Button
            onClick={handleGenerate}
            disabled={loading || !form.theme.trim()}
            className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
          >
            {loading ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-accent-foreground/30 border-t-accent-foreground mr-2" />
                Gerando brief...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Gerar Brief com IA
              </>
            )}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
