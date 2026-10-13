import { useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  IxButton,
  IxContentHeader,
  IxEmptyState,
  IxInput,
  IxSelect,
  IxSelectItem,
  IxTypography,
} from '@siemens/ix-react';
import { iconAdd, iconSearch } from '@siemens/ix-icons/icons';
import { AgGridReact } from 'ag-grid-react';
import * as ag from 'ag-grid-community';
import { getIxTheme } from '@siemens/ix-aggrid';
import {
  LINES,
  LineSchema,
  ORDER_STATUSES,
  OrderStatusSchema,
  PRIORITIES,
  type Order,
  type OrderStatus,
  type Priority,
} from '../../../shared/schema';
import { isOverdue, STATUS_LABELS } from '../../../shared/workflow';
import { AsyncState } from '../../components/AsyncState';
import { StatusPill } from '../../components/StatusPill';
import { api } from '../../lib/api';
import { formatDate, PRIORITY_LABELS } from '../../lib/format';
import { useApi } from '../../lib/useApi';
import { useDebouncedValue } from '../../lib/useDebouncedValue';
import styles from './Orders.module.css';

// Registered here so AG Grid is only downloaded with this page.
ag.ModuleRegistry.registerModules([ag.AllCommunityModule]);
const ixTheme = getIxTheme(ag);

function DueDateCell({ data }: ag.ICellRendererParams<Order>) {
  if (!data) return null;
  if (!isOverdue(data)) return formatDate(data.dueDate);
  return <span className={styles.overdue}>{formatDate(data.dueDate)} · Overdue</span>;
}

const COLUMNS: ag.ColDef<Order>[] = [
  { field: 'id', headerName: 'Order', minWidth: 130, flex: 1 },
  { field: 'product', headerName: 'Product', minWidth: 240, flex: 2 },
  { field: 'line', headerName: 'Line', minWidth: 90, flex: 1 },
  {
    field: 'status',
    headerName: 'Status',
    minWidth: 170,
    flex: 1,
    cellClass: styles.centerCell,
    cellRenderer: ({ value }: ag.ICellRendererParams<Order, OrderStatus>) =>
      value ? <StatusPill status={value} /> : null,
  },
  {
    colId: 'progress',
    headerName: 'Produced',
    minWidth: 120,
    flex: 1,
    valueGetter: ({ data }) => (data ? data.completedQty / data.quantity : 0),
    valueFormatter: ({ data }) => (data ? `${data.completedQty} / ${data.quantity}` : ''),
  },
  { field: 'dueDate', headerName: 'Due date', minWidth: 210, flex: 1, cellRenderer: DueDateCell },
  {
    field: 'priority',
    headerName: 'Priority',
    minWidth: 100,
    flex: 1,
    valueFormatter: ({ value }) => (value ? PRIORITY_LABELS[value as Priority] : ''),
    comparator: (a: Priority, b: Priority) => PRIORITIES.indexOf(a) - PRIORITIES.indexOf(b),
  },
];

function Orders() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  // Filters live in the URL: shareable, survive a reload, and the URL stays
  // the single source of truth. Invalid values are ignored instead of sent.
  const status = OrderStatusSchema.safeParse(params.get('status')).data;
  const line = LineSchema.safeParse(params.get('line')).data;
  const q = params.get('q') ?? '';
  const debouncedQ = useDebouncedValue(q.trim(), 300);

  const { data, error, loading, reload } = useApi(
    signal => api.listOrders({ status, line, q: debouncedQ }, signal),
    [status, line, debouncedQ],
  );

  const setParam = useCallback(
    (key: string, value: string | undefined) =>
      setParams(
        prev => {
          const next = new URLSearchParams(prev);
          if (value) next.set(key, value);
          else next.delete(key);
          return next;
        },
        { replace: true },
      ),
    [setParams],
  );

  const hasFilters = Boolean(status || line || q);
  const openOrder = useCallback((id: string) => navigate(`/orders/${id}`), [navigate]);
  const getRowId = useMemo(() => (row: ag.GetRowIdParams<Order>) => row.data.id, []);

  return (
    <>
      <IxContentHeader headerTitle="Production orders" headerSubtitle="Switchgear assembly, lines A to C">
        <IxButton icon={iconAdd} onClick={() => navigate('/orders/new')}>
          New order
        </IxButton>
      </IxContentHeader>

      <div className={styles.toolbar} role="search">
        <IxInput
          className={styles.search}
          label="Search"
          placeholder="Order ID or product"
          value={q}
          onValueChange={e => setParam('q', e.detail)}
        />
        <IxSelect
          label="Status"
          i18nPlaceholder="All statuses"
          allowClear
          value={status ?? ''}
          onValueChange={e => setParam('status', typeof e.detail === 'string' ? e.detail : undefined)}
        >
          {ORDER_STATUSES.map(value => (
            <IxSelectItem key={value} value={value} label={STATUS_LABELS[value]} />
          ))}
        </IxSelect>
        <IxSelect
          label="Line"
          i18nPlaceholder="All lines"
          allowClear
          value={line ?? ''}
          onValueChange={e => setParam('line', typeof e.detail === 'string' ? e.detail : undefined)}
        >
          {LINES.map(value => (
            <IxSelectItem key={value} value={value} label={value} />
          ))}
        </IxSelect>
      </div>

      <AsyncState loading={loading} error={error} hasData={!!data} onRetry={reload}>
        {data && (
          <>
            <IxTypography format="body-sm" textColor="soft" className={styles.count} aria-live="polite">
              {data.length} {data.length === 1 ? 'order' : 'orders'}
              {loading ? ' · updating…' : ''}
            </IxTypography>

            {data.length === 0 ? (
              <IxEmptyState
                layout="large"
                icon={iconSearch}
                header={hasFilters ? 'No orders match these filters' : 'No orders yet'}
                subHeader={hasFilters ? 'Try another status, line or search term.' : 'Create the first order.'}
                action={hasFilters ? 'Clear filters' : 'New order'}
                onActionClick={() =>
                  hasFilters ? setParams({}, { replace: true }) : navigate('/orders/new')
                }
              />
            ) : (
              <section className={styles.grid} aria-label="Production orders table">
                <AgGridReact<Order>
                  theme={ixTheme}
                  rowData={data}
                  columnDefs={COLUMNS}
                  getRowId={getRowId}
                  domLayout="autoHeight"
                  rowClass={styles.row}
                  suppressMovableColumns
                  onRowClicked={e => e.data && openOrder(e.data.id)}
                  onCellKeyDown={e => {
                    if ((e.event as KeyboardEvent | null)?.key === 'Enter' && e.data) openOrder(e.data.id);
                  }}
                />
              </section>
            )}
          </>
        )}
      </AsyncState>
    </>
  );
}

export default Orders;
