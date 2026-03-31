import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/AppLayout';
import { ContentStatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Search, CalendarIcon, AlertCircle } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Content } from '@/types';
import { STATUS_LABELS, PLATFORM_LABELS } from '@/types';

export default function ContentsPage() {
  const [contents, setContents] = useState<Content[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [platformFilter, setPlatformFilter] = useState<string>('all');
  const [scheduleFilter, setScheduleFilter] = useState<string>('all');
  const navigate = useNavigate();

  useEffect(() => {
    fetchContents();
  }, []);

  const fetchContents = async () => {
    const { data } = await supabase
      .from('contents')
      .select('*')
      .order('scheduled_datetime', { ascending: true, nullsFirst: false });
    if (data) setContents(data as Content[]);
  };

  const filtered = contents.filter((c) => {
    const matchSearch = c.title.toLowerCase().includes(search.toLowerCase()) ||
      c.theme.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || c.status === statusFilter;
    const matchPlatform = platformFilter === 'all' || c.platform === platformFilter;
    const matchSchedule = scheduleFilter === 'all' ||
      (scheduleFilter === 'scheduled' && c.scheduled_datetime) ||
      (scheduleFilter === 'unscheduled' && !c.scheduled_datetime);
    return matchSearch && matchStatus && matchPlatform && matchSchedule;
  });

  // Sort: unscheduled first (warning), then by scheduled_datetime
  const sorted = [...filtered].sort((a, b) => {
    if (!a.scheduled_datetime && b.scheduled_datetime) return -1;
    if (a.scheduled_datetime && !b.scheduled_datetime) return 1;
    if (a.scheduled_datetime && b.scheduled_datetime) {
      return a.scheduled_datetime.localeCompare(b.scheduled_datetime);
    }
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold">Conteúdos</h1>
            <p className="text-sm text-muted-foreground mt-1">Gerencie todos os conteúdos da marca</p>
          </div>
          <Button onClick={() => navigate('/contents/new')} className="bg-accent text-accent-foreground hover:bg-accent/90">
            <Plus className="h-4 w-4 mr-2" />
            Novo Conteúdo
          </Button>
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por título ou tema..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
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
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Plataforma" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas plataformas</SelectItem>
              {Object.entries(PLATFORM_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={scheduleFilter} onValueChange={setScheduleFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Agendamento" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="scheduled">Agendados</SelectItem>
              <SelectItem value="unscheduled">Sem agendamento</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="glass-card rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Título</TableHead>
                <TableHead>Plataforma</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Agendamento</TableHead>
                <TableHead>Criado em</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Nenhum conteúdo encontrado
                  </TableCell>
                </TableRow>
              ) : (
                sorted.map((c) => (
                  <TableRow
                    key={c.id}
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => navigate(`/contents/${c.id}`)}
                  >
                    <TableCell className="font-medium">{c.title}</TableCell>
                    <TableCell>{PLATFORM_LABELS[c.platform]}</TableCell>
                    <TableCell><ContentStatusBadge status={c.status} /></TableCell>
                    <TableCell>
                      {c.scheduled_datetime ? (
                        <div className="flex items-center gap-1.5">
                          <CalendarIcon className="h-3.5 w-3.5 text-accent" />
                          <span className="text-sm">
                            {format(parseISO(c.scheduled_datetime), "dd/MM · HH:mm")}
                          </span>
                        </div>
                      ) : (
                        <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30 text-[10px]">
                          <AlertCircle className="h-3 w-3 mr-1" />
                          Sem data
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(c.created_at).toLocaleDateString('pt-BR')}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </AppLayout>
  );
}
