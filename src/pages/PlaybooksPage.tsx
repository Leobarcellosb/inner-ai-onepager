import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Lightbulb, Plus, Search, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface Playbook {
  id: string;
  title: string;
  category: string;
  summary: string;
  framework: string;
  examples: string;
  recommended_use_cases: string;
  created_at: string;
}

export default function PlaybooksPage() {
  const { user } = useAuth();
  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Playbook | null>(null);
  const [form, setForm] = useState({ title: '', category: '', summary: '', framework: '', examples: '', recommended_use_cases: '' });

  useEffect(() => { fetchPlaybooks(); }, []);

  const fetchPlaybooks = async () => {
    const { data } = await supabase.from('playbooks').select('*').order('created_at', { ascending: false });
    if (data) setPlaybooks(data as Playbook[]);
  };

  const openEdit = (pb: Playbook) => {
    setEditing(pb);
    setForm({ title: pb.title, category: pb.category, summary: pb.summary, framework: pb.framework, examples: pb.examples, recommended_use_cases: pb.recommended_use_cases });
    setDialogOpen(true);
  };

  const openNew = () => {
    setEditing(null);
    setForm({ title: '', category: '', summary: '', framework: '', examples: '', recommended_use_cases: '' });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!user || !form.title.trim()) { toast.error('Título obrigatório'); return; }
    try {
      if (editing) {
        const { error } = await supabase.from('playbooks').update(form).eq('id', editing.id);
        if (error) throw error;
        toast.success('Playbook atualizado!');
      } else {
        const { error } = await supabase.from('playbooks').insert({ ...form, created_by: user.id });
        if (error) throw error;
        toast.success('Playbook criado!');
      }
      setDialogOpen(false);
      fetchPlaybooks();
    } catch (e: any) {
      toast.error(e.message || 'Erro');
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('playbooks').delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success('Playbook excluído');
    fetchPlaybooks();
  };

  const filtered = playbooks.filter(p => !search || p.title.toLowerCase().includes(search.toLowerCase()) || p.category.toLowerCase().includes(search.toLowerCase()));

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
              <Lightbulb className="h-5 w-5 text-accent" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold tracking-tight">Playbooks</h1>
              <p className="text-sm text-muted-foreground">Aprendizados, frameworks e padrões do time</p>
            </div>
          </div>
          <Button onClick={openNew}><Plus className="mr-2 h-4 w-4" /> Novo Playbook</Button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar playbooks..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Lightbulb className="mb-3 h-10 w-10 opacity-50" />
            <p className="text-sm">Nenhum playbook encontrado</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {filtered.map((pb) => (
              <Card key={pb.id} className="group">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-sm font-semibold">{pb.title}</CardTitle>
                      {pb.category && <Badge variant="outline" className="mt-1 text-[10px]">{pb.category}</Badge>}
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(pb)}><Pencil className="h-3 w-3" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(pb.id)}><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {pb.summary && <p className="text-xs text-muted-foreground line-clamp-3">{pb.summary}</p>}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>{editing ? 'Editar Playbook' : 'Novo Playbook'}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Título *</Label><Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} /></div>
              <div><Label>Categoria</Label><Input value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} placeholder="Ex: Engenharia Reversa, Framework, Padrão" /></div>
              <div><Label>Resumo</Label><Textarea value={form.summary} onChange={e => setForm(p => ({ ...p, summary: e.target.value }))} className="min-h-[80px]" /></div>
              <div><Label>Framework / Método</Label><Textarea value={form.framework} onChange={e => setForm(p => ({ ...p, framework: e.target.value }))} className="min-h-[80px]" /></div>
              <div><Label>Exemplos</Label><Textarea value={form.examples} onChange={e => setForm(p => ({ ...p, examples: e.target.value }))} className="min-h-[60px]" /></div>
              <div><Label>Casos de Uso Recomendados</Label><Textarea value={form.recommended_use_cases} onChange={e => setForm(p => ({ ...p, recommended_use_cases: e.target.value }))} className="min-h-[60px]" /></div>
              <Button onClick={handleSave} className="w-full">{editing ? 'Salvar Alterações' : 'Criar Playbook'}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
