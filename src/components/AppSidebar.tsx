import { useLocation, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  LayoutDashboard,
  FileText,
  PenTool,
  CalendarDays,
  Brain,
  LogOut,
  Palette,
  CheckCircle,
  Workflow,
  Settings,
  Lightbulb,
  Film,
  Upload,
  Zap,
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';

import { isAdmin, isOperator } from '@/lib/permissions';
import { useI18n } from '@/lib/i18n';
import type { AppRole } from '@/types';

interface NavItem {
  titleKey: string;
  url: string;
  icon: React.ElementType;
}

function getOverviewItems(roles: AppRole[]): NavItem[] {
  const items: NavItem[] = [
    { titleKey: 'nav.dashboard', url: '/dashboard', icon: LayoutDashboard },
    { titleKey: 'nav.pipeline', url: '/pipeline', icon: Workflow },
    { titleKey: 'nav.planning', url: '/calendar', icon: CalendarDays },
  ];
  if (isAdmin(roles)) items.push({ titleKey: 'nav.autopilot', url: '/autopilot', icon: Zap });
  return items;
}

function getOperationItems(roles: AppRole[]): NavItem[] {
  const items: NavItem[] = [
    { titleKey: 'nav.contents', url: '/contents', icon: FileText },
    { titleKey: 'nav.production', url: '/production', icon: Palette },
  ];
  if (isOperator(roles)) {
    items.splice(0, 0, { titleKey: 'nav.import', url: '/import', icon: Upload });
    items.push({ titleKey: 'nav.approval', url: '/approval', icon: CheckCircle });
    items.push({ titleKey: 'nav.briefs', url: '/briefs', icon: PenTool });
  }
  return items;
}

function getIntelligenceItems(roles: AppRole[]): NavItem[] {
  const items: NavItem[] = [];
  if (isOperator(roles)) {
    items.push({ titleKey: 'nav.brain', url: '/brain', icon: Brain });
    items.push({ titleKey: 'nav.ideas', url: '/ideas', icon: Lightbulb });
    items.push({ titleKey: 'nav.stories', url: '/stories', icon: Film });
  }
  if (isAdmin(roles)) {
    items.push({ titleKey: 'nav.users', url: '/users', icon: Settings });
  }
  return items;
}

function NavGroup({ label, items }: { label: string; items: NavItem[] }) {
  const location = useLocation();
  const { t } = useI18n();
  return (
    <SidebarGroup>
      <SidebarGroupLabel className="text-sidebar-foreground/40 text-[10px] uppercase tracking-[0.12em] font-semibold px-3">
        {label}
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => {
            const title = t(item.titleKey);
            const isActive = location.pathname.startsWith(item.url);
            return (
              <SidebarMenuItem key={item.titleKey}>
                <SidebarMenuButton
                  asChild
                  isActive={isActive}
                  tooltip={title}
                  className={
                    isActive
                      ? 'text-sidebar-primary bg-sidebar-accent font-medium'
                      : 'text-sidebar-foreground hover:text-sidebar-primary hover:bg-sidebar-accent/60'
                  }
                >
                  <Link to={item.url}>
                    <item.icon className="h-4 w-4" />
                    <span>{title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const { signOut, profile, roles } = useAuth();
  const { t } = useI18n();

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarContent className="bg-sidebar">
        {/* Brand */}
        <div className="flex items-center gap-2.5 px-3 py-4 mb-1">
          <img
            src="/icon-inner-ai.png"
            alt="Inner AI"
            className="h-8 w-8 shrink-0 rounded-lg object-cover"
            draggable={false}
          />
          {!collapsed && (
            <span className="font-display text-base font-bold tracking-tight text-sidebar-primary select-none">
              Inner AI
            </span>
          )}
        </div>

        <NavGroup label={t('nav.overview')} items={getOverviewItems(roles)} />
        <NavGroup label={t('nav.operation')} items={getOperationItems(roles)} />
        {getIntelligenceItems(roles).length > 0 && (
          <NavGroup label={t('nav.strategy')} items={getIntelligenceItems(roles)} />
        )}
      </SidebarContent>

      <SidebarFooter className="bg-sidebar border-t border-sidebar-border">
        <div className="flex items-center gap-3 px-2 py-2">
          <Link to="/settings"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white hover:ring-2 hover:ring-accent/50 transition-all"
            style={{ background: 'hsl(258 82% 55%)' }}
          >
            {profile?.name?.charAt(0)?.toUpperCase() || 'U'}
          </Link>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-sidebar-primary truncate leading-tight">
                {profile?.name || 'Usuário'}
              </p>
              <div className="flex items-center gap-1 mt-0.5">
                <p className="text-[11px] text-sidebar-foreground truncate">
                  {profile?.email}
                </p>
                {isAdmin(roles) && (
                  <span className="text-[8px] font-bold px-1 py-0.5 rounded" style={{ background: 'hsl(258 82% 64% / 0.2)', color: 'hsl(258 82% 64%)' }}>ADM</span>
                )}
              </div>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={signOut}
            className="shrink-0 text-sidebar-foreground hover:text-sidebar-primary hover:bg-sidebar-accent h-8 w-8"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
