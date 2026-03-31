export type ContentStatus = 'ideia' | 'rascunho' | 'em_revisao' | 'aguardando_design' | 'em_design' | 'pronto' | 'publicado';
export type ContentPlatform = 'instagram' | 'tiktok' | 'youtube' | 'linkedin' | 'whatsapp' | 'multiuso';
export type ContentFormat = 'reels' | 'carrossel' | 'story' | 'post_estatico' | 'anuncio' | 'email' | 'roteiro';
export type BriefStatus = 'novo' | 'em_andamento' | 'em_ajuste' | 'finalizado';
export type AppRole = 'admin' | 'social_media' | 'designer';

export interface Profile {
  id: string;
  name: string;
  email: string;
  avatar_url?: string;
  created_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
}

export interface Content {
  id: string;
  title: string;
  theme: string;
  platform: ContentPlatform;
  format: ContentFormat;
  objective: string;
  target_audience: string;
  funnel_stage: string;
  raw_text: string;
  improved_text: string | null;
  cta: string;
  status: ContentStatus;
  assigned_to: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  profiles?: Profile;
}

export interface Brief {
  id: string;
  content_id: string;
  brief_title: string;
  creative_angle: string;
  campaign_objective: string;
  target_audience: string;
  key_message: string;
  visual_references: string;
  visual_direction: string;
  mandatory_elements: string;
  suggested_slides_or_scenes: string;
  copy_summary: string;
  cta: string;
  designer_notes: string;
  status: BriefStatus;
  created_at: string;
  updated_at: string;
  contents?: Content;
}

export const STATUS_LABELS: Record<ContentStatus, string> = {
  ideia: 'Ideia',
  rascunho: 'Rascunho',
  em_revisao: 'Em Revisão',
  aguardando_design: 'Aguardando Design',
  em_design: 'Em Design',
  pronto: 'Pronto',
  publicado: 'Publicado',
};

export const BRIEF_STATUS_LABELS: Record<BriefStatus, string> = {
  novo: 'Novo',
  em_andamento: 'Em Andamento',
  em_ajuste: 'Em Ajuste',
  finalizado: 'Finalizado',
};

export const PLATFORM_LABELS: Record<ContentPlatform, string> = {
  instagram: 'Instagram',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  linkedin: 'LinkedIn',
  whatsapp: 'WhatsApp',
  multiuso: 'Multiuso',
};

export const FORMAT_LABELS: Record<ContentFormat, string> = {
  reels: 'Reels',
  carrossel: 'Carrossel',
  story: 'Story',
  post_estatico: 'Post Estático',
  anuncio: 'Anúncio',
  email: 'Email',
  roteiro: 'Roteiro',
};

export const STATUS_COLORS: Record<ContentStatus, string> = {
  ideia: 'bg-muted text-muted-foreground',
  rascunho: 'bg-info/10 text-info',
  em_revisao: 'bg-warning/10 text-warning',
  aguardando_design: 'bg-accent/10 text-accent',
  em_design: 'bg-info/10 text-info',
  pronto: 'bg-success/10 text-success',
  publicado: 'bg-primary/10 text-primary',
};

export const BRIEF_STATUS_COLORS: Record<BriefStatus, string> = {
  novo: 'bg-info/10 text-info',
  em_andamento: 'bg-warning/10 text-warning',
  em_ajuste: 'bg-destructive/10 text-destructive',
  finalizado: 'bg-success/10 text-success',
};
