import React, { useMemo } from 'react';
import { AreaChart, Area } from 'recharts';

interface MiniSparklineProps {
  data: { value: number }[];
  color?: string;
  height?: number;
  width?: number;
}

export const MiniSparkline: React.FC<MiniSparklineProps> = ({
  data,
  color = '#10b981',
  height = 40,
  width = 100
}) => {
  const gradientId = useMemo(() => `sparkline-${Math.random().toString(36).substr(2, 9)}`, []);

  if (!data || data.length === 0) {
    return <div style={{ width, height }} className="bg-slate-50 rounded" />;
  }

  return (
    <div style={{ width, height }}>
      <AreaChart width={width} height={height} data={data} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.3} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={1.5}
          fill={`url(#${gradientId})`}
          animationDuration={500}
        />
      </AreaChart>
    </div>
  );
};

