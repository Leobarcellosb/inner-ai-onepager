import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, Shield, UserCog, Loader2, Plus, Power, Trash2 } from 'lucide-react';
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
  const [showCreate, setShowCreate] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState('operator');
  const [creating, setCreating] = useState(false);

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

  const handleManageUser = async (targetUserId: string, action: 'deactivate' | 'activate' | 'delete', userName: string) => {
    if (action === 'delete' && !confirm(`Excluir "${userName}" permanentemente? Esta ação não pode ser desfeita.`)) return;
    if (action === 'deactivate' && !confirm(`Desativar "${userName}"? O usuário não conseguirá mais fazer login.`)) return;
    setUpdating(targetUserId);
    try {
      const { data, error } = await supabase.functions.invoke('manage-user', {
        body: { action, targetUserId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const msgs = { deactivate: 'Usuário desativado', activate: 'Usuário reativado', delete: 'Usuário excluído' };
      toast.success(msgs[action]);
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    } catch (e: any) {
      toast.error(e.message || 'Erro ao gerenciar usuário');
    } finally {
      setUpdating(null);
    }
  };

  const handleCreateUser = async () => {
    if (!newEmail.trim() || !newName.trim()) { toast.error('Nome e email obrigatórios.'); return; }
    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-user', {
        body: { email: newEmail.trim(), name: newName.trim(), password: '123456', role: newRole },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`Usuário criado! Senha provisória: 123456`);
      setNewEmail(''); setNewName(''); setNewRole('operator'); setShowCreate(false);
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    } catch (e: any) {
      toast.error(e.message || 'Erro ao criar usuário');
    } finally {
      setCreating(false);
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight flex items-center gap-2">
              <Users className="h-6 w-6 text-accent" />
              Gestão de Usuários
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Gerencie roles e permissões do time
            </p>
          </div>
          <Button onClick={() => setShowCreate(!showCreate)} className="bg-accent text-white hover:bg-accent/90">
            <Plus className="h-4 w-4 mr-2" /> Criar Usuário
          </Button>
        </div>

        {showCreate && (
          <div className="rounded-xl p-5 bg-card border border-border space-y-3 animate-fade-in">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Nome</Label>
                <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nome do usuário" className="h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Email</Label>
                <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="email@empresa.com" className="h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Role</Label>
                <Select value={newRole} onValueChange={setNewRole}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="operator">Operador</SelectItem>
                    <SelectItem value="social_media">Social Media</SelectItem>
                    <SelectItem value="designer">Designer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-muted-foreground">Senha provisória: <span className="font-mono text-foreground/70">123456</span> — o usuário deve trocar no primeiro acesso</p>
              <Button onClick={handleCreateUser} disabled={creating} size="sm" className="bg-accent text-white hover:bg-accent/90">
                {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Plus className="h-3.5 w-3.5 mr-1" />}
                {creating ? 'Criando...' : 'Criar'}
              </Button>
            </div>
          </div>
        )}

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

                    {/* Add role + manage buttons */}
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
                        {u.id !== user?.id && (
                          <>
                            <button
                              onClick={() => handleManageUser(u.id, 'deactivate', u.name || u.email)}
                              className="p-1 rounded hover:bg-warning/10 text-muted-foreground/40 hover:text-warning"
                              title="Desativar usuário"
                            >
                              <Power className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleManageUser(u.id, 'delete', u.name || u.email)}
                              className="p-1 rounded hover:bg-destructive/10 text-muted-foreground/40 hover:text-destructive"
                              title="Excluir usuário"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </>
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
