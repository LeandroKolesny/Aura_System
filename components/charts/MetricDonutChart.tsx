import React, { useState } from 'react';

interface DonutData {
  name: string;
  value: number;
  color: string;
}

interface MetricDonutChartProps {
  data: DonutData[];
  centerLabel?: string;
  centerValue?: string | number;
  size?: number;
  innerRadius?: number;
  outerRadius?: number;
}

export const MetricDonutChart: React.FC<MetricDonutChartProps> = ({
  data,
  centerLabel,
  centerValue,
  size = 160,
  innerRadius = 45,
  outerRadius = 70
}) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Sanitize data
  const sanitizedData = data.map(item => ({
    ...item,
    value: typeof item.value === 'number' && !isNaN(item.value) ? item.value : 0
  }));

  const total = sanitizedData.reduce((acc, item) => acc + item.value, 0);

  if (total === 0) {
    return (
      <div className="w-full flex items-center justify-center py-8">
        <div className="text-center">
          <p className="text-2xl font-bold text-slate-300">0</p>
          <p className="text-xs text-slate-400">Sem dados</p>
        </div>
      </div>
    );
  }

  // Calculate arc paths
  const cx = size / 2;
  const cy = size / 2;
  let currentAngle = -90; // Start from top

  const arcs = sanitizedData.map((item, index) => {
    const angle = (item.value / total) * 360;
    const startAngle = currentAngle;
    const endAngle = currentAngle + angle;
    currentAngle = endAngle;

    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;

    const x1 = cx + outerRadius * Math.cos(startRad);
    const y1 = cy + outerRadius * Math.sin(startRad);
    const x2 = cx + outerRadius * Math.cos(endRad);
    const y2 = cy + outerRadius * Math.sin(endRad);

    const x3 = cx + innerRadius * Math.cos(endRad);
    const y3 = cy + innerRadius * Math.sin(endRad);
    const x4 = cx + innerRadius * Math.cos(startRad);
    const y4 = cy + innerRadius * Math.sin(startRad);

    const largeArc = angle > 180 ? 1 : 0;

    const d = [
      `M ${x1} ${y1}`,
      `A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${x2} ${y2}`,
      `L ${x3} ${y3}`,
      `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${x4} ${y4}`,
      'Z'
    ].join(' ');

    return { ...item, d, index };
  });

  return (
    <div className="w-full relative">
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="w-full h-auto max-w-[180px] mx-auto"
        preserveAspectRatio="xMidYMid meet"
      >
        {arcs.map((arc) => (
          <path
            key={arc.index}
            d={arc.d}
            fill={arc.color}
            className="transition-all duration-200"
            opacity={hoveredIndex === null || hoveredIndex === arc.index ? 1 : 0.5}
            onMouseEnter={() => setHoveredIndex(arc.index)}
            onMouseLeave={() => setHoveredIndex(null)}
            style={{ cursor: 'pointer' }}
          />
        ))}

        {/* Center text */}
        {centerValue && (
          <text
            x={cx}
            y={cy - 4}
            textAnchor="middle"
            className="fill-slate-800 font-bold"
            style={{ fontSize: '18px' }}
          >
            {centerValue}
          </text>
        )}
        {centerLabel && (
          <text
            x={cx}
            y={cy + 14}
            textAnchor="middle"
            className="fill-slate-500 uppercase font-semibold"
            style={{ fontSize: '8px', letterSpacing: '0.05em' }}
          >
            {centerLabel}
          </text>
        )}
      </svg>

      {/* Tooltip */}
      {hoveredIndex !== null && (
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-full bg-slate-900 text-white px-3 py-1.5 rounded-lg text-xs shadow-lg pointer-events-none z-10">
          <span className="font-semibold">{sanitizedData[hoveredIndex].name}:</span> {sanitizedData[hoveredIndex].value}
        </div>
      )}
    </div>
  );
};

