import { IxPill } from '@siemens/ix-react';
import { iconCalendar, iconCheck, iconPause, iconPlay, iconSearch } from '@siemens/ix-icons/icons';
import type { OrderStatus } from '../../shared/schema';
import { STATUS_LABELS } from '../../shared/workflow';

type PillVariant = 'neutral' | 'info' | 'primary' | 'success' | 'warning';

// Status is shown with color, icon and text, so it never relies on color alone.
const STATUS_STYLE: Record<OrderStatus, { variant: PillVariant; icon: string }> = {
  planned: { variant: 'neutral', icon: iconCalendar },
  in_progress: { variant: 'info', icon: iconPlay },
  quality_check: { variant: 'primary', icon: iconSearch },
  completed: { variant: 'success', icon: iconCheck },
  on_hold: { variant: 'warning', icon: iconPause },
};

export function StatusPill({ status }: { status: OrderStatus }) {
  const { variant, icon } = STATUS_STYLE[status];
  return (
    <IxPill variant={variant} icon={icon} outline>
      {STATUS_LABELS[status]}
    </IxPill>
  );
}
