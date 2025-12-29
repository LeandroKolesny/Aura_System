import React, { useState } from 'react';
import { formatCurrency } from '../../utils/formatUtils';

interface DataPoint {
  label: string;
  value: number;
}

interface RevenueAreaChartProps {
  data: DataPoint[];
  height?: number;
  showGrid?: boolean;
  color?: string;
  gradientId?: string;
}

export const RevenueAreaChart: React.FC<RevenueAreaChartProps> = ({
  data,
  height = 280,
  showGrid = true,
  color = '#10b981',
  gradientId = 'colorRevenue'
}) => {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; value: number; label: string } | null>(null);

  // Sanitize data
  const sanitizedData = (data || []).map(item => ({
    ...item,
    value: typeof item.value === 'number' && !isNaN(item.value) ? item.value : 0
  }));

  if (sanitizedData.length === 0) {
    return (
      <div className="flex items-center justify-center text-slate-400 text-sm" style={{ height }}>
        Sem dados disponíveis para o período
      </div>
    );
  }

  const maxValue = Math.max(...sanitizedData.map(d => d.value), 100);
  const yTicks = [0, maxValue * 0.25, maxValue * 0.5, maxValue * 0.75, maxValue];

  const formatYAxis = (value: number) => {
    if (value >= 1000) return `R$ ${(value / 1000).toFixed(0)}k`;
    if (value === 0) return 'R$ 0';
    return `R$ ${Math.round(value)}`;
  };

  // Chart layout constants
  const paddingLeft = 70;
  const paddingRight = 20;
  const paddingTop = 20;
  const paddingBottom = 40;
  const chartHeight = 200;
  const chartWidth = 600;

  const getX = (index: number) => {
    const availableWidth = chartWidth - paddingLeft - paddingRight;
    return paddingLeft + (index / (sanitizedData.length - 1 || 1)) * availableWidth;
  };

  const getY = (value: number) => {
    return paddingTop + chartHeight - (value / maxValue) * chartHeight;
  };

  // Build area path
  const areaPath = sanitizedData.map((d, i) => {
    const x = getX(i);
    const y = getY(d.value);
    return i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`;
  }).join(' ') + ` L ${getX(sanitizedData.length - 1)} ${paddingTop + chartHeight} L ${getX(0)} ${paddingTop + chartHeight} Z`;

  // Build line path
  const linePath = sanitizedData.map((d, i) => {
    const x = getX(i);
    const y = getY(d.value);
    return i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`;
  }).join(' ');

  return (
    <div className="w-full relative">
      <svg
        viewBox={`0 0 ${chartWidth} ${chartHeight + paddingTop + paddingBottom}`}
        className="w-full h-auto"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.3} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {showGrid && yTicks.map((tick, i) => {
          const y = getY(tick);
          return (
            <line
              key={i}
              x1={paddingLeft}
              y1={y}
              x2={chartWidth - paddingRight}
              y2={y}
              stroke="#e2e8f0"
              strokeDasharray="3 3"
            />
          );
        })}

        {/* Y axis labels */}
        {yTicks.map((tick, i) => (
          <text
            key={i}
            x={paddingLeft - 10}
            y={getY(tick)}
            textAnchor="end"
            alignmentBaseline="middle"
            className="fill-slate-400"
            style={{ fontSize: '11px' }}
          >
            {formatYAxis(tick)}
          </text>
        ))}

        {/* Area fill */}
        <path d={areaPath} fill={`url(#${gradientId})`} />

        {/* Line */}
        <path d={linePath} stroke={color} strokeWidth={2.5} fill="none" />

        {/* Data points and X labels */}
        {sanitizedData.map((d, i) => {
          const x = getX(i);
          const y = getY(d.value);
          return (
            <g key={i}>
              <circle
                cx={x}
                cy={y}
                r={tooltip?.label === d.label ? 6 : 4}
                fill={color}
                stroke="white"
                strokeWidth={2}
                className="cursor-pointer transition-all duration-150"
                onMouseEnter={() => setTooltip({ x, y, value: d.value, label: d.label })}
                onMouseLeave={() => setTooltip(null)}
              />
              <text
                x={x}
                y={paddingTop + chartHeight + 20}
                textAnchor="middle"
                className="fill-slate-400"
                style={{ fontSize: '11px' }}
              >
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="absolute bg-slate-900 text-white px-3 py-2 rounded-lg shadow-xl border border-slate-700 pointer-events-none z-10 transform -translate-x-1/2"
          style={{
            left: `${(tooltip.x / chartWidth) * 100}%`,
            top: `${((tooltip.y - 10) / (chartHeight + paddingTop + paddingBottom)) * 100}%`,
            transform: 'translate(-50%, -100%)'
          }}
        >
          <p className="text-xs text-slate-400 mb-1">{tooltip.label}</p>
          <p className="text-sm font-bold">{formatCurrency(tooltip.value)}</p>
        </div>
      )}
    </div>
  );
};

