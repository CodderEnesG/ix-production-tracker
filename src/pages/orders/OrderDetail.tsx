import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  IxButton,
  IxCard,
  IxCardContent,
  IxContentHeader,
  IxEmptyState,
  IxEventList,
  IxEventListItem,
  IxKeyValue,
  IxKeyValueList,
  IxNumberInput,
  IxTypography,
  IxWorkflowStep,
  IxWorkflowSteps,
  showToast,
} from '@siemens/ix-react';
import { iconPause, iconPlay, iconSearch, iconUndo } from '@siemens/ix-icons/icons';
import type { Order, OrderStatus, UpdateOrderInput } from '../../../shared/schema';
import {
  allowedTransitions,
  canReportUnits,
  isOverdue,
  nextStage,
  STAGES,
  STATUS_LABELS,
  statusBeforeHold,
  transitionError,
} from '../../../shared/workflow';
import { AsyncState } from '../../components/AsyncState';
import { StatusPill } from '../../components/StatusPill';
import { api, ApiError } from '../../lib/api';
import { formatDate, formatDateTime, PRIORITY_LABELS } from '../../lib/format';
import { useApi } from '../../lib/useApi';
import styles from './OrderDetail.module.css';

type StepStatus = 'open' | 'success' | 'done' | 'warning';

/** Visual state of each main stage, including where an on-hold order paused. */
function stepStatuses(order: Order): StepStatus[] {
  const current = order.status === 'on_hold' ? statusBeforeHold(order.history) : order.status;
  const currentIndex = STAGES.indexOf(current as (typeof STAGES)[number]);
  return STAGES.map((_, index) => {
    if (order.status === 'completed') return index === STAGES.length - 1 ? 'success' : 'done';
    if (index < currentIndex) return 'done';
    if (index === currentIndex && order.status === 'on_hold') return 'warning';
    return 'open';
  });
}

function OrderDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { data: order, error, loading, reload, setData } = useApi(signal => api.getOrder(id, signal), [id]);
  const [saving, setSaving] = useState(false);

  if (error?.status === 404) {
    return (
      <>
        <IxContentHeader headerTitle="Order not found" hasBackButton onBackButtonClick={() => navigate('/orders')} />
        <IxEmptyState
          layout="large"
          icon={iconSearch}
          header={`There is no order with the ID ${id}`}
          subHeader="It may have been created on another server instance or the link is wrong."
          action="Back to orders"
          onActionClick={() => navigate('/orders')}
        />
      </>
    );
  }

  async function update(patch: UpdateOrderInput, successMessage: string): Promise<boolean> {
    setSaving(true);
    try {
      const updated = await api.updateOrder(id, patch);
      setData(updated);
      showToast({ type: 'success', message: successMessage });
      return true;
    } catch (err) {
      const message =
        err instanceof ApiError
          ? (err.issues[0]?.message ?? err.message)
          : 'The update failed. Please try again.';
      showToast({ type: 'error', message });
      return false;
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <IxContentHeader
        headerTitle={order ? order.id : id}
        headerSubtitle={order?.product}
        hasBackButton
        onBackButtonClick={() => navigate('/orders')}
      >
        {order && <StatusPill status={order.status} />}
      </IxContentHeader>

      <AsyncState loading={loading} error={error} hasData={!!order} onRetry={reload}>
        {order && (
          // Keyed by ID so local form state resets when another order opens.
          <OrderBody key={order.id} order={order} saving={saving} onUpdate={update} />
        )}
      </AsyncState>
    </>
  );
}

type BodyProps = {
  order: Order;
  saving: boolean;
  onUpdate: (patch: UpdateOrderInput, successMessage: string) => Promise<boolean>;
};

