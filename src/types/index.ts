export type ContentStatus = 'idea' | 'writing' | 'copy_review' | 'copy_approved' | 'design_queue' | 'designing' | 'final_review' | 'approved' | 'scheduled' | 'published';
export type ContentPriority = 'low' | 'medium' | 'high' | 'urgent';
export type ContentPlatform = 'instagram' | 'tiktok' | 'youtube' | 'linkedin' | 'whatsapp' | 'multiuso';
export type ContentFormat = 'reels' | 'carrossel' | 'story' | 'post_estatico' | 'anuncio' | 'email' | 'roteiro';
export type BriefStatus = 'novo' | 'em_andamento' | 'em_ajuste' | 'finalizado';
export type AppRole = 'admin' | 'operator' | 'social_media' | 'designer';

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
  scheduled_date: string | null;
  scheduled_time: string | null;
  scheduled_datetime: string | null;
  posting_timezone: string;
  figma_link: string | null;
  parent_content_id: string | null;
  current_stage_owner: string | null;
  copy_reviewer_id: string | null;
  designer_id: string | null;
  final_approver_id: string | null;
  approved_copy_at: string | null;
  sent_to_design_at: string | null;
  design_started_at: string | null;
  final_approved_at: string | null;
  published_at: string | null;
  priority: ContentPriority;
  content_type: string;
  carousel_script: Record<string, unknown> | null;
  carousel_slide_count: number | null;
  copy_auto_approved: boolean;
  copy_auto_approved_by: string | null;
  copy_auto_approved_at: string | null;
  source_origin: string;
  profiles?: Profile;
}

export interface CompanyLearnings {
  hooks: string[];
  copy_patterns: string[];
  visual_patterns: string[];
  structures: string[];
  ctas: string[];
}

export interface CompanyConfig {
  id: string;
  company_id: string;
  icp_json: Record<string, unknown>;
  editorial_guidelines_json: Record<string, unknown>;
  voice_tone_json: Record<string, unknown>;
  rules_json: Record<string, unknown>;
  learnings_json: CompanyLearnings;
  updated_at: string;
}

export interface BrainMemory {
  id: string;
  memory_type: 'approval' | 'rejection' | 'optimization' | 'performance' | 'insight';
  content_id: string | null;
  context: Record<string, unknown>;
  created_by: string;
  created_at: string;
}

export interface KnowledgeEntry {
  id: string;
  title: string;
  source_type: string;
  content_text: string;
  extracted_insights: string[];
  tags: string[];
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  content_id: string | null;
  message: string;
  read: boolean;
  created_at: string;
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

// Statuses that require scheduling
export const STATUSES_REQUIRING_SCHEDULE: ContentStatus[] = ['scheduled', 'published'];

export const STATUS_LABELS: Record<ContentStatus, string> = {
  idea: 'Ideia',
  writing: 'Escrita',
  copy_review: 'Revisão de Copy',
  copy_approved: 'Copy Aprovada',
  design_queue: 'Fila de Design',
  designing: 'Em Design',
  final_review: 'Revisão Final',
  approved: 'Aprovado',
  scheduled: 'Agendado',
  published: 'Publicado',
};

export const PRIORITY_LABELS: Record<ContentPriority, string> = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
  urgent: 'Urgente',
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
  idea: 'bg-muted text-muted-foreground',
  writing: 'bg-info/10 text-info',
  copy_review: 'bg-warning/10 text-warning',
  copy_approved: 'bg-success/10 text-success',
  design_queue: 'bg-accent/10 text-accent',
  designing: 'bg-accent/10 text-accent',
  final_review: 'bg-warning/10 text-warning',
  approved: 'bg-success/10 text-success',
  scheduled: 'bg-info/10 text-info',
  published: 'bg-primary/10 text-primary',
};

export const BRIEF_STATUS_COLORS: Record<BriefStatus, string> = {
  novo: 'bg-info/10 text-info',
  em_andamento: 'bg-warning/10 text-warning',
  em_ajuste: 'bg-destructive/10 text-destructive',
  finalizado: 'bg-success/10 text-success',
};
