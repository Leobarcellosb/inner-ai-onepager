import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Users, Shield, UserCog, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { isAdmin } from '@/lib/permissions';
import { UserAvatar } from '@/components/UserAvatar';
import type { AppRole } from '@/types';

const ROLE_CONFIG: Record<string, { label: string; color: string }> = {
  admin:        { label: 'Admin',        color: 'hsl(258 82% 64%)' },
  operator:     { label: 'Operador',     color: 'hsl(217 88% 58%)' },
  social_media: { label: 'Social Media', color: 'hsl(38 90% 50%)' },
  designer:     { label: 'Designer',     color: 'hsl(142 60% 42%)' },
};

interface UserWithRoles {
  id: string;
  name: string;
  email: string;
  created_at: string;
  roles: string[];
}

export default function UsersPage() {
  const { user, roles } = useAuth();
  const queryClient = useQueryClient();
  const [updating, setUpdating] = useState<string | null>(null);

  const { data: users = [], isLoading } = useQuery<UserWithRoles[]>({
    queryKey: ['admin', 'users'],
    queryFn: async () => {
      const { data: profiles } = await supabase.from('profiles').select('id, name, email, avatar_url, created_at').order('created_at', { ascending: true });
      if (!profiles) return [];

      const { data: allRoles } = await supabase.from('user_roles').select('user_id, role');
      const roleMap: Record<string, string[]> = {};
      (allRoles ?? []).forEach((r: any) => {
        (roleMap[r.user_id] ??= []).push(r.role);
      });

      return profiles.map((p: any) => ({
        id: p.id,
        name: p.name || '',
        email: p.email || '',
        created_at: p.created_at,
        roles: roleMap[p.id] ?? [],
      }));
    },
    enabled: isAdmin(roles),
  });

  const handleToggleRole = async (userId: string, role: AppRole, hasIt: boolean) => {
    if (userId === user?.id && role === 'admin') {
      toast.error('Você não pode remover seu próprio papel de admin.');
      return;
    }
    setUpdating(userId);
    try {
      if (hasIt) {
        await supabase.from('user_roles').delete().eq('user_id', userId).eq('role', role);
        toast.success(`Role "${role}" removida`);
      } else {
        await supabase.from('user_roles').insert({ user_id: userId, role });
        toast.success(`Role "${role}" atribuída`);
      }
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    } catch (e: any) {
      toast.error(e.message || 'Erro ao atualizar role');
    } finally {
      setUpdating(null);
    }
  };

  if (!isAdmin(roles)) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20">
          <p className="text-sm text-muted-foreground">Acesso restrito a administradores.</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight flex items-center gap-2">
            <Users className="h-6 w-6 text-accent" />
            Gestão de Usuários
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie roles e permissões do time
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-2">
            {users.map((u) => (
              <div
                key={u.id}
                className="rounded-xl overflow-hidden bg-card border border-border"
              >
                <div className="flex items-center justify-between px-5 py-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <UserAvatar src={u.avatar_url} name={u.name} size="md" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground/90 truncate">
                        {u.name || 'Sem nome'}
                        {u.id === user?.id && <span className="text-[9px] text-muted-foreground ml-1">(você)</span>}
                      </p>
                      <p className="text-[11px] text-muted-foreground truncate">{u.email}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {/* Current roles */}
                    {u.roles.length === 0 && (
                      <span className="text-[10px] text-muted-foreground/50">sem role</span>
                    )}
                    {u.roles.map((r) => {
                      const cfg = ROLE_CONFIG[r] || { label: r, color: 'hsl(240 5% 50%)' };
                      return (
                        <Badge
                          key={r}
                          className="text-[9px] font-bold cursor-pointer"
                          style={{ background: `${cfg.color}15`, color: cfg.color, border: 'none' }}
                          onClick={() => handleToggleRole(u.id, r as AppRole, true)}
                          title={`Clique para remover "${cfg.label}"`}
                        >
                          {cfg.label} ×
                        </Badge>
                      );
                    })}

                    {/* Add role buttons */}
                    {updating === u.id ? (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    ) : (
                      <div className="flex gap-1">
                        {!u.roles.includes('admin') && (
                          <button
                            onClick={() => handleToggleRole(u.id, 'admin', false)}
                            className="p-1 rounded hover:bg-white/5 text-muted-foreground hover:text-accent"
                            title="Promover a Admin"
                          >
                            <Shield className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {!u.roles.includes('operator') && (
                          <button
                            onClick={() => handleToggleRole(u.id, 'operator', false)}
                            className="p-1 rounded hover:bg-white/5 text-muted-foreground hover:text-info"
                            title="Atribuir Operador"
                          >
                            <UserCog className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
