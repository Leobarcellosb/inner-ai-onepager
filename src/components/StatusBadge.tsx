import { Badge } from '@/components/ui/badge';
import { useI18n } from '@/lib/i18n';
import { ContentStatus, BriefStatus, STATUS_COLORS, BRIEF_STATUS_COLORS } from '@/types';

export function ContentStatusBadge({ status }: { status: ContentStatus }) {
  const { t } = useI18n();
  return (
    <Badge variant="secondary" className={`${STATUS_COLORS[status]} border-0 font-medium text-xs`}>
      {t(`status.${status}`)}
    </Badge>
  );
}

export function BriefStatusBadge({ status }: { status: BriefStatus }) {
  const { t } = useI18n();
  return (
    <Badge variant="secondary" className={`${BRIEF_STATUS_COLORS[status]} border-0 font-medium text-xs`}>
      {t(`brief.${status}`)}
    </Badge>
  );
}
