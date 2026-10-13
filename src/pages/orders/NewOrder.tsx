import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  IxButton,
  IxContentHeader,
  IxDateInput,
  IxNumberInput,
  IxRadio,
  IxRadioGroup,
  IxSelect,
  IxSelectItem,
  showToast,
} from '@siemens/ix-react';
import {
  CreateOrderSchema,
  LINES,
  MAX_ORDER_QUANTITY,
  PRIORITIES,
  PRODUCTS,
  todayIso,
  type CreateOrderInput,
} from '../../../shared/schema';
import { api, ApiError } from '../../lib/api';
import { PRIORITY_LABELS } from '../../lib/format';
import styles from './NewOrder.module.css';

type Field = keyof CreateOrderInput;
type FormValues = { [K in Field]: CreateOrderInput[K] | undefined };
type FieldErrors = Partial<Record<Field, string>>;

const INITIAL: FormValues = {
  product: undefined,
  line: undefined,
  quantity: undefined,
  priority: 'normal',
  dueDate: undefined,
};

function toFieldErrors(issues: { path: string; message: string }[]): FieldErrors {
  const errors: FieldErrors = {};
  for (const issue of issues) {
    const field = issue.path as Field;
    errors[field] ??= issue.message;
  }
  return errors;
}

function NewOrder() {
  const navigate = useNavigate();
  const [values, setValues] = useState<FormValues>(INITIAL);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);

  function setField<K extends Field>(field: K, value: FormValues[K]) {
    setValues(prev => ({ ...prev, [field]: value }));
    setErrors(prev => ({ ...prev, [field]: undefined }));
  }

  // iX marks a field invalid with the `ix-invalid` class and shows `invalidText`.
  const invalid = (field: Field) => (errors[field] ? 'ix-invalid' : undefined);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    // Same schema the API uses, so the client and server never disagree.
    const parsed = CreateOrderSchema.safeParse(values);
    if (!parsed.success) {
      setErrors(
        toFieldErrors(parsed.error.issues.map(i => ({ path: i.path.join('.'), message: i.message }))),
      );
      return;
    }

    setSubmitting(true);
    try {
      const order = await api.createOrder(parsed.data);
      showToast({ type: 'success', message: `${order.id} created` });
      navigate(`/orders/${order.id}`);
    } catch (err) {
      if (err instanceof ApiError && err.issues.length > 0) {
        setErrors(toFieldErrors(err.issues));
      } else {
        showToast({
          type: 'error',
          message: err instanceof ApiError ? err.message : 'Could not create the order.',
        });
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <IxContentHeader
        headerTitle="New production order"
        headerSubtitle="All fields are required"
        hasBackButton
        onBackButtonClick={() => navigate('/orders')}
      />

      <form className={styles.form} aria-label="New production order" noValidate onSubmit={handleSubmit}>
        <IxSelect
          label="Product"
          i18nPlaceholder="Select a product"
          required
          value={values.product ?? ''}
          className={invalid('product')}
          invalidText={errors.product}
          onValueChange={e => setField('product', (e.detail as CreateOrderInput['product']) || undefined)}
        >
          {PRODUCTS.map(product => (
            <IxSelectItem key={product} value={product} label={product} />
          ))}
        </IxSelect>

        <IxSelect
          label="Production line"
          i18nPlaceholder="Select a line"
          required
          value={values.line ?? ''}
          className={invalid('line')}
          invalidText={errors.line}
          onValueChange={e => setField('line', (e.detail as CreateOrderInput['line']) || undefined)}
        >
          {LINES.map(line => (
            <IxSelectItem key={line} value={line} label={line} />
          ))}
        </IxSelect>

        <IxNumberInput
          label="Quantity"
          placeholder="Units"
          required
          min={1}
          max={MAX_ORDER_QUANTITY}
          showStepperButtons
          value={values.quantity}
          className={invalid('quantity')}
          invalidText={errors.quantity}
          helperText={`1 to ${MAX_ORDER_QUANTITY} units`}
          onValueChange={e => setField('quantity', Number.isNaN(e.detail) ? undefined : e.detail)}
        />

        <IxDateInput
          label="Due date"
          placeholder="YYYY-MM-DD"
          required
          format="yyyy-MM-dd"
          minDate={todayIso()}
          value={values.dueDate}
          className={invalid('dueDate')}
          invalidText={errors.dueDate}
          onValueChange={e => setField('dueDate', e.detail || undefined)}
        />

        <IxRadioGroup
          label="Priority"
          value={values.priority}
          className={invalid('priority')}
          invalidText={errors.priority}
          onValueChange={e => setField('priority', e.detail as CreateOrderInput['priority'])}
        >
          {PRIORITIES.map(priority => (
            <IxRadio key={priority} value={priority} label={PRIORITY_LABELS[priority]} />
          ))}
        </IxRadioGroup>

        <div className={styles.buttons}>
          <IxButton variant="secondary" disabled={submitting} onClick={() => navigate('/orders')}>
            Cancel
          </IxButton>
          <IxButton type="submit" loading={submitting} disabled={submitting}>
            Create order
          </IxButton>
        </div>
      </form>
    </>
  );
}

export default NewOrder;