function OrderBody({ order, saving, onUpdate }: BodyProps) {
  const [unitsDraft, setUnitsDraft] = useState<number | undefined>(undefined);
  const steps = stepStatuses(order);
  const next = nextStage(order.status);
  const nextBlocked = next ? transitionError(order, next) : null;
  const allowed = allowedTransitions(order);
  const canHold = allowed.includes('on_hold');
  const resumeTo: OrderStatus | null = order.status === 'on_hold' ? statusBeforeHold(order.history) : null;
  const canSendBack = order.status === 'quality_check';
  const reportingUnits = canReportUnits(order.status);
  const units = unitsDraft ?? order.completedQty;
  const unitsInvalid = units < 0 || units > order.quantity || !Number.isInteger(units);
  const overdue = isOverdue(order);

  return (
    <div className={styles.layout}>
      <IxCard variant="outline" passive className={styles.card}>
        <IxCardContent className={styles.cardBody}>
          <IxTypography format="h4">Progress</IxTypography>
          <IxWorkflowSteps aria-label="Order stages">
            {STAGES.map((stage, index) => (
              <IxWorkflowStep key={stage} status={steps[index]} selected={stage === order.status}>
                {STATUS_LABELS[stage]}
              </IxWorkflowStep>
            ))}
          </IxWorkflowSteps>

          <div className={styles.actions}>
            {next && (
              <IxButton
                icon={iconPlay}
                disabled={saving || nextBlocked !== null}
                loading={saving}
                onClick={() => onUpdate({ status: next }, `${order.id} moved to ${STATUS_LABELS[next]}`)}
              >
                Move to {STATUS_LABELS[next]}
              </IxButton>
            )}
            {resumeTo && (
              <IxButton
                icon={iconPlay}
                disabled={saving}
                onClick={() => onUpdate({ status: resumeTo }, `${order.id} resumed`)}
              >
                Resume ({STATUS_LABELS[resumeTo]})
              </IxButton>
            )}
            {canSendBack && (
              <IxButton
                variant="secondary"
                icon={iconUndo}
                disabled={saving}
                onClick={() => onUpdate({ status: 'in_progress' }, `${order.id} sent back to production`)}
              >
                Failed check, back to production
              </IxButton>
            )}
            {canHold && (
              <IxButton
                variant="secondary"
                icon={iconPause}
                disabled={saving}
                onClick={() => onUpdate({ status: 'on_hold' }, `${order.id} put on hold`)}
              >
                Put on hold
              </IxButton>
            )}
          </div>
          {nextBlocked && (
            <IxTypography format="body-sm" textColor="soft" className={styles.hint}>
              {nextBlocked}.
            </IxTypography>
          )}
          {order.status === 'completed' && (
            <IxTypography format="body-sm" textColor="soft" className={styles.hint}>
              This order is completed and can no longer change.
            </IxTypography>
          )}

          <form
            className={styles.units}
            aria-label="Report produced units"
            onSubmit={async e => {
              e.preventDefault();
              if (unitsInvalid || units === order.completedQty) return;
              const saved = await onUpdate({ completedQty: units }, `${units} of ${order.quantity} units reported`);
              if (saved) setUnitsDraft(undefined);
            }}
          >
            <IxNumberInput
              label="Produced units"
              min={0}
              max={order.quantity}
              showStepperButtons
              disabled={!reportingUnits || saving}
              value={units}
              className={unitsInvalid ? 'ix-invalid' : undefined}
              invalidText={`Enter a whole number between 0 and ${order.quantity}`}
              helperText={
                reportingUnits
                  ? `Out of ${order.quantity} ordered`
                  : `Units can be reported while the order is ${STATUS_LABELS.in_progress}`
              }
              onValueChange={e => setUnitsDraft(e.detail)}
            />
            <IxButton
              type="submit"
              variant="secondary"
              disabled={!reportingUnits || saving || unitsInvalid || units === order.completedQty}
            >
              Save units
            </IxButton>
          </form>
        </IxCardContent>
      </IxCard>

      <IxCard variant="outline" passive className={styles.card}>
        <IxCardContent className={styles.cardBody}>
          <IxTypography format="h4">Details</IxTypography>
          <IxKeyValueList striped>
            <IxKeyValue label="Production line" value={order.line} />
            <IxKeyValue label="Priority" value={PRIORITY_LABELS[order.priority]} />
            <IxKeyValue label="Produced" value={`${order.completedQty} / ${order.quantity} units`} />
            <IxKeyValue
              label="Due date"
              value={`${formatDate(order.dueDate)}${overdue ? ' (overdue)' : ''}`}
            />
            <IxKeyValue label="Created" value={formatDateTime(order.createdAt)} />
            <IxKeyValue label="Last update" value={formatDateTime(order.updatedAt)} />
          </IxKeyValueList>
        </IxCardContent>
      </IxCard>

      <IxCard variant="outline" passive className={styles.card}>
        <IxCardContent className={styles.cardBody}>
          <IxTypography format="h4">History</IxTypography>
          <IxEventList aria-label="Status history">
            {[...order.history].reverse().map(change => (
              <IxEventListItem key={`${change.status}-${change.at}`}>
                <div className={styles.historyItem}>
                  <span>{STATUS_LABELS[change.status]}</span>
                  <time dateTime={change.at}>{formatDateTime(change.at)}</time>
                </div>
              </IxEventListItem>
            ))}
          </IxEventList>
        </IxCardContent>
      </IxCard>
    </div>
  );
}

export default OrderDetail;
