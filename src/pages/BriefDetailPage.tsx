import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/AppLayout';
import { BriefStatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Save, Copy, Play, CheckCircle, Target, Eye, Palette, MessageSquare, Layers, Type, Lightbulb } from 'lucide-react';
import { toast } from 'sonner';
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

  const handleStatusChange = async (newStatus: BriefStatus) => {
    if (!brief) return;
    const { error } = await supabase.from('briefs').update({ status: newStatus }).eq('id', brief.id);
    if (error) {
      toast.error('Erro ao atualizar status.');
    } else {
      setBrief((prev) => prev ? { ...prev, status: newStatus } : null);
      toast.success(`Status atualizado para ${statusLabel(newStatus)}!`);
    }
  };

  const handleDuplicate = async () => {
    if (!brief) return;
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) { toast.error('Usuário não autenticado.'); return; }
    const { id: _id, created_at, updated_at, contents, ...briefData } = brief;
    const { data, error } = await supabase.from('briefs').insert({
      ...briefData,
      brief_title: `${brief.brief_title} (cópia)`,
      status: 'novo' as BriefStatus,
      created_by: authUser.id,
    }).select().single();
    if (error) {
      toast.error('Erro ao duplicar brief.');
    } else if (data) {
      toast.success('Brief duplicado!');
      navigate(`/briefs/${data.id}`);
    }
  };

  const statusLabel = (s: BriefStatus) => {
    const map: Record<BriefStatus, string> = { novo: 'Novo', em_andamento: 'Em Andamento', em_ajuste: 'Em Ajuste', finalizado: 'Finalizado' };
    return map[s];
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
    { label: 'Grande Ideia / Ângulo Criativo', field: 'creative_angle', icon: Lightbulb },
    { label: 'Objetivo da Peça', field: 'campaign_objective', icon: Target },
    { label: 'Público-Alvo', field: 'target_audience', icon: Eye },
    { label: 'Mensagem Central', field: 'key_message', icon: MessageSquare },
    { label: 'Direção Visual & Tom', field: 'visual_direction', icon: Palette },
    { label: 'Referências Visuais', field: 'visual_references', icon: Eye },
    { label: 'Elementos Obrigatórios', field: 'mandatory_elements', icon: Layers },
    { label: 'Estrutura por Slides / Cenas', field: 'suggested_slides_or_scenes', icon: Layers },
    { label: 'Resumo da Copy', field: 'copy_summary', icon: Type },
    { label: 'CTA', field: 'cta', icon: Target },
  ];

  return (
    <AppLayout>
      <div className="max-w-4xl space-y-6 animate-fade-in">
        {/* Header */}
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
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleDuplicate}>
              <Copy className="h-4 w-4 mr-2" />
              Duplicar
            </Button>
            <Button onClick={handleSave} disabled={loading} className="bg-accent text-accent-foreground hover:bg-accent/90">
              <Save className="h-4 w-4 mr-2" />
              {loading ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </div>

        {/* Status actions */}
        <div className="flex gap-2 flex-wrap">
          {brief.status !== 'em_andamento' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleStatusChange('em_andamento')}
              className="border-warning/50 text-warning hover:bg-warning/10"
            >
              <Play className="h-3.5 w-3.5 mr-1.5" />
              Marcar como Em Andamento
            </Button>
          )}
          {brief.status !== 'em_ajuste' && brief.status !== 'novo' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleStatusChange('em_ajuste')}
              className="border-destructive/50 text-destructive hover:bg-destructive/10"
            >
              Em Ajuste
            </Button>
          )}
          {brief.status !== 'finalizado' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleStatusChange('finalizado')}
              className="border-accent/50 text-accent hover:bg-accent/10"
            >
              <CheckCircle className="h-3.5 w-3.5 mr-1.5" />
              Marcar como Finalizado
            </Button>
          )}
        </div>

        {/* Brief sections in clean blocks */}
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

        {/* Designer notes — full width */}
        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-display flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-accent" />
              Observações para o Designer
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
