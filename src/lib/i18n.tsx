import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

type Lang = 'pt-BR' | 'en' | 'es';

const dictionaries: Record<Lang, Record<string, string>> = {
  'pt-BR': {
    // Sidebar
    'nav.dashboard': 'Dashboard',
    'nav.pipeline': 'Pipeline',
    'nav.planning': 'Planejamento',
    'nav.autopilot': 'Autopilot',
    'nav.import': 'Importar',
    'nav.contents': 'Conteúdos',
    'nav.production': 'Produção',
    'nav.approval': 'Aprovação',
    'nav.briefs': 'Briefs',
    'nav.brain': 'Cérebro',
    'nav.ideas': 'Ideias',
    'nav.stories': 'Stories',
    'nav.users': 'Usuários',
    'nav.settings': 'Configurações',
    'nav.overview': 'Visão geral',
    'nav.operation': 'Operação',
    'nav.strategy': 'Estratégia',

    // Auth
    'auth.login': 'Entrar',
    'auth.signup': 'Criar conta',
    'auth.logout': 'Sair da conta',
    'auth.email': 'Email',
    'auth.password': 'Senha',
    'auth.name': 'Nome',
    'auth.waiting': 'Aguarde...',
    'auth.has_account': 'Já tem conta? Entrar',
    'auth.no_account': 'Não tem conta? Criar conta',

    // Common
    'common.save': 'Salvar',
    'common.saving': 'Salvando...',
    'common.cancel': 'Cancelar',
    'common.delete': 'Excluir',
    'common.edit': 'Editar',
    'common.create': 'Criar',
    'common.back': 'Voltar',
    'common.loading': 'Carregando...',
    'common.search': 'Buscar...',
    'common.all': 'Todos',
    'common.none': 'Nenhum',
    'common.yes': 'Sim',
    'common.no': 'Não',
    'common.close': 'Fechar',
    'common.copy': 'Copiar',
    'common.copied': 'Copiado',
    'common.generate': 'Gerar',
    'common.generating': 'Gerando...',
    'common.optimize': 'Otimizar',
    'common.optimizing': 'Otimizando...',

    // Pipeline
    'status.idea': 'Ideia',
    'status.writing': 'Escrita',
    'status.copy_review': 'Revisão de Copy',
    'status.copy_approved': 'Copy Aprovada',
    'status.design_queue': 'Fila de Design',
    'status.designing': 'Em Design',
    'status.final_review': 'Revisão Final',
    'status.approved': 'Aprovado',
    'status.scheduled': 'Agendado',
    'status.published': 'Publicado',

    // Brief status
    'brief.novo': 'Novo',
    'brief.em_andamento': 'Em Andamento',
    'brief.em_ajuste': 'Em Ajuste',
    'brief.finalizado': 'Finalizado',

    // Settings
    'settings.title': 'Configurações',
    'settings.subtitle': 'Perfil, segurança e preferências',
    'settings.profile': 'Perfil',
    'settings.appearance': 'Aparência',
    'settings.language': 'Idioma',
    'settings.security': 'Segurança',
    'settings.change_password': 'Alterar senha',
    'settings.new_password': 'Nova senha',
    'settings.save_profile': 'Salvar perfil',
    'settings.member_since': 'Membro desde',
    'settings.theme_dark': 'Escuro',
    'settings.theme_light': 'Claro',
    'settings.theme_system': 'Sistema',

    // Content
    'content.new': 'Novo Conteúdo',
    'content.title': 'Título',
    'content.theme': 'Tema',
    'content.platform': 'Plataforma',
    'content.format': 'Formato',
    'content.objective': 'Objetivo',
    'content.audience': 'Público-alvo',
    'content.cta': 'CTA',
    'content.figma_link': 'Link do Figma',
    'content.raw_text': 'Texto base',
    'content.improved_text': 'Texto melhorado pela IA',
    'content.improve_ai': 'Melhorar com IA',
    'content.generate_brief': 'Gerar Brief',
    'content.schedule': 'Agendamento',
    'content.no_schedule': 'Sem agendamento',
  },

  'en': {
    'nav.dashboard': 'Dashboard',
    'nav.pipeline': 'Pipeline',
    'nav.planning': 'Planning',
    'nav.autopilot': 'Autopilot',
    'nav.import': 'Import',
    'nav.contents': 'Contents',
    'nav.production': 'Production',
    'nav.approval': 'Approval',
    'nav.briefs': 'Briefs',
    'nav.brain': 'Brain',
    'nav.ideas': 'Ideas',
    'nav.stories': 'Stories',
    'nav.users': 'Users',
    'nav.settings': 'Settings',
    'nav.overview': 'Overview',
    'nav.operation': 'Operation',
    'nav.strategy': 'Strategy',

    'auth.login': 'Sign in',
    'auth.signup': 'Create account',
    'auth.logout': 'Sign out',
    'auth.email': 'Email',
    'auth.password': 'Password',
    'auth.name': 'Name',
    'auth.waiting': 'Please wait...',
    'auth.has_account': 'Already have an account? Sign in',
    'auth.no_account': "Don't have an account? Sign up",

    'common.save': 'Save',
    'common.saving': 'Saving...',
    'common.cancel': 'Cancel',
    'common.delete': 'Delete',
    'common.edit': 'Edit',
    'common.create': 'Create',
    'common.back': 'Back',
    'common.loading': 'Loading...',
    'common.search': 'Search...',
    'common.all': 'All',
    'common.none': 'None',
    'common.yes': 'Yes',
    'common.no': 'No',
    'common.close': 'Close',
    'common.copy': 'Copy',
    'common.copied': 'Copied',
    'common.generate': 'Generate',
    'common.generating': 'Generating...',
    'common.optimize': 'Optimize',
    'common.optimizing': 'Optimizing...',

    'status.idea': 'Idea',
    'status.writing': 'Writing',
    'status.copy_review': 'Copy Review',
    'status.copy_approved': 'Copy Approved',
    'status.design_queue': 'Design Queue',
    'status.designing': 'Designing',
    'status.final_review': 'Final Review',
    'status.approved': 'Approved',
    'status.scheduled': 'Scheduled',
    'status.published': 'Published',

    'brief.novo': 'New',
    'brief.em_andamento': 'In Progress',
    'brief.em_ajuste': 'Adjusting',
    'brief.finalizado': 'Finalized',

    'settings.title': 'Settings',
    'settings.subtitle': 'Profile, security and preferences',
    'settings.profile': 'Profile',
    'settings.appearance': 'Appearance',
    'settings.language': 'Language',
    'settings.security': 'Security',
    'settings.change_password': 'Change password',
    'settings.new_password': 'New password',
    'settings.save_profile': 'Save profile',
    'settings.member_since': 'Member since',
    'settings.theme_dark': 'Dark',
    'settings.theme_light': 'Light',
    'settings.theme_system': 'System',

    'content.new': 'New Content',
    'content.title': 'Title',
    'content.theme': 'Theme',
    'content.platform': 'Platform',
    'content.format': 'Format',
    'content.objective': 'Objective',
    'content.audience': 'Target audience',
    'content.cta': 'CTA',
    'content.figma_link': 'Figma link',
    'content.raw_text': 'Base text',
    'content.improved_text': 'AI-improved text',
    'content.improve_ai': 'Improve with AI',
    'content.generate_brief': 'Generate Brief',
    'content.schedule': 'Schedule',
    'content.no_schedule': 'Not scheduled',
  },

  'es': {
    'nav.dashboard': 'Panel',
    'nav.pipeline': 'Pipeline',
    'nav.planning': 'Planificación',
    'nav.autopilot': 'Autopilot',
    'nav.import': 'Importar',
    'nav.contents': 'Contenidos',
    'nav.production': 'Producción',
    'nav.approval': 'Aprobación',
    'nav.briefs': 'Briefs',
    'nav.brain': 'Cerebro',
    'nav.ideas': 'Ideas',
    'nav.stories': 'Stories',
    'nav.users': 'Usuarios',
    'nav.settings': 'Configuración',
    'nav.overview': 'Visión general',
    'nav.operation': 'Operación',
    'nav.strategy': 'Estrategia',

    'auth.login': 'Iniciar sesión',
    'auth.signup': 'Crear cuenta',
    'auth.logout': 'Cerrar sesión',
    'auth.email': 'Email',
    'auth.password': 'Contraseña',
    'auth.name': 'Nombre',
    'auth.waiting': 'Espere...',
    'auth.has_account': '¿Ya tienes cuenta? Iniciar sesión',
    'auth.no_account': '¿No tienes cuenta? Crear cuenta',

    'common.save': 'Guardar',
    'common.saving': 'Guardando...',
    'common.cancel': 'Cancelar',
    'common.delete': 'Eliminar',
    'common.edit': 'Editar',
    'common.create': 'Crear',
    'common.back': 'Volver',
    'common.loading': 'Cargando...',
    'common.search': 'Buscar...',
    'common.all': 'Todos',
    'common.none': 'Ninguno',
    'common.yes': 'Sí',
    'common.no': 'No',
    'common.close': 'Cerrar',
    'common.copy': 'Copiar',
    'common.copied': 'Copiado',
    'common.generate': 'Generar',
    'common.generating': 'Generando...',
    'common.optimize': 'Optimizar',
    'common.optimizing': 'Optimizando...',

    'status.idea': 'Idea',
    'status.writing': 'Escritura',
    'status.copy_review': 'Revisión de Copy',
    'status.copy_approved': 'Copy Aprobada',
    'status.design_queue': 'Cola de Diseño',
    'status.designing': 'En Diseño',
    'status.final_review': 'Revisión Final',
    'status.approved': 'Aprobado',
    'status.scheduled': 'Programado',
    'status.published': 'Publicado',

    'brief.novo': 'Nuevo',
    'brief.em_andamento': 'En Progreso',
    'brief.em_ajuste': 'En Ajuste',
    'brief.finalizado': 'Finalizado',

    'settings.title': 'Configuración',
    'settings.subtitle': 'Perfil, seguridad y preferencias',
    'settings.profile': 'Perfil',
    'settings.appearance': 'Apariencia',
    'settings.language': 'Idioma',
    'settings.security': 'Seguridad',
    'settings.change_password': 'Cambiar contraseña',
    'settings.new_password': 'Nueva contraseña',
    'settings.save_profile': 'Guardar perfil',
    'settings.member_since': 'Miembro desde',
    'settings.theme_dark': 'Oscuro',
    'settings.theme_light': 'Claro',
    'settings.theme_system': 'Sistema',

    'content.new': 'Nuevo Contenido',
    'content.title': 'Título',
    'content.theme': 'Tema',
    'content.platform': 'Plataforma',
    'content.format': 'Formato',
    'content.objective': 'Objetivo',
    'content.audience': 'Público objetivo',
    'content.cta': 'CTA',
    'content.figma_link': 'Enlace de Figma',
    'content.raw_text': 'Texto base',
    'content.improved_text': 'Texto mejorado por IA',
    'content.improve_ai': 'Mejorar con IA',
    'content.generate_brief': 'Generar Brief',
    'content.schedule': 'Programación',
    'content.no_schedule': 'Sin programar',
  },
};

interface I18nContextType {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextType>({
  lang: 'pt-BR',
  setLang: () => {},
  t: (key) => key,
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    const stored = localStorage.getItem('inner-lang');
    return (stored === 'en' || stored === 'es') ? stored : 'pt-BR';
  });

  const setLang = useCallback((newLang: Lang) => {
    setLangState(newLang);
    localStorage.setItem('inner-lang', newLang);
  }, []);

  const t = useCallback((key: string): string => {
    return dictionaries[lang]?.[key] ?? dictionaries['pt-BR']?.[key] ?? key;
  }, [lang]);

  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
