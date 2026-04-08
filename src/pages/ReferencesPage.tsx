import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { ImageIcon, Plus, Search, Eye, Trash2, Power, ThumbsUp, ThumbsDown, Minus } from 'lucide-react';
import { toast } from 'sonner';
import { PLATFORM_LABELS, FORMAT_LABELS } from '@/types';

type ReferenceQuality = 'strong' | 'neutral' | 'weak';

interface Reference {
  id: string;
  title: string;
  source_name: string;
  platform: string;
  format: string;
  reference_image_url: string | null;
  tags: string[];
  analysis_status: string;
  is_active: boolean;
  quality: ReferenceQuality;
  created_at: string;
}

const QUALITY_CONFIG: Record<ReferenceQuality, { label: string; badge: string; icon: typeof ThumbsUp }> = {
  strong: { label: 'Forte', badge: 'bg-success/10 text-success', icon: ThumbsUp },
  neutral: { label: 'Neutro', badge: 'bg-muted text-muted-foreground', icon: Minus },
  weak: { label: 'Fraco', badge: 'bg-destructive/10 text-destructive', icon: ThumbsDown },
};

const STATUS_BADGE: Record<string, string> = {
  pendente: 'bg-warning/10 text-warning',
  em_analise: 'bg-info/10 text-info',
  analisado: 'bg-success/10 text-success',
  erro: 'bg-destructive/10 text-destructive',
};

const STATUS_LABEL: Record<string, string> = {
  pendente: 'Pendente',
  em_analise: 'Analisando',
  analisado: 'Analisado',
  erro: 'Erro',
};

