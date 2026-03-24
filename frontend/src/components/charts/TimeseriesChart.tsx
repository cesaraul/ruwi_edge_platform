import ReactECharts from 'echarts-for-react'
import { useMemo } from 'react'
import type { TelemetryPoint } from '../../types/telemetry'

interface Props {
  data: TelemetryPoint[]
  variable: string
  unit: string
  color?: string
  thresholdLow?: number
  thresholdHigh?: number
  height?: number
}

export function TimeseriesChart({
  data,
  unit,
  color = '#388bfd',
  thresholdLow,
  thresholdHigh,
  height = 280,
}: Props) {
  const option = useMemo(() => {
    const markLines = []

    if (thresholdLow !== undefined)
      markLines.push({ yAxis: thresholdLow, lineStyle: { color: '#d29922', type: 'dashed' },
        label: { formatter: `Mín: ${thresholdLow}`, color: '#d29922', fontSize: 10 } })
    if (thresholdHigh !== undefined)
      markLines.push({ yAxis: thresholdHigh, lineStyle: { color: '#f85149', type: 'dashed' },
        label: { formatter: `Máx: ${thresholdHigh}`, color: '#f85149', fontSize: 10 } })

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#21262d',
        borderColor: '#30363d',
        textStyle: { color: '#e6edf3', fontSize: 12 },
        formatter: (params: { axisValue: string; value: number }[]) => {
          const p = params[0]
          return `<b>${p.axisValue}</b><br/>${p.value.toFixed(2)} ${unit}`
        },
      },
      grid: { left: 48, right: 16, top: 16, bottom: 40, containLabel: false },
      xAxis: {
        type: 'category',
        data: data.map((d) => {
          const t = new Date(d.time)
          return `${t.getHours().toString().padStart(2,'0')}:${t.getMinutes().toString().padStart(2,'0')}`
        }),
        axisLine: { lineStyle: { color: '#30363d' } },
        axisTick: { show: false },
        axisLabel: {
          color: '#6e7681', fontSize: 10,
          interval: Math.floor(data.length / 6),
        },
      },
      yAxis: {
        type: 'value',
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { lineStyle: { color: '#21262d' } },
        axisLabel: { color: '#6e7681', fontSize: 10 },
      },
      series: [
        {
          type: 'line',
          data: data.map((d) => d.value),
          smooth: true,
          symbol: 'none',
          lineStyle: { color, width: 2 },
          areaStyle: {
            color: {
              type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: color + '33' },
                { offset: 1, color: color + '00' },
              ],
            },
          },
          markLine: markLines.length > 0
            ? { silent: true, symbol: 'none', data: markLines }
            : undefined,
        },
      ],
    }
  }, [data, unit, color, thresholdLow, thresholdHigh])

  if (!data.length) {
    return (
      <div style={{ height }} className="flex items-center justify-center text-txt-muted text-sm">
        Sin datos disponibles
      </div>
    )
  }

  return (
    <ReactECharts
      option={option}
      style={{ height, width: '100%' }}
      opts={{ renderer: 'svg' }}
    />
  )
}
