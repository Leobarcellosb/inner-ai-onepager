import { supabase } from '@/integrations/supabase/client';

export async function createNotification(
  userId: string,
  contentId: string | null,
  message: string,
) {
  if (!userId) return;
  await supabase.from('notifications').insert({
    user_id: userId,
    content_id: contentId,
    message,
    read: false,
  });
}

export async function notifyStatusChange(
  contentId: string,
  contentTitle: string,
  newStatus: string,
  assignedTo: string | null,
  createdBy: string,
  currentUserId: string,
) {
  // Notify the other party about the status change
  const statusLabels: Record<string, string> = {
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

  const label = statusLabels[newStatus] ?? newStatus;
  const msg = `"${contentTitle}" movido para ${label}`;

  // Notify designer when entering design stages
  if (['design_queue', 'designing'].includes(newStatus) && assignedTo && assignedTo !== currentUserId) {
    await createNotification(assignedTo, contentId, msg);
  }

  // Notify content creator on review/approval/publish milestones
  if (['final_review', 'approved', 'scheduled', 'published'].includes(newStatus) && createdBy !== currentUserId) {
    await createNotification(createdBy, contentId, msg);
  }
}
