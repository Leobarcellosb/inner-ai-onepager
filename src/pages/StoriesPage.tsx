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
import {
  Sparkles,
  Loader2,
  Check,
  Film,
  ArrowRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { ensureScheduledDate, ensureScheduledTime } from '@/lib/pipeline';
import { PLATFORM_LABELS } from '@/types';

const SLIDE_TYPE_COLORS: Record<string, string> = {
  hook:    'hsl(38 90% 50%)',
  value:   'hsl(217 88% 58%)',
  tension: 'hsl(258 82% 64%)',
  proof:   'hsl(142 60% 42%)',
  cta:     'hsl(0 72% 55%)',
};

const SLIDE_TYPE_LABELS: Record<string, string> = {
  hook:    'Gancho',
  value:   'Valor',
  tension: 'Tensão',
  proof:   'Prova',
  cta:     'CTA',
};

interface Slide {
  position: number;
  type: string;
  text: string;
  visual_direction: string;
  cta: string | null;
  note: string | null;
}

interface StorySequence {
  sequence_title: string;
  objective: string;
  total_slides: number;
  slides: Slide[];
}

export default function StoriesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [topic, setTopic] = useState('');
  const [objective, setObjective] = useState('');
  const [slideCount, setSlideCount] = useState('5');
  const [platform, setPlatform] = useState('instagram');
  const [sequence, setSequence] = useState<StorySequence | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleGenerate = async () => {
    if (!topic.trim()) { toast.error('Informe o tema dos stories.'); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-stories', {
        body: { topic, objective, slide_count: parseInt(slideCount), platform },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setSequence(data.sequence as StorySequence);
      toast.success(`Sequência de ${data.sequence?.total_slides ?? 0} stories gerada!`);
    } catch (e: any) {
      toast.error(e.message || 'Erro ao gerar stories');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user || !sequence) return;
    setSaving(true);
    try {
      // 1. Create parent content (the sequence)
      const today = ensureScheduledDate(null);
      const time = ensureScheduledTime(null);
      const { data: parent, error: parentErr } = await supabase.from('contents').insert({
        title: sequence.sequence_title,
        theme: topic,
        platform: platform in PLATFORM_LABELS ? platform : 'instagram',
        format: 'story',
        objective: sequence.objective,
        raw_text: `Sequência de ${sequence.total_slides} stories: ${sequence.objective}`,
        created_by: user.id,
        status: 'idea',
        priority: 'medium',
        content_type: 'story_sequence',
        scheduled_date: today,
        scheduled_time: time,
      }).select('id').single();
      if (parentErr) throw parentErr;

      // 2. Create child slides
      const slides = sequence.slides.map((slide) => ({
        title: `${sequence.sequence_title} — Slide ${slide.position}`,
        theme: topic,
        platform: platform in PLATFORM_LABELS ? platform : 'instagram',
        format: 'story' as const,
        objective: slide.type,
        raw_text: slide.text,
        cta: slide.cta || '',
        created_by: user.id,
        status: 'idea' as const,
        priority: 'medium' as const,
        content_type: 'story_slide',
        parent_content_id: parent.id,
        scheduled_date: today,
        scheduled_time: time,
      }));
      const { error: slidesErr } = await supabase.from('contents').insert(slides);
      if (slidesErr) throw slidesErr;

      queryClient.invalidateQueries({ queryKey: ['contents'] });
      toast.success(`Sequência salva — ${slides.length} slides no Pipeline`);
      navigate(`/contents/${parent.id}`);
    } catch (e: any) {
      toast.error(e.message || 'Erro ao salvar stories');
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
            <Film className="h-6 w-6 text-accent" />
            Stories
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gere sequências de stories com IA — prontas para design e publicação
          </p>
        </div>

        {/* Input — wide horizontal bar */}
        <div className="rounded-xl p-5 bg-card border border-border">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="space-y-1.5 md:col-span-1">
              <Label className="text-xs text-muted-foreground">Tema da sequência</Label>
              <Input
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Ex: 5 dicas para vender mais com IA"
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5 md:col-span-1">
              <Label className="text-xs text-muted-foreground">Objetivo</Label>
              <Input
                value={objective}
                onChange={(e) => setObjective(e.target.value)}
                placeholder="Ex: gerar leads, educar, engajar"
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Slides</Label>
              <Select value={slideCount} onValueChange={setSlideCount}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[3,4,5,6,7,8,10,12].map(n => (
                    <SelectItem key={n} value={String(n)}>{n} slides</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Plataforma</Label>
              <Select value={platform} onValueChange={setPlatform}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="instagram">Instagram</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="tiktok">TikTok</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button
            onClick={handleGenerate}
            disabled={loading}
            className="w-full font-semibold mt-4"
            style={{ background: 'hsl(258 82% 64%)', color: '#fff' }}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
            {loading ? 'Gerando sequência...' : 'Gerar stories com IA'}
          </Button>
        </div>

        {/* Result */}
        {sequence && (
          <div
            className="rounded-xl overflow-hidden bg-card border border-border"
          >
            {/* Sequence header */}
            <div className="px-5 py-4 border-b border-border">
              <h2 className="text-sm font-semibold text-foreground/90">{sequence.sequence_title}</h2>
              <p className="text-xs text-muted-foreground mt-1">{sequence.objective}</p>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="outline" className="text-[9px]">{sequence.total_slides} slides</Badge>
                <Badge variant="outline" className="text-[9px]">{PLATFORM_LABELS[platform as keyof typeof PLATFORM_LABELS]}</Badge>
              </div>
            </div>

            {/* Slides — responsive grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-4">
              {sequence.slides.map((slide) => {
                const typeColor = SLIDE_TYPE_COLORS[slide.type] ?? 'hsl(240 5% 50%)';
                return (
                  <div key={slide.position} className="rounded-lg bg-background border border-border p-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <div
                        className="flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold text-white shrink-0"
                        style={{ background: typeColor }}
                      >
                        {slide.position}
                      </div>
                      <span className="text-[9px] font-semibold uppercase" style={{ color: typeColor }}>
                        {SLIDE_TYPE_LABELS[slide.type] ?? slide.type}
                      </span>
                    </div>
                    <p className="text-sm text-foreground/85 leading-relaxed">{slide.text}</p>
                    <p className="text-[10px] text-muted-foreground">
                      <span className="text-muted-foreground/50">Visual:</span> {slide.visual_direction}
                    </p>
                    {slide.cta && (
                      <p className="text-[10px] font-medium" style={{ color: SLIDE_TYPE_COLORS.cta }}>
                        CTA: {slide.cta}
                      </p>
                    )}
                    {slide.note && (
                      <p className="text-[10px] text-muted-foreground/60 italic">{slide.note}</p>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Save */}
            <div className="flex items-center justify-between px-5 py-3 border-t border-border">
              <span className="text-xs text-muted-foreground">
                {sequence.total_slides} slides prontos para o pipeline
              </span>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={saving}
                className="font-semibold"
                style={{ background: 'hsl(142 60% 42%)', color: '#fff' }}
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Check className="h-3.5 w-3.5 mr-1" />}
                {saving ? 'Salvando...' : 'Salvar no Pipeline'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
