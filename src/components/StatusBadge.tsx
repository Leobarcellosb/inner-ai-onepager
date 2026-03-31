import { Badge } from '@/components/ui/badge';
import { ContentStatus, BriefStatus, STATUS_LABELS, BRIEF_STATUS_LABELS, STATUS_COLORS, BRIEF_STATUS_COLORS } from '@/types';

export function ContentStatusBadge({ status }: { status: ContentStatus }) {
  return (
    <Badge variant="secondary" className={`${STATUS_COLORS[status]} border-0 font-medium text-xs`}>
      {STATUS_LABELS[status]}
    </Badge>
  );
}

export function BriefStatusBadge({ status }: { status: BriefStatus }) {
  return (
    <Badge variant="secondary" className={`${BRIEF_STATUS_COLORS[status]} border-0 font-medium text-xs`}>
      {BRIEF_STATUS_LABELS[status]}
    </Badge>
  );
}
