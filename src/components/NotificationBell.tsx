import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Bell } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import type { Notification } from '@/types';

export function NotificationBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);

  // Only start fetching after user opens the popover once, or after 10s idle
  const shouldFetch = !!user && hasOpened;

  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: ['notifications', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);
      return (data ?? []) as Notification[];
    },
    enabled: shouldFetch,
    refetchInterval: shouldFetch ? 2 * 60 * 1000 : false,
    staleTime: 60 * 1000,
  });

  // Lightweight count-only query for the badge (runs on mount, minimal payload)
  const { data: unreadCount = 0 } = useQuery<number>({
    queryKey: ['notifications', 'count', user?.id],
    queryFn: async () => {
      if (!user) return 0;
      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('read', false);
      return count ?? 0;
    },
    enabled: !!user,
    refetchInterval: 2 * 60 * 1000,
    staleTime: 30 * 1000,
  });

  const handleOpen = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen && !hasOpened) setHasOpened(true);
  };

  const markAllRead = async () => {
    if (!user) return;
    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', user.id)
      .eq('read', false);
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
  };

  const handleClick = (n: Notification) => {
    supabase.from('notifications').update({ read: true }).eq('id', n.id).then(() => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    });
    setOpen(false);
    if (n.content_id) navigate(`/contents/${n.content_id}`);
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'agora';
    if (mins < 60) return `${mins}min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    return `${Math.floor(hours / 24)}d`;
  };

  return (
    <Popover open={open} onOpenChange={handleOpen}>
      <PopoverTrigger asChild>
        <button className="relative flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span
              className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full text-[9px] font-bold text-white px-1"
              style={{ background: 'hsl(0 72% 51%)' }}
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-80 p-0 border-border/80"
        style={{ background: 'hsl(240 13% 7%)' }}
      >
        <div
          className="flex items-center justify-between px-4 py-3"
          style={{ borderBottom: '1px solid hsl(240 11% 13%)' }}
        >
          <span className="text-sm font-semibold">Notificações</span>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="text-[10px] font-medium text-accent hover:underline"
            >
              Marcar todas como lidas
            </button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Nenhuma notificação
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                onClick={() => handleClick(n)}
                className="flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-white/5"
                style={{
                  borderBottom: '1px solid hsl(240 11% 11%)',
                  background: n.read ? undefined : 'hsl(258 82% 64% / 0.04)',
                }}
              >
                {!n.read && (
                  <span
                    className="mt-1.5 h-2 w-2 rounded-full shrink-0"
                    style={{ background: 'hsl(258 82% 64%)' }}
                  />
                )}
                <div className={`flex-1 min-w-0 ${n.read ? 'ml-5' : ''}`}>
                  <p className="text-xs text-foreground/85 leading-relaxed">{n.message}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">{timeAgo(n.created_at)}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
