import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Upload,
  FileText,
  Loader2,
  Check,
  AlertCircle,
  CalendarDays,
  Pencil,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { ensureScheduledDate, ensureScheduledTime } from '@/lib/pipeline';
import { PLATFORM_LABELS, FORMAT_LABELS, STATUS_LABELS } from '@/types';
import type { ContentStatus } from '@/types';
import * as XLSX from 'xlsx';
import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

const VALID_PLATFORMS = new Set(Object.keys(PLATFORM_LABELS));
const VALID_FORMATS = new Set(Object.keys(FORMAT_LABELS));

interface ImportItem {
  title: string;
  date: string | null;
  time: string | null;
  platform: string;
  format: string;
  theme: string;
  objective: string;
  raw_text: string;
  responsible: string;
  status: ContentStatus;
  _selected: boolean;
  _editing: boolean;
}

function inferStatus(item: Omit<ImportItem, '_selected' | '_editing' | 'status'>, preApproved: boolean): ContentStatus {
  if (preApproved) return 'design_queue';
  if (item.raw_text && item.raw_text.length > 50) return 'writing';
  if (item.title && item.date) return 'idea';
  return 'idea';
}

// ── File parsers ────────────────────────────────────────────────────────

function parseCSV(text: string): string {
  const lines = text.split('\n').filter(l => l.trim());
  if (lines.length < 2) return text;
  return lines.map((line, i) => {
    if (i === 0) return `COLUNAS: ${line}`;
    return line;
  }).join('\n');
}

function parseXLSX(buffer: ArrayBuffer): string {
  const wb = XLSX.read(buffer, { type: 'array' });
  const rows: string[] = [];
  for (const name of wb.SheetNames) {
    const sheet = wb.Sheets[name];
    const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
    if (data.length === 0) continue;
    rows.push(`=== Aba: ${name} ===`);
    const headers = Object.keys(data[0]);
    rows.push(`COLUNAS: ${headers.join(' | ')}`);
    for (const row of data) {
      rows.push(headers.map(h => String(row[h] ?? '')).join(' | '));
    }
  }
  return rows.join('\n');
}

async function parseDOCX(buffer: ArrayBuffer): Promise<string> {
  const result = await mammoth.extractRawText({ arrayBuffer: buffer });
  return result.value;
}

async function parsePDF(buffer: ArrayBuffer): Promise<string> {
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const pages: string[] = [];
  const maxPages = Math.min(pdf.numPages, 30);
  for (let i = 1; i <= maxPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const text = content.items
      .map((item: any) => item.str)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (text) pages.push(text);
  }
  return pages.join('\n\n');
}

// ── Page ────────────────────────────────────────────────────────────────

