import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/AppLayout';
import { ContentStatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Sparkles, Save, ArrowLeft, PenTool } from 'lucide-react';
import { toast } from 'sonner';
import { improveTextWithAI, generateBriefWithAI } from '@/lib/ai';
import { PLATFORM_LABELS, FORMAT_LABELS, STATUS_LABELS } from '@/types';
import type { Content, ContentPlatform, ContentFormat, ContentStatus } from '@/types';

export default function ContentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [content, setContent] = useState<Content | null>(null);
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [briefLoading, setBriefLoading] = useState(false);

  useEffect(() => {
    if (id) fetchContent();
  }, [id]);

  const fetchContent = async () => {
    const { data } = await supabase.from('contents').select('*').eq('id', id!).single();
    if (data) setContent(data as Content);
  };

  const updateField = (field: string, value: string) => {
    setContent((prev) => prev ? { ...prev, [field]: value } : null);
  };

  const handleSave = async () => {
    if (!content) return;
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

  const handleImproveWithAI = async () => {
    if (!content?.raw_text?.trim()) {
      toast.error('Escreva um texto base primeiro.');
      return;
    }
    setAiLoading(true);
    try {
      const improved = await improveTextWithAI(content.raw_text);
      setContent((prev) => prev ? { ...prev, improved_text: improved } : null);
      toast.success('Texto melhorado!');
    } catch {
      toast.error('Erro ao melhorar texto.');
    }
    setAiLoading(false);
  };

  const handleGenerateBrief = async () => {
    if (!content) return;
    setBriefLoading(true);
    try {
      const briefData = await generateBriefWithAI({
        theme: content.theme,
        objective: content.objective,
        platform: content.platform,
        format: content.format,
        targetAudience: content.target_audience,
        rawText: content.raw_text,
      });

      const { error } = await supabase.from('briefs').insert({
        content_id: content.id,
        brief_title: `Brief: ${content.title}`,
        ...briefData,
      });

      if (error) {
        toast.error('Erro ao criar brief.');
        console.error(error);
      } else {
        toast.success('Brief gerado com sucesso!');
        // Update content status
        await supabase.from('contents').update({ status: 'aguardando_design' }).eq('id', content.id);
        setContent((prev) => prev ? { ...prev, status: 'aguardando_design' as ContentStatus } : null);
      }
    } catch {
      toast.error('Erro ao gerar brief.');
    }
    setBriefLoading(false);
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
              onClick={handleGenerateBrief}
              disabled={briefLoading}
              variant="outline"
              className="border-accent text-accent hover:bg-accent/10"
            >
              <PenTool className={`h-4 w-4 mr-2 ${briefLoading ? 'animate-pulse-soft' : ''}`} />
              {briefLoading ? 'Gerando...' : 'Gerar Brief com IA'}
            </Button>
            <Button onClick={handleSave} disabled={loading} className="bg-accent text-accent-foreground hover:bg-accent/90">
              <Save className="h-4 w-4 mr-2" />
              {loading ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </div>

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
                <Select value={content.status} onValueChange={(v) => updateField('status', v)}>
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
                onClick={handleImproveWithAI}
                disabled={aiLoading}
                variant="outline"
                className="w-full border-accent text-accent hover:bg-accent/10"
              >
                <Sparkles className={`h-4 w-4 mr-2 ${aiLoading ? 'animate-pulse-soft' : ''}`} />
                {aiLoading ? 'Melhorando...' : 'Melhorar com IA'}
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
    </AppLayout>
  );
}
