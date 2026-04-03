import { supabase } from '@/integrations/supabase/client';

export async function auditLog(
  action: string,
  entityType: string,
  entityId: string | null,
  actorId: string,
  details: Record<string, unknown> = {},
) {
  try {
    await supabase.from('audit_log').insert({
      action,
      entity_type: entityType,
      entity_id: entityId,
      actor_id: actorId,
      details,
    });
  } catch {
    // Non-blocking — never fail the main operation
  }
}
