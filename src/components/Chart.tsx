/*
 * Theme handling follows the Siemens iX React starter (MIT, Copyright (c) Siemens 2018 - 2026).
 */

import { useEffect, useRef } from 'react';
import { themeSwitcher } from '@siemens/ix';
import { registerTheme } from '@siemens/ix-echarts';
import { BarChart } from 'echarts/charts';
import { AriaComponent, GridComponent, LegendComponent, TooltipComponent } from 'echarts/components';
import * as echarts from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import styles from './Chart.module.css';

// Registered here rather than in main.tsx so ECharts loads only with the pages that use it.
echarts.use([BarChart, AriaComponent, GridComponent, LegendComponent, TooltipComponent, CanvasRenderer]);
registerTheme(echarts);

/** Name of the ECharts theme registered by @siemens/ix-echarts for the current iX theme. */
function currentThemeName(): string {
  const theme = themeSwitcher.getTheme();
  let mode = themeSwitcher.getColorSchema();
  if (mode === 'system') {
    mode = globalThis.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return `theme-${theme}-${mode}`;
}

type Props = {
  option: echarts.EChartsCoreOption;
  /** Short accessible name for the chart. */
  label: string;
  /** Text alternative for screen readers, e.g. the numbers behind the bars. */
  summary: string;
};

export function Chart({ option, label, summary }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);
  const optionRef = useRef(option);

  // Create the chart once, recreate it when the iX theme changes (ECharts
  // themes are fixed at init) and keep it sized to its container.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const init = () => {
      chartRef.current?.dispose();
      chartRef.current = echarts.init(container, currentThemeName());
      chartRef.current.setOption(optionRef.current);
    };
    init();

    const observer = new ResizeObserver(() => chartRef.current?.resize());
    observer.observe(container);
    themeSwitcher.themeChanged.on(init);

    return () => {
      observer.disconnect();
      themeSwitcher.themeChanged.off(init);
      chartRef.current?.dispose();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    optionRef.current = option;
    chartRef.current?.setOption(option, true);
  }, [option]);

  return (
    <figure className={styles.figure} aria-label={label}>
      <div ref={containerRef} className={styles.canvas} aria-hidden="true" />
      <figcaption className="sr-only">{summary}</figcaption>
    </figure>
  );
}
