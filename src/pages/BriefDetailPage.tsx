import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/AppLayout';
import { BriefStatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Save, Palette, MessageSquare, Target, Eye, Layers, Type } from 'lucide-react';
import { toast } from 'sonner';
import { BRIEF_STATUS_LABELS } from '@/types';
import type { Brief, BriefStatus } from '@/types';

export default function BriefDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [brief, setBrief] = useState<Brief | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (id) fetchBrief();
  }, [id]);

  const fetchBrief = async () => {
    const { data } = await supabase
      .from('briefs')
      .select('*, contents(title)')
      .eq('id', id!)
      .single();
    if (data) setBrief(data as Brief);
  };

  const updateField = (field: string, value: string) => {
    setBrief((prev) => prev ? { ...prev, [field]: value } : null);
  };

  const handleSave = async () => {
    if (!brief) return;
    setLoading(true);
    const { id: _id, created_at, contents, ...updateData } = brief;
    const { error } = await supabase.from('briefs').update(updateData).eq('id', brief.id);
    if (error) {
      toast.error('Erro ao salvar brief.');
    } else {
      toast.success('Brief atualizado!');
    }
    setLoading(false);
  };

  if (!brief) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent" />
        </div>
      </AppLayout>
    );
  }

  const sections = [
    { label: 'Ângulo Criativo', field: 'creative_angle', icon: Target },
    { label: 'Objetivo da Campanha', field: 'campaign_objective', icon: Target },
    { label: 'Público-Alvo', field: 'target_audience', icon: Eye },
    { label: 'Mensagem Principal', field: 'key_message', icon: MessageSquare },
    { label: 'Direção Visual', field: 'visual_direction', icon: Palette },
    { label: 'Referências Visuais', field: 'visual_references', icon: Eye },
    { label: 'Elementos Obrigatórios', field: 'mandatory_elements', icon: Layers },
    { label: 'Slides / Cenas Sugeridas', field: 'suggested_slides_or_scenes', icon: Layers },
    { label: 'Resumo da Copy', field: 'copy_summary', icon: Type },
    { label: 'CTA', field: 'cta', icon: MessageSquare },
  ];

  return (
    <AppLayout>
      <div className="max-w-4xl space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/briefs')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="font-display text-2xl font-bold">{brief.brief_title}</h1>
              <div className="flex items-center gap-2 mt-1">
                <BriefStatusBadge status={brief.status} />
                <span className="text-sm text-muted-foreground">
                  Conteúdo: {(brief.contents as any)?.title || '—'}
                </span>
              </div>
            </div>
          </div>
          <Button onClick={handleSave} disabled={loading} className="bg-accent text-accent-foreground hover:bg-accent/90">
            <Save className="h-4 w-4 mr-2" />
            {loading ? 'Salvando...' : 'Salvar Brief'}
          </Button>
        </div>

        <div className="flex gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Status do Brief</Label>
            <Select value={brief.status} onValueChange={(v) => updateField('status', v)}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(BRIEF_STATUS_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {sections.map(({ label, field, icon: Icon }) => (
            <Card key={field} className="glass-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-display flex items-center gap-2">
                  <Icon className="h-4 w-4 text-accent" />
                  {label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={(brief as any)[field] || ''}
                  onChange={(e) => updateField(field, e.target.value)}
                  className="min-h-[100px] resize-y text-sm"
                />
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-display flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-accent" />
              Notas do Designer
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={brief.designer_notes}
              onChange={(e) => updateField('designer_notes', e.target.value)}
              placeholder="Adicione notas, dúvidas ou observações sobre o brief..."
              className="min-h-[120px] resize-y text-sm"
            />
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
