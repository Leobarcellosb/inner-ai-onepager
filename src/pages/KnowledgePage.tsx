import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { BookOpen, Upload, Loader2, Sparkles, Trash2, FileText } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import mammoth from 'mammoth';
import type { KnowledgeEntry } from '@/types';

function parseXLSX(buffer: ArrayBuffer): string {
  const wb = XLSX.read(buffer, { type: 'array' });
  const rows: string[] = [];
  for (const name of wb.SheetNames) {
    const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[name], { defval: '' });
    if (data.length === 0) continue;
    const headers = Object.keys(data[0]);
    rows.push(headers.join(' | '));
    for (const row of data) rows.push(headers.map(h => String(row[h] ?? '')).join(' | '));
  }
  return rows.join('\n');
}

export default function KnowledgePage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [rawText, setRawText] = useState('');
  const [processing, setProcessing] = useState(false);
  const [fileName, setFileName] = useState('');
  const [dragOver, setDragOver] = useState(false);

  const { data: entries = [] } = useQuery<KnowledgeEntry[]>({
    queryKey: ['knowledge'],
    queryFn: async () => {
      const { data, error } = await supabase.from('knowledge_entries').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as KnowledgeEntry[];
    },
  });

  const handleFile = useCallback(async (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    setFileName(file.name);
    setTitle(file.name.replace(/\.[^.]+$/, ''));
    try {
      let text = '';
      if (ext === 'csv' || ext === 'txt') text = await file.text();
      else if (ext === 'xlsx' || ext === 'xls') text = parseXLSX(await file.arrayBuffer());
      else if (ext === 'docx') { const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() }); text = result.value; }
      else if (ext === 'json') text = await file.text();
      else text = await file.text();
      // Guard against binary content leaking through
      if (/[\x00-\x08\x0E-\x1F]/.test(text.slice(0, 500))) {
        toast.error('Formato não suportado ou arquivo corrompido.');
        return;
      }
      if (text.trim().length < 20) { toast.error('Conteúdo muito curto para processar.'); return; }
      setRawText(text.slice(0, 15000));
      toast.success(`"${file.name}" carregado`);
    } catch {
      toast.error('Erro ao ler arquivo — verifique o formato.');
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
  }, [handleFile]);

  const handleExtract = async () => {
    if (!rawText.trim()) { toast.error('Carregue ou cole o conteúdo.'); return; }
    setProcessing(true);

    const payload = { text: rawText, title: title || 'Documento' };
    console.log('[KNOWLEDGE] Sending to extract-knowledge:', {
      titleLen: payload.title.length,
      textLen: payload.text.length,
      textPreview: payload.text.slice(0, 200),
      hasBinary: /[\x00-\x08\x0E-\x1F]/.test(payload.text.slice(0, 500)),
    });

    try {
      const { data, error } = await supabase.functions.invoke('extract-knowledge', {
        body: payload,
      });

      console.log('[KNOWLEDGE] Response:', { data, error: error ? { message: error.message, name: error.name, status: (error as any).status } : null });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      queryClient.invalidateQueries({ queryKey: ['knowledge'] });
      queryClient.invalidateQueries({ queryKey: ['brain'] });
      toast.success(`${data.insights?.length ?? 0} insights extraídos e salvos no cérebro`);
      setRawText(''); setTitle(''); setFileName('');
    } catch (e: any) {
      toast.error(e.message || 'Erro ao processar');
    } finally { setProcessing(false); }
  };

  const handleDelete = async (id: string) => {
    await supabase.from('knowledge_entries').delete().eq('id', id);
    queryClient.invalidateQueries({ queryKey: ['knowledge'] });
    toast.success('Entrada removida');
  };

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-info" />
            Base de Conhecimento
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Alimente o cérebro com documentos, artigos e insights — a IA aprende e aplica automaticamente
          </p>
        </div>

        {/* Upload */}
        <div className="space-y-3">
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={`rounded-xl p-6 text-center cursor-pointer transition-all border-2 border-dashed ${dragOver ? '' : 'bg-card border-border'}`}
            style={dragOver ? { background: 'hsl(217 88% 58% / 0.05)', borderColor: 'hsl(217 88% 58%)' } : undefined}
            onClick={() => document.getElementById('kb-file')?.click()}
          >
            <FileText className={`h-8 w-8 mx-auto mb-2 ${dragOver ? 'text-info' : 'text-muted-foreground/50'}`} />
            <p className="text-sm text-foreground/70">{fileName || 'Arraste ou clique — DOCX, CSV, XLSX, TXT'}</p>
            <input id="kb-file" type="file" accept=".docx,.csv,.xlsx,.xls,.txt,.json" className="hidden"
              onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }} />
          </div>

          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título do documento" className="h-9 text-sm" />

          <Textarea value={rawText} onChange={(e) => setRawText(e.target.value)}
            placeholder="Ou cole o conteúdo diretamente..." className="min-h-[100px] text-sm resize-y" />

          <Button onClick={handleExtract} disabled={processing || !rawText.trim()} className="w-full font-semibold"
            style={{ background: 'hsl(258 82% 64%)', color: '#fff' }}>
            {processing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
            {processing ? 'Extraindo insights...' : 'Extrair e salvar no cérebro'}
          </Button>
        </div>

        {/* Entries */}
        {entries.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-foreground/70">{entries.length} entrada{entries.length !== 1 ? 's' : ''} na base</h2>
            {entries.map((entry) => (
              <div key={entry.id} className="rounded-xl overflow-hidden bg-card border border-border">
                <div className="flex items-start justify-between px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground/90 truncate">{entry.title}</p>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <Badge variant="outline" className="text-[8px]">{entry.source_type}</Badge>
                      {entry.tags.map(t => (
                        <Badge key={t} variant="outline" className="text-[8px]">{t}</Badge>
                      ))}
                      <span className="text-[9px] text-muted-foreground ml-1">
                        {entry.extracted_insights.length} insight{entry.extracted_insights.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                  <button onClick={() => handleDelete(entry.id)} className="p-1 rounded hover:bg-white/5 text-muted-foreground hover:text-destructive shrink-0">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
                {entry.extracted_insights.length > 0 && (
                  <div className="px-4 pb-3 space-y-1">
                    {entry.extracted_insights.map((insight, i) => (
                      <p key={i} className="text-[11px] text-foreground/60 leading-relaxed flex gap-2">
                        <span className="text-accent shrink-0">•</span>
                        {insight}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
