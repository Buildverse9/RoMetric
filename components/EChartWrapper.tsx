'use client';

import React, { useEffect, useRef } from 'react';
import type { EChartsOption } from 'echarts';
import type { EChartsType } from 'echarts/core';

interface EChartWrapperProps {
  option: EChartsOption;
  height?: number;
  className?: string;
}

let echartsCorePromise: Promise<typeof import('echarts/core')> | null = null;

function loadEChartsCore() {
  if (!echartsCorePromise) {
    echartsCorePromise = Promise.all([
      import('echarts/core'),
      import('echarts/charts'),
      import('echarts/components'),
      import('echarts/renderers'),
    ]).then(([echarts, charts, components, renderers]) => {
      echarts.use([
        charts.BarChart,
        charts.LineChart,
        components.GridComponent,
        components.TooltipComponent,
        components.LegendComponent,
        renderers.CanvasRenderer,
      ]);
      return echarts;
    });
  }
  return echartsCorePromise;
}

export function EChartWrapper({
  option,
  height = 320,
  className = '',
}: EChartWrapperProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<EChartsType | null>(null);
  const latestOptionRef = useRef<EChartsOption>(option);

  useEffect(() => {
    latestOptionRef.current = option;
    if (chartRef.current) {
      chartRef.current.setOption(option, { notMerge: true });
    }
  }, [option]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let disposed = false;
    let ro: ResizeObserver | null = null;

    loadEChartsCore()
      .then((echarts) => {
        if (disposed || !containerRef.current) return;
        const instance = echarts.init(containerRef.current, undefined, {
          renderer: 'canvas',
        });
        chartRef.current = instance;
        instance.setOption(latestOptionRef.current, { notMerge: true });

        ro = new ResizeObserver(() => {
          instance.resize();
        });
        ro.observe(containerRef.current);
      })
      .catch(() => {
        // Handled silently if unmounted during async load
      });

    return () => {
      disposed = true;
      ro?.disconnect();
      chartRef.current?.dispose();
      chartRef.current = null;
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{ height: `${height}px` }}
      className={`w-full ${className}`}
    />
  );
}