export default function ReferencesPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [platformFilter, setPlatformFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newRef, setNewRef] = useState({ title: '', source_name: '', platform: 'instagram', format: 'post_estatico', caption_or_observed_copy: '', observed_hook: '', tags: '' });
  const [uploading, setUploading] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);

  const { data: refs = [] } = useQuery<Reference[]>({
    queryKey: ['references', 'list'],
    queryFn: async () => {
      const { data, error } = await supabase.from('references').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as Reference[];
    },
  });

  const handleCreate = async () => {
    const { data: { user: authUser }, error: authErr } = await supabase.auth.getUser();
    if (!authUser || !newRef.title.trim()) { toast.error('Título obrigatório ou não autenticado'); return; }
    setUploading(true);
    try {
      let imageUrl: string | null = null;
      if (imageFile) {
        const ext = imageFile.name.split('.').pop();
        const path = `${authUser.id}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from('reference-images').upload(path, imageFile);
        if (upErr) throw upErr;
        const { data: urlData } = supabase.storage.from('reference-images').getPublicUrl(path);
        imageUrl = urlData.publicUrl;
      }
      const tagsArr = newRef.tags.split(',').map(t => t.trim()).filter(Boolean);
      const payload = {
        title: newRef.title,
        source_name: newRef.source_name,
        platform: newRef.platform,
        format: newRef.format,
        caption_or_observed_copy: newRef.caption_or_observed_copy,
        observed_hook: newRef.observed_hook,
        reference_image_url: imageUrl,
        tags: tagsArr,
        uploaded_by: authUser.id,
        created_by: authUser.id,
      };
      const { error, status, statusText } = await supabase.from('references').insert(payload);
      if (error) {
        throw error;
      }
      toast.success('Referência adicionada!');
      setDialogOpen(false);
      setNewRef({ title: '', source_name: '', platform: 'instagram', format: 'post_estatico', caption_or_observed_copy: '', observed_hook: '', tags: '' });
      setImageFile(null);
      queryClient.invalidateQueries({ queryKey: ['references'] });
    } catch (e: any) {
      toast.error(e.message || 'Erro ao criar');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, r: Reference) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Excluir "${r.title}"? A análise e imagem associadas também serão removidas.`)) return;
    try {
      // 1. Delete DB record (cascades to reference_analyses)
      const { error } = await supabase.from('references').delete().eq('id', r.id);
      if (error) throw error;

      // 2. Clean up storage image (best effort)
      if (r.reference_image_url) {
        try {
          const url = new URL(r.reference_image_url);
          const pathMatch = url.pathname.match(/\/object\/public\/reference-images\/(.+)/);
          if (pathMatch) {
            await supabase.storage.from('reference-images').remove([decodeURIComponent(pathMatch[1])]);
          }
        } catch { /* non-blocking */ }
      }

      queryClient.invalidateQueries({ queryKey: ['references'] });
      queryClient.invalidateQueries({ queryKey: ['brain'] });
      toast.success('Referência excluída');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao excluir');
    }
  };

  const handleSetQuality = async (e: React.MouseEvent, r: Reference, quality: ReferenceQuality) => {
    e.preventDefault();
    e.stopPropagation();
    if (r.quality === quality) return;
    try {
      const { error } = await supabase.from('references').update({ quality }).eq('id', r.id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['references'] });
      toast.success(`Qualidade: ${QUALITY_CONFIG[quality].label}`);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao avaliar');
    }
  };

  const handleToggleActive = async (e: React.MouseEvent, r: Reference) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const { error } = await supabase.from('references').update({ is_active: !r.is_active }).eq('id', r.id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['references'] });
      queryClient.invalidateQueries({ queryKey: ['brain'] });
      toast.success(r.is_active ? 'Referência desativada — não influencia mais a IA' : 'Referência reativada');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao alterar status');
    }
  };

  const filtered = refs.filter(r => {
    if (search && !r.title.toLowerCase().includes(search.toLowerCase()) && !r.source_name.toLowerCase().includes(search.toLowerCase())) return false;
    if (platformFilter !== 'all' && r.platform !== platformFilter) return false;
    return true;
  });

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
              <ImageIcon className="h-5 w-5 text-accent" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold tracking-tight">Referências</h1>
              <p className="text-sm text-muted-foreground">Biblioteca de posts, campanhas e peças criativas</p>
            </div>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" /> Nova Referência</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Adicionar Referência</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Título *</Label>
                  <Input value={newRef.title} onChange={e => setNewRef(p => ({ ...p, title: e.target.value }))} placeholder="Nome da referência" />
                </div>
                <div>
                  <Label>Fonte</Label>
                  <Input value={newRef.source_name} onChange={e => setNewRef(p => ({ ...p, source_name: e.target.value }))} placeholder="Ex: @perfil, empresa, campanha" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Plataforma</Label>
                    <Select value={newRef.platform} onValueChange={v => setNewRef(p => ({ ...p, platform: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(PLATFORM_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Formato</Label>
                    <Select value={newRef.format} onValueChange={v => setNewRef(p => ({ ...p, format: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(FORMAT_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>Imagem</Label>
                  <Input type="file" accept="image/*" onChange={e => setImageFile(e.target.files?.[0] || null)} />
                </div>
                <div>
                  <Label>Copy / Texto Observado</Label>
                  <Textarea value={newRef.caption_or_observed_copy} onChange={e => setNewRef(p => ({ ...p, caption_or_observed_copy: e.target.value }))} placeholder="Texto da peça..." />
                </div>
                <div>
                  <Label>Hook Observado</Label>
                  <Input value={newRef.observed_hook} onChange={e => setNewRef(p => ({ ...p, observed_hook: e.target.value }))} placeholder="Gancho principal" />
                </div>
                <div>
                  <Label>Tags (separadas por vírgula)</Label>
                  <Input value={newRef.tags} onChange={e => setNewRef(p => ({ ...p, tags: e.target.value }))} placeholder="branding, persuasão, carrossel" />
                </div>
                <Button onClick={handleCreate} disabled={uploading} className="w-full">
                  {uploading ? 'Salvando...' : 'Salvar Referência'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar referências..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={platformFilter} onValueChange={setPlatformFilter}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Plataforma" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {Object.entries(PLATFORM_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <ImageIcon className="mb-3 h-10 w-10 opacity-50" />
            <p className="text-sm">Nenhuma referência encontrada</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((r) => (
              <Link key={r.id} to={`/intelligence/references/${r.id}`}>
                <Card className={`group overflow-hidden transition-shadow hover:shadow-md ${r.is_active ? '' : 'opacity-50'}`}>
                  {r.reference_image_url && (
                    <div className="aspect-video overflow-hidden bg-muted">
                      <img src={r.reference_image_url} alt={r.title} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                    </div>
                  )}
                  {!r.reference_image_url && (
                    <div className="flex aspect-video items-center justify-center bg-muted">
                      <ImageIcon className="h-8 w-8 text-muted-foreground/40" />
                    </div>
                  )}
                  <CardContent className="p-4">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold truncate flex-1">{r.title}</h3>
                      {r.quality !== 'neutral' && (
                        <Badge variant="secondary" className={`text-[9px] ${QUALITY_CONFIG[r.quality].badge}`}>
                          {QUALITY_CONFIG[r.quality].label}
                        </Badge>
                      )}
                      <Badge variant="secondary" className={STATUS_BADGE[r.analysis_status] || ''}>
                        {STATUS_LABEL[r.analysis_status] || r.analysis_status}
                      </Badge>
                      <button
                        onClick={(e) => handleToggleActive(e, r)}
                        className={`shrink-0 p-1 rounded-md transition-colors opacity-0 group-hover:opacity-100 ${r.is_active ? 'text-muted-foreground/30 hover:text-warning hover:bg-warning/10' : 'text-warning hover:text-success hover:bg-success/10 opacity-100'}`}
                        title={r.is_active ? 'Desativar' : 'Reativar'}
                      >
                        <Power className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={(e) => handleDelete(e, r)}
                        className="shrink-0 p-1 rounded-md text-muted-foreground/30 hover:text-destructive hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100"
                        title="Excluir"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <span>{PLATFORM_LABELS[r.platform as keyof typeof PLATFORM_LABELS] || r.platform}</span>
                        {r.source_name && <><span>·</span><span>{r.source_name}</span></>}
                      </div>
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        {(['strong', 'neutral', 'weak'] as ReferenceQuality[]).map((q) => {
                          const cfg = QUALITY_CONFIG[q];
                          const Icon = cfg.icon;
                          return (
                            <button
                              key={q}
                              onClick={(e) => handleSetQuality(e, r, q)}
                              className={`p-1 rounded transition-colors ${r.quality === q ? cfg.badge : 'text-muted-foreground/30 hover:text-muted-foreground'}`}
                              title={cfg.label}
                            >
                              <Icon className="h-3 w-3" />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    {r.tags.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {r.tags.slice(0, 3).map(t => <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>)}
                        {r.tags.length > 3 && <Badge variant="outline" className="text-[10px]">+{r.tags.length - 3}</Badge>}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
