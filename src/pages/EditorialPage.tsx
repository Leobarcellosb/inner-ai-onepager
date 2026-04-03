import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { BookOpen, Save } from 'lucide-react';
import { toast } from 'sonner';

interface EditorialData {
  id?: string;
  brand_positioning: string;
  brand_voice: string;
  communication_pillars: string;
  content_pillars: string;
  audience_profiles: string;
  forbidden_terms: string;
  preferred_terms: string;
  visual_identity_guidelines: string;
  cta_patterns: string;
  creative_principles: string;
  examples_of_good_content: string;
  examples_of_bad_content: string;
}

const EMPTY: EditorialData = {
  brand_positioning: '', brand_voice: '', communication_pillars: '', content_pillars: '',
  audience_profiles: '', forbidden_terms: '', preferred_terms: '', visual_identity_guidelines: '',
  cta_patterns: '', creative_principles: '', examples_of_good_content: '', examples_of_bad_content: '',
};

const FIELDS: { key: keyof EditorialData; label: string; placeholder: string }[] = [
  { key: 'brand_positioning', label: 'Posicionamento da Marca', placeholder: 'Como a marca se posiciona no mercado...' },
  { key: 'brand_voice', label: 'Tom de Voz', placeholder: 'Personalidade, linguagem e estilo da comunicação...' },
  { key: 'communication_pillars', label: 'Pilares de Comunicação', placeholder: 'Temas macro que sustentam a estratégia...' },
  { key: 'content_pillars', label: 'Pilares de Conteúdo', placeholder: 'Categorias de conteúdo recorrentes...' },
  { key: 'audience_profiles', label: 'Perfis de Audiência', placeholder: 'Personas, dores, desejos e comportamentos...' },
  { key: 'forbidden_terms', label: 'Termos Proibidos', placeholder: 'Palavras e expressões que nunca devem ser usadas...' },
  { key: 'preferred_terms', label: 'Termos Preferidos', placeholder: 'Vocabulário oficial e expressões da marca...' },
  { key: 'visual_identity_guidelines', label: 'Diretrizes Visuais', placeholder: 'Regras de identidade visual aplicáveis ao conteúdo...' },
  { key: 'cta_patterns', label: 'Padrões de CTA', placeholder: 'Modelos de chamada para ação utilizados...' },
  { key: 'creative_principles', label: 'Princípios Criativos', placeholder: 'Diretrizes que guiam a criação...' },
  { key: 'examples_of_good_content', label: 'Exemplos de Bom Conteúdo', placeholder: 'Referências internas que funcionaram bem...' },
  { key: 'examples_of_bad_content', label: 'Exemplos de Conteúdo a Evitar', placeholder: 'O que não funciona e por quê...' },
];

export default function EditorialPage() {
  const { user } = useAuth();
  const [data, setData] = useState<EditorialData>(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from('editorial_guidelines').select('*').limit(1).single().then(({ data: d }) => {
      if (d) setData(d as EditorialData);
    });
  }, []);

  const handleSave = async () => {
    const { data: { user: authUser }, error: authErr } = await supabase.auth.getUser();
    if (!authUser) { toast.error('Usuário não autenticado.'); return; }
    setSaving(true);
    try {
      const { id, ...fields } = data;
      if (id) {
        const { error } = await supabase.from('editorial_guidelines').update(fields).eq('id', id);
      } else {
        const payload = { ...fields, created_by: authUser.id };
        const { data: created, error } = await supabase.from('editorial_guidelines')
          .insert(payload).select().single();
        if (created) setData(created as EditorialData);
      }
      toast.success('Linha editorial salva!');
    } catch (e: any) {
      toast.error(e.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
              <BookOpen className="h-5 w-5 text-accent" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold tracking-tight">Linha Editorial</h1>
              <p className="text-sm text-muted-foreground">Regras estratégicas da comunicação da Inner AI</p>
            </div>
          </div>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="mr-2 h-4 w-4" /> {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {FIELDS.map((f) => (
            <Card key={f.key}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">{f.label}</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  placeholder={f.placeholder}
                  value={(data[f.key] as string) || ''}
                  onChange={(e) => setData((prev) => ({ ...prev, [f.key]: e.target.value }))}
                  className="min-h-[120px] resize-y"
                />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
