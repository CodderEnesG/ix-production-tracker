import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  IxCard,
  IxCardContent,
  IxContentHeader,
  IxEventList,
  IxEventListItem,
  IxKpi,
  IxTypography,
} from '@siemens/ix-react';
import type { EChartsCoreOption } from 'echarts/core';
import type { OrderStatus, Stats } from '../../../shared/schema';
import { STATUS_LABELS } from '../../../shared/workflow';
import { AsyncState } from '../../components/AsyncState';
import { Chart } from '../../components/Chart';
import { api } from '../../lib/api';
import { formatRelative } from '../../lib/format';
import { useApi } from '../../lib/useApi';
import styles from './Dashboard.module.css';

const ON_TIME_TARGET = 80;

const EVENT_COLOR: Record<OrderStatus, string> = {
  planned: 'color-neutral',
  in_progress: 'color-info',
  quality_check: 'color-primary',
  completed: 'color-success',
  on_hold: 'color-warning',
};

function buildChartOption(byLine: Stats['byLine']): EChartsCoreOption {
  return {
    aria: { enabled: true },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    legend: { bottom: 0 },
    grid: { left: 8, right: 16, top: 24, bottom: 40, containLabel: true },
    xAxis: { type: 'category', data: byLine.map(row => row.line) },
    yAxis: { type: 'value', name: 'Units' },
    series: [
      { name: 'Produced', type: 'bar', stack: 'units', data: byLine.map(row => row.produced) },
      { name: 'Remaining', type: 'bar', stack: 'units', data: byLine.map(row => row.remaining) },
    ],
  };
}

function Dashboard() {
  const navigate = useNavigate();
  const { data, error, loading, reload } = useApi(signal => api.getStats(signal), []);

  const chartOption = useMemo(() => data && buildChartOption(data.byLine), [data]);
  const chartSummary = data?.byLine
    .map(row => `${row.line}: ${row.produced} units produced, ${row.remaining} remaining`)
    .join('. ');

  return (
    <>
      <IxContentHeader headerTitle="Shop-floor overview" headerSubtitle="Switchgear assembly, lines A to C" />

      <AsyncState loading={loading} error={error} hasData={!!data} onRetry={reload}>
        {data && chartOption && (
          <div className={styles.layout}>
            <section className={styles.kpis} aria-label="Key figures">
              <IxKpi label="Open orders" value={data.kpis.openOrders} />
              <IxKpi label="In production" value={data.kpis.inProduction} />
              <IxKpi
                label="Overdue"
                value={data.kpis.overdue}
                state={data.kpis.overdue > 0 ? 'alarm' : 'neutral'}
              />
              <IxKpi
                label="On-time completion"
                value={data.kpis.onTimeRate ?? '–'}
                unit={data.kpis.onTimeRate === null ? undefined : '%'}
                state={
                  data.kpis.onTimeRate !== null && data.kpis.onTimeRate < ON_TIME_TARGET
                    ? 'warning'
                    : 'neutral'
                }
              />
            </section>

            <div className={styles.panels}>
              <IxCard variant="outline" passive className={styles.card}>
                <IxCardContent className={styles.cardBody}>
                  <IxTypography format="h4">Open order units by line</IxTypography>
                  <Chart option={chartOption} label="Open order units by production line" summary={chartSummary ?? ''} />
                </IxCardContent>
              </IxCard>

              <IxCard variant="outline" passive className={styles.card}>
                <IxCardContent className={styles.cardBody}>
                  <IxTypography format="h4">Recent activity</IxTypography>
                  <IxEventList itemHeight="L" aria-label="Recent status changes">
                    {data.recent.map(event => (
                      <IxEventListItem
                        key={`${event.orderId}-${event.at}`}
                        itemColor={EVENT_COLOR[event.status]}
                        chevron
                        onItemClick={() => navigate(`/orders/${event.orderId}`)}
                      >
                        <div className={styles.event}>
                          <IxTypography format="label" bold>
                            {event.orderId} · {STATUS_LABELS[event.status]}
                          </IxTypography>
                          <IxTypography format="body-sm" textColor="soft">
                            {event.product} · <time dateTime={event.at}>{formatRelative(event.at)}</time>
                          </IxTypography>
                        </div>
                      </IxEventListItem>
                    ))}
                  </IxEventList>
                </IxCardContent>
              </IxCard>
            </div>
          </div>
        )}
      </AsyncState>
    </>
  );
}

export default Dashboard;
