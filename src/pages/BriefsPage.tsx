import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/AppLayout';
import { BriefStatusBadge } from '@/components/StatusBadge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BRIEF_STATUS_LABELS } from '@/types';
import type { Brief } from '@/types';

export default function BriefsPage() {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const navigate = useNavigate();

  const { data: briefs = [] } = useQuery<Brief[]>({
    queryKey: ['briefs', 'list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('briefs')
        .select('*, contents(title)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as Brief[];
    },
  });

  const filtered = briefs.filter((b) =>
    statusFilter === 'all' || b.status === statusFilter
  );

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="font-display text-2xl font-bold">Briefs</h1>
          <p className="text-sm text-muted-foreground mt-1">Briefs criativos para o time de design</p>
        </div>

        <div className="flex gap-3">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              {Object.entries(BRIEF_STATUS_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="glass-card rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Brief</TableHead>
                <TableHead>Conteúdo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Criado em</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    Nenhum brief encontrado
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((b) => (
                  <TableRow
                    key={b.id}
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => navigate(`/briefs/${b.id}`)}
                  >
                    <TableCell className="font-medium">{b.brief_title}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {(b.contents as any)?.title || '—'}
                    </TableCell>
                    <TableCell><BriefStatusBadge status={b.status} /></TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(b.created_at).toLocaleDateString('pt-BR')}
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
