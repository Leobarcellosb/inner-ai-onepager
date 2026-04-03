import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useContents } from '@/hooks/useContents';
import { Brain, AlertTriangle, Info, AlertCircle, ChevronDown, ChevronUp, X, RefreshCw } from 'lucide-react';

const SEVERITY_CONFIG = {
  critical: { icon: AlertCircle, color: 'hsl(0 72% 51%)', bg: 'hsl(0 72% 51% / 0.06)', border: 'hsl(0 72% 51% / 0.2)' },
  warning:  { icon: AlertTriangle, color: 'hsl(38 90% 50%)', bg: 'hsl(38 90% 50% / 0.06)', border: 'hsl(38 90% 50% / 0.2)' },
  info:     { icon: Info, color: 'hsl(217 88% 58%)', bg: 'hsl(217 88% 58% / 0.06)', border: 'hsl(217 88% 58% / 0.2)' },
};

interface Alert {
  type: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  description: string;
  action: string;
}

// Generate a stable key for dedup/dismiss
function alertKey(a: Alert): string {
  return `${a.type}:${a.title.slice(0, 30)}`;
}

export function BrainAlerts({ compact }: { compact?: boolean }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  // Re-fetch alerts when contents change (auto-resolve)
  const { data: contents } = useContents();
  const contentsHash = contents?.length ?? 0;

  const { data, isFetching } = useQuery<Alert[]>({
    queryKey: ['brain-alerts', contentsHash],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase.functions.invoke('brain-alerts');
      if (error) return [];
      return (data?.alerts ?? []) as Alert[];
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  const alerts = useMemo(() => {
    const raw = data ?? [];
    return raw.filter(a => !dismissed.has(alertKey(a)));
  }, [data, dismissed]);

  const handleDismiss = (alert: Alert) => {
    setDismissed(prev => new Set(prev).add(alertKey(alert)));
  };

  const handleRefresh = () => {
    setDismissed(new Set());
    queryClient.invalidateQueries({ queryKey: ['brain-alerts'] });
  };

  if (alerts.length === 0 && !isFetching) return null;

  const critical = alerts.filter(a => a.severity === 'critical').length;
  const warning = alerts.filter(a => a.severity === 'warning').length;
  const limit = compact ? 2 : 3;
  const shown = expanded ? alerts : alerts.slice(0, limit);

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="h-3.5 w-3.5 text-accent" />
          <span className="text-[11px] font-semibold text-foreground/70">
            Alertas do Cérebro
          </span>
          {critical > 0 && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'hsl(0 72% 51% / 0.12)', color: 'hsl(0 72% 51%)' }}>
              {critical} crítico{critical > 1 ? 's' : ''}
            </span>
          )}
          {warning > 0 && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'hsl(38 90% 50% / 0.12)', color: 'hsl(38 90% 50%)' }}>
              {warning}
            </span>
          )}
          {isFetching && <RefreshCw className="h-3 w-3 animate-spin text-muted-foreground/40" />}
        </div>
        <div className="flex items-center gap-1">
          {dismissed.size > 0 && (
            <button onClick={handleRefresh} className="text-[9px] text-muted-foreground hover:text-foreground" title="Recarregar alertas">
              <RefreshCw className="h-3 w-3" />
            </button>
          )}
          {alerts.length > limit && (
            <button onClick={() => setExpanded(!expanded)} className="text-[9px] text-muted-foreground hover:text-foreground flex items-center gap-0.5">
              {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {expanded ? 'Menos' : `+${alerts.length - limit}`}
            </button>
          )}
        </div>
      </div>

      {/* Alerts */}
      {shown.map((alert, i) => {
        const cfg = SEVERITY_CONFIG[alert.severity] || SEVERITY_CONFIG.info;
        const Icon = cfg.icon;
        return (
          <div
            key={alertKey(alert)}
            className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg group transition-opacity"
            style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}
          >
            <Icon className="h-3.5 w-3.5 shrink-0 mt-0.5" style={{ color: cfg.color }} />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-medium" style={{ color: cfg.color }}>{alert.title}</p>
              <p className="text-[10px] text-foreground/60 mt-0.5 leading-relaxed">{alert.description}</p>
              <p className="text-[9px] mt-1 font-medium" style={{ color: cfg.color }}>→ {alert.action}</p>
            </div>
            <button
              onClick={() => handleDismiss(alert)}
              className="shrink-0 p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white/10"
              title="Dispensar alerta"
            >
              <X className="h-3 w-3 text-muted-foreground" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
