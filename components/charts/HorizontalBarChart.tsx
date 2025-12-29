import React, { useState } from 'react';

interface DataPoint {
  label: string;
  value: number;
  subValue?: string;
}

interface HorizontalBarChartProps {
  data: DataPoint[];
  color?: string;
  height?: number;
  showValues?: boolean;
  formatValue?: (value: number) => string;
}

export const HorizontalBarChart: React.FC<HorizontalBarChartProps> = ({
  data,
  color = '#8b5cf6',
  height = 200,
  showValues = true,
  formatValue = (v) => String(v)
}) => {
  const [hoveredBar, setHoveredBar] = useState<number | null>(null);

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center text-slate-400 text-sm" style={{ height }}>
        Sem dados disponíveis
      </div>
    );
  }

  // Sanitize data
  const chartData = [...data].map(item => ({
    ...item,
    value: typeof item.value === 'number' && !isNaN(item.value) ? item.value : 0
  }));

  const maxValue = Math.max(...chartData.map(d => d.value), 1);

  // Chart layout - mais centralizado
  const chartWidth = 500;
  const barHeight = 28;
  const barGap = 14;
  const paddingTop = 20;
  const paddingBottom = 20;
  const chartHeight = paddingTop + chartData.length * (barHeight + barGap) - barGap + paddingBottom;
  const labelWidth = 130;
  const valueWidth = 50;
  const barAreaWidth = chartWidth - labelWidth - valueWidth - 40; // 40 para margens

  return (
    <div className="w-full flex justify-center relative">
      <svg
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        className="w-full h-auto max-w-md"
        preserveAspectRatio="xMidYMid meet"
      >
        {chartData.map((item, index) => {
          const y = paddingTop + index * (barHeight + barGap);
          const barWidth = (barAreaWidth * item.value) / maxValue;
          const opacity = 1 - (index * 0.1);
          const barStartX = labelWidth + 10;

          return (
            <g key={index}>
              {/* Label à esquerda */}
              <text
                x={labelWidth}
                y={y + barHeight / 2}
                textAnchor="end"
                alignmentBaseline="middle"
                className="fill-slate-600 font-medium"
                style={{ fontSize: '13px' }}
              >
                {item.label.length > 16 ? item.label.slice(0, 16) + '...' : item.label}
              </text>

              {/* Bar background */}
              <rect
                x={barStartX}
                y={y}
                width={barAreaWidth}
                height={barHeight}
                fill="#f1f5f9"
                rx={6}
              />

              {/* Bar preenchida */}
              <rect
                x={barStartX}
                y={y}
                width={Math.max(barWidth, 8)}
                height={barHeight}
                fill={color}
                fillOpacity={hoveredBar === index ? 1 : opacity}
                rx={6}
                className="cursor-pointer transition-all duration-150"
                onMouseEnter={() => setHoveredBar(index)}
                onMouseLeave={() => setHoveredBar(null)}
              />

              {/* Value à direita */}
              {showValues && (
                <text
                  x={barStartX + barAreaWidth + 12}
                  y={y + barHeight / 2}
                  alignmentBaseline="middle"
                  className="fill-slate-700 font-bold"
                  style={{ fontSize: '14px' }}
                >
                  {formatValue(item.value)}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* Tooltip */}
      {hoveredBar !== null && (
        <div className="absolute top-0 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-3 py-2 rounded-lg shadow-xl border border-slate-700 pointer-events-none z-10">
          <p className="text-xs font-semibold mb-1">{chartData[hoveredBar].label}</p>
          <p className="text-sm font-bold">{chartData[hoveredBar].value}</p>
          {chartData[hoveredBar].subValue && (
            <p className="text-xs text-slate-400 mt-0.5">{chartData[hoveredBar].subValue}</p>
          )}
        </div>
      )}
    </div>
  );
};

