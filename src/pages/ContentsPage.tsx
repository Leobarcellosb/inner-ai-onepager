import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useContents } from '@/hooks/useContents';
import { AppLayout } from '@/components/AppLayout';
import { ContentStatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Search, CalendarIcon, AlertCircle, FileText, Filter } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Content, ContentStatus } from '@/types';
import { STATUS_LABELS, PLATFORM_LABELS, FORMAT_LABELS, PRIORITY_LABELS } from '@/types';
import type { ContentPriority } from '@/types';

const PIPELINE_ORDER: ContentStatus[] = ['idea', 'writing', 'copy_review', 'copy_approved', 'design_queue', 'designing', 'final_review', 'approved', 'scheduled', 'published'];

const PRIORITY_DOT: Record<string, string> = {
  low: 'hsl(240 5% 45%)',
  medium: 'hsl(217 88% 58%)',
  high: 'hsl(38 90% 50%)',
  urgent: 'hsl(0 72% 51%)',
};

export default function ContentsPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [platformFilter, setPlatformFilter] = useState<string>('all');
  const navigate = useNavigate();

  const { data: contents = [], isLoading } = useContents();

  const filtered = useMemo(() => contents.filter((c) => {
    if (search) {
      const q = search.toLowerCase();
      if (!c.title.toLowerCase().includes(q) && !c.theme.toLowerCase().includes(q)) return false;
    }
    if (statusFilter !== 'all' && c.status !== statusFilter) return false;
    if (platformFilter !== 'all' && c.platform !== platformFilter) return false;
    return true;
  }), [contents, search, statusFilter, platformFilter]);

  const sorted = useMemo(() => [...filtered].sort((a, b) => {
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  }), [filtered]);

  // Stats
  const stats = useMemo(() => {
    const total = contents.length;
    const byStatus: Partial<Record<ContentStatus, number>> = {};
    contents.forEach(c => { byStatus[c.status] = (byStatus[c.status] ?? 0) + 1; });
    return { total, byStatus };
  }, [contents]);

  const activeFilters = (statusFilter !== 'all' ? 1 : 0) + (platformFilter !== 'all' ? 1 : 0) + (search ? 1 : 0);

  return (
    <AppLayout>
      <div className="space-y-5 animate-fade-in w-full">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight">Conteúdos</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {stats.total} conteúdo{stats.total !== 1 ? 's' : ''}
              {filtered.length !== stats.total && ` · ${filtered.length} filtrado${filtered.length !== 1 ? 's' : ''}`}
            </p>
          </div>
          <Button onClick={() => navigate('/contents/new')} style={{ background: 'hsl(258 82% 64%)', color: '#fff' }}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Conteúdo
          </Button>
        </div>

        {/* Filters */}
        <div
          className="flex items-center gap-2 flex-wrap rounded-xl px-4 py-2.5 bg-card border border-border"
        >
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-xs border-0 bg-transparent"
            />
          </div>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-8 w-[140px] text-xs border-0 bg-transparent hover:bg-white/5">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              {Object.entries(STATUS_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={platformFilter} onValueChange={setPlatformFilter}>
            <SelectTrigger className="h-8 w-[120px] text-xs border-0 bg-transparent hover:bg-white/5">
              <SelectValue placeholder="Plataforma" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {Object.entries(PLATFORM_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {activeFilters > 0 && (
            <button
              onClick={() => { setSearch(''); setStatusFilter('all'); setPlatformFilter('all'); }}
              className="text-[10px] font-semibold px-2 py-1 rounded-md transition-colors"
              style={{ color: 'hsl(0 70% 55%)', background: 'hsl(0 70% 55% / 0.1)' }}
            >
              Limpar ({activeFilters})
            </button>
          )}
        </div>

        {/* Content list */}
        <div className="space-y-1.5">
          {isLoading ? (
            <div className="text-center py-16 text-sm text-muted-foreground">Carregando...</div>
          ) : sorted.length === 0 ? (
            <div
              className="rounded-xl p-12 text-center bg-card border border-border"
            >
              <FileText className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                {contents.length === 0 ? 'Nenhum conteúdo criado ainda' : 'Nenhum resultado para os filtros aplicados'}
              </p>
            </div>
          ) : (
            sorted.map((c) => {
              const priority = (c as any).priority as ContentPriority | undefined;
              const pipelinePos = PIPELINE_ORDER.indexOf(c.status) + 1;
              const hasText = !!(c.raw_text?.trim() || c.improved_text?.trim());
              return (
                <div
                  key={c.id}
                  className="rounded-xl cursor-pointer transition-all hover:brightness-110 bg-card border border-border"
                  onClick={() => navigate(`/contents/${c.id}`)}
                >
                  <div className="flex items-center gap-4 px-5 py-4">
                    {/* Priority dot */}
                    <div className="shrink-0 w-3">
                      {priority && (
                        <span
                          className="block h-2.5 w-2.5 rounded-full"
                          style={{ background: PRIORITY_DOT[priority] }}
                          title={PRIORITY_LABELS[priority]}
                        />
                      )}
                    </div>

                    {/* Title + meta */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground/90 truncate">{c.title}</p>
                      <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground flex-wrap">
                        <span>{PLATFORM_LABELS[c.platform]}</span>
                        <span className="text-muted-foreground/30">·</span>
                        <span>{FORMAT_LABELS[c.format as keyof typeof FORMAT_LABELS]}</span>
                        {c.theme && (
                          <>
                            <span className="text-muted-foreground/30">·</span>
                            <span className="truncate max-w-[150px]">{c.theme}</span>
                          </>
                        )}
                        {!hasText && c.status !== 'idea' && (
                          <span className="text-warning/50">· sem texto</span>
                        )}
                      </div>
                    </div>

                    {/* Status */}
                    <div className="flex items-center gap-2 shrink-0">
                      <ContentStatusBadge status={c.status} />
                      <span className="text-[9px] text-muted-foreground/30 font-mono w-8 text-right">
                        {pipelinePos}/{PIPELINE_ORDER.length}
                      </span>
                    </div>

                    {/* Schedule */}
                    <div className="shrink-0 w-28 text-right">
                      {c.scheduled_datetime ? (
                        <div className="flex items-center gap-1.5 justify-end">
                          <CalendarIcon className="h-3 w-3 text-accent" />
                          <span className="text-xs text-foreground/70">
                            {format(parseISO(c.scheduled_datetime), "dd MMM", { locale: ptBR })}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {format(parseISO(c.scheduled_datetime), "HH:mm")}
                          </span>
                        </div>
                      ) : (
                        <span className="text-[10px] text-warning/60">sem data</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </AppLayout>
  );
}