export default function ImportPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [step, setStep] = useState<'upload' | 'review' | 'done'>('upload');
  const [fileName, setFileName] = useState('');
  const [rawText, setRawText] = useState('');
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState<ImportItem[]>([]);
  const [notes, setNotes] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const [preApproved, setPreApproved] = useState(false);

  const handleFile = useCallback(async (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    setFileName(file.name);

    try {
      let text = '';

      if (ext === 'pdf') {
        const buffer = await file.arrayBuffer();
        text = await parsePDF(buffer);
      } else if (ext === 'csv' || ext === 'txt') {
        text = parseCSV(await file.text());
      } else if (ext === 'xlsx' || ext === 'xls') {
        const buffer = await file.arrayBuffer();
        text = parseXLSX(buffer);
      } else if (ext === 'docx') {
        const buffer = await file.arrayBuffer();
        text = await parseDOCX(buffer);
      } else if (ext === 'json') {
        text = await file.text();
      } else {
        text = await file.text();
      }

      if (/[\x00-\x08\x0E-\x1F]/.test(text.slice(0, 500))) {
        toast.error('Formato não suportado ou arquivo corrompido.');
        return;
      }
      if (text.trim().length < 10) {
        toast.error('Não foi possível extrair conteúdo do arquivo.');
        return;
      }

      setRawText(text.slice(0, 15000));
      toast.success(`"${file.name}" carregado — ${text.length} caracteres`);
    } catch {
      toast.error('Erro ao ler arquivo — verifique o formato.');
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleParse = async () => {
    if (!rawText.trim()) { toast.error('Carregue ou cole o conteúdo primeiro.'); return; }
    setParsing(true);
    try {
      const { data, error } = await supabase.functions.invoke('parse-import', {
        body: { text: rawText, reference_date: new Date().toISOString().slice(0, 10) },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const parsed: ImportItem[] = (data.items ?? []).map((item: Record<string, string>) => {
        const base = {
          title: item.title || 'Sem título',
          date: item.date || null,
          time: item.time || null,
          platform: VALID_PLATFORMS.has(item.platform) ? item.platform : 'instagram',
          format: VALID_FORMATS.has(item.format) ? item.format : 'post_estatico',
          theme: item.theme || '',
          objective: item.objective || '',
          raw_text: item.raw_text || '',
          responsible: item.responsible || '',
        };
        return { ...base, status: inferStatus(base, preApproved), _selected: true, _editing: false };
      });

      setItems(parsed);
      setNotes(data.notes ?? '');
      setStep('review');
      toast.success(`${parsed.length} itens extraídos`);
    } catch (e: any) {
      toast.error(e.message || 'Erro ao processar');
    } finally {
      setParsing(false);
    }
  };

  const toggleItem = (idx: number) => {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, _selected: !item._selected } : item));
  };

  const toggleEdit = (idx: number) => {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, _editing: !item._editing } : item));
  };

  const updateItem = (idx: number, field: keyof ImportItem, value: string) => {
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

    const batchId = crypto.randomUUID();

    try {
      const records = selected.map(item => {
        const autoApproved = item.status === 'design_queue' || item.status === 'copy_approved';
        return {
          title: item.title,
          theme: item.theme || '',
          platform: VALID_PLATFORMS.has(item.platform) ? item.platform : 'instagram',
          format: VALID_FORMATS.has(item.format) ? item.format : 'post_estatico',
          objective: item.objective || '',
          raw_text: item.raw_text || '',
          created_by: user.id,
          status: item.status,
          priority: 'medium' as const,
          content_type: item.format || 'post',
          scheduled_date: ensureScheduledDate(item.date),
          scheduled_time: ensureScheduledTime(item.time),
          funnel_stage: `import:${batchId}`,
          source_origin: 'import',
          copy_auto_approved: autoApproved,
          copy_auto_approved_by: autoApproved ? user.id : null,
          copy_auto_approved_at: autoApproved ? new Date().toISOString() : null,
        };
      });

      const { error } = await supabase.from('contents').insert(records);
      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['contents'] });
      setSavedCount(records.length);
      setStep('done');
      toast.success(`${records.length} conteúdos importados — lote ${batchId.slice(0, 8)}`);
    } catch (e: any) {
      toast.error(e.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const selectedCount = items.filter(i => i._selected).length;

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight flex items-center gap-2">
            <Upload className="h-6 w-6 text-info" />
            Importar Planejamento
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            PDF, DOCX, XLSX, CSV ou texto — a IA interpreta e estrutura em conteúdos operacionais
          </p>
        </div>

        {/* STEP 1: Upload */}
        {step === 'upload' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Drop zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                className={`rounded-xl p-8 flex flex-col items-center justify-center text-center transition-all cursor-pointer border-2 border-dashed min-h-[220px] ${dragOver ? '' : 'bg-card border-border'}`}
                style={dragOver ? {
                  background: 'hsl(217 88% 58% / 0.05)',
                  borderColor: 'hsl(217 88% 58%)',
                } : undefined}
                onClick={() => document.getElementById('file-input')?.click()}
              >
                <FileText className={`h-10 w-10 mb-3 ${dragOver ? 'text-info' : 'text-muted-foreground/50'}`} />
                <p className="text-sm text-foreground/70">
                  {fileName ? `Arquivo: ${fileName}` : 'Arraste um arquivo ou clique para selecionar'}
                </p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  PDF, DOCX, XLSX, CSV, TXT, JSON
                </p>
                <input
                  id="file-input"
                  type="file"
                  accept=".pdf,.xlsx,.xls,.csv,.docx,.txt,.json"
                  className="hidden"
                  onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }}
                />
              </div>

              {/* Text area */}
              <div className="space-y-2 flex flex-col">
                <p className="text-xs text-muted-foreground">Ou cole diretamente:</p>
                <Textarea
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  placeholder={'Cole o planejamento aqui...\n\nEx:\nSegunda 10h - Instagram Carrossel: 5 dicas de IA\nTerça 18h - LinkedIn Post: Case de sucesso'}
                  className="flex-1 min-h-[180px] text-sm resize-y"
                />
                {rawText && (
                  <Badge variant="outline" className="text-[10px] self-start">{rawText.length} caracteres extraídos</Badge>
                )}
              </div>
            </div>

            {/* Pre-approved toggle + action */}
            <div className="flex items-center justify-between gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={preApproved}
                  onChange={(e) => setPreApproved(e.target.checked)}
                  className="h-4 w-4 rounded border-border accent-accent"
                />
                <span className="text-xs text-muted-foreground">
                  Copy pré-aprovada — enviar direto para fila de design
                </span>
              </label>
              <Button
                onClick={handleParse}
                disabled={parsing || !rawText.trim()}
                className="font-semibold px-8"
                style={{ background: 'hsl(258 82% 64%)', color: '#fff' }}
              >
                {parsing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                {parsing ? 'Extraindo com IA...' : 'Extrair conteúdos'}
              </Button>
            </div>
          </div>
        )}

        {/* STEP 2: Review + Edit */}
        {step === 'review' && (
          <div className="space-y-4">
            {notes && (
              <div
                className="flex items-start gap-2 p-3 rounded-lg text-xs"
                style={{ background: 'hsl(38 90% 50% / 0.08)', border: '1px solid hsl(38 90% 50% / 0.2)' }}
              >
                <AlertCircle className="h-3.5 w-3.5 text-warning shrink-0 mt-0.5" />
                <span className="text-warning/80">{notes}</span>
              </div>
            )}

            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {selectedCount}/{items.length} selecionados
                {fileName && <span className="ml-2 text-muted-foreground/50">de {fileName}</span>}
              </span>
              <Button variant="ghost" size="sm" onClick={() => setStep('upload')} className="text-xs">
                Voltar
              </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {items.map((item, i) => (
                <div
                  key={i}
                  className="rounded-xl overflow-hidden transition-all bg-card border border-border"
                  style={{ opacity: item._selected ? 1 : 0.4 }}
                >
                  {/* Card header */}
                  <div className="flex items-start gap-3 px-4 py-3">
                    <button
                      onClick={() => toggleItem(i)}
                      className="mt-1 shrink-0 flex h-5 w-5 items-center justify-center rounded border transition-colors"
                      style={{
                        borderColor: item._selected ? 'hsl(142 60% 42%)' : 'hsl(var(--border))',
                        background: item._selected ? 'hsl(142 60% 42%)' : 'transparent',
                      }}
                    >
                      {item._selected && <Check className="h-3 w-3 text-white" />}
                    </button>

                    <div className="flex-1 min-w-0 space-y-1">
                      <p className="text-sm font-medium text-foreground/90">{item.title}</p>
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground flex-wrap">
                        {item.date && (
                          <span className="flex items-center gap-0.5">
                            <CalendarDays className="h-3 w-3" />
                            {item.date} {item.time || ''}
                          </span>
                        )}
                        <span>{PLATFORM_LABELS[item.platform as keyof typeof PLATFORM_LABELS] ?? item.platform}</span>
                        <span className="text-muted-foreground/30">·</span>
                        <span>{FORMAT_LABELS[item.format as keyof typeof FORMAT_LABELS] ?? item.format}</span>
                        <Badge variant="outline" className="text-[8px]">{STATUS_LABELS[item.status]}</Badge>
                        {item.responsible && <span className="text-accent">@{item.responsible}</span>}
                      </div>
                      {item.raw_text && !item._editing && (
                        <p className="text-[10px] text-muted-foreground/60 line-clamp-2">{item.raw_text}</p>
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

                  {/* Inline edit */}
                  {item._editing && (
                    <div className="px-4 pb-3 space-y-2 border-t border-border">
                      <div className="grid grid-cols-2 gap-2 pt-2">
                        <div className="space-y-1">
                          <label className="text-[9px] text-muted-foreground">Título</label>
                          <Input value={item.title} onChange={(e) => updateItem(i, 'title', e.target.value)} className="h-7 text-xs" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] text-muted-foreground">Tema</label>
                          <Input value={item.theme} onChange={(e) => updateItem(i, 'theme', e.target.value)} className="h-7 text-xs" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] text-muted-foreground">Data</label>
                          <Input type="date" value={item.date ?? ''} onChange={(e) => updateItem(i, 'date', e.target.value)} className="h-7 text-xs" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] text-muted-foreground">Horário</label>
                          <Input type="time" value={item.time ?? ''} onChange={(e) => updateItem(i, 'time', e.target.value)} className="h-7 text-xs" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] text-muted-foreground">Plataforma</label>
                          <Select value={item.platform} onValueChange={(v) => updateItem(i, 'platform', v)}>
                            <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {Object.entries(PLATFORM_LABELS).map(([k, v]) => (
                                <SelectItem key={k} value={k}>{v}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] text-muted-foreground">Formato</label>
                          <Select value={item.format} onValueChange={(v) => updateItem(i, 'format', v)}>
                            <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {Object.entries(FORMAT_LABELS).map(([k, v]) => (
                                <SelectItem key={k} value={k}>{v}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] text-muted-foreground">Status inicial</label>
                          <Select value={item.status} onValueChange={(v) => updateItem(i, 'status', v)}>
                            <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="idea">Ideia</SelectItem>
                              <SelectItem value="writing">Escrita</SelectItem>
                              <SelectItem value="copy_approved">Copy aprovada</SelectItem>
                              <SelectItem value="design_queue">Fila de design</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] text-muted-foreground">Responsável</label>
                          <Input value={item.responsible} onChange={(e) => updateItem(i, 'responsible', e.target.value)} placeholder="Nome" className="h-7 text-xs" />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] text-muted-foreground">Descrição / texto base</label>
                        <Textarea value={item.raw_text} onChange={(e) => updateItem(i, 'raw_text', e.target.value)} className="min-h-[60px] text-xs resize-y" />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <Button
              onClick={handleSave}
              disabled={saving || selectedCount === 0}
              className="w-full font-semibold"
              style={{ background: 'hsl(142 60% 42%)', color: '#fff' }}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
              {saving ? 'Importando...' : `Importar ${selectedCount} conteúdo${selectedCount !== 1 ? 's' : ''} para o Pipeline`}
            </Button>
          </div>
        )}

        {/* STEP 3: Done */}
        {step === 'done' && (
          <div
            className="rounded-xl p-12 text-center bg-card border border-border"
          >
            <Check className="h-12 w-12 text-success mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-foreground mb-2">Importação concluída</h2>
            <p className="text-sm text-muted-foreground mb-6">
              {savedCount} conteúdos criados no Pipeline
            </p>
            <div className="flex gap-3 justify-center">
              <Button onClick={() => navigate('/pipeline')} style={{ background: 'hsl(258 82% 64%)', color: '#fff' }}>
                Ver no Pipeline
              </Button>
              <Button variant="outline" onClick={() => navigate('/calendar')}>
                Ver no Calendário
              </Button>
              <Button variant="ghost" onClick={() => { setStep('upload'); setRawText(''); setItems([]); setFileName(''); }}>
                Importar mais
              </Button>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
