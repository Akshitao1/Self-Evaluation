"use client";

import React from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { type SupportedDataFormat } from '@/lib/chart-types';
import { processBarChartData, formatCurrency } from '@/lib/chart-data-processor';
import { JOVEO_COLORS, CHART_STYLES, getColorPalette } from '@/lib/joveo-design-tokens';

interface JoveoSpendByChannelChartProps {
  data: SupportedDataFormat;
  title?: string;
  height?: number;
  showTooltip?: boolean;
  colorPalette?: 'default' | 'performance' | 'channels' | 'status';
  className?: string;
}

// Custom tooltip component for spend data
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div 
        className="p-3 rounded-[4px] shadow-lg"
        style={{
          backgroundColor: JOVEO_COLORS.chartTooltipBg,
          color: JOVEO_COLORS.chartTooltipText,
          border: `1px solid ${JOVEO_COLORS.border}`
        }}
      >
        <p className="font-medium mb-1">{label}</p>
        <p className="text-sm">
          <span style={{ color: payload[0].color }}>●</span> Spend: {formatCurrency(payload[0].value)}
        </p>
      </div>
    );
  }
  return null;
};

export const JoveoSpendByChannelChart: React.FC<JoveoSpendByChannelChartProps> = ({ 
  data,
  title = "Spend by Channel",
  height = 300,
  showTooltip = true,
  colorPalette = 'channels',
  className = ""
}) => {
  // Process the data using our standardized processor
  const processedData = processBarChartData(data, {
    title,
    colors: getColorPalette(colorPalette),
    height,
    showTooltip,
    formatters: { value: formatCurrency }
  });

  return (
    <div 
      className={`w-full ${className}`}
      style={{
        ...CHART_STYLES.container,
        height: height + 80 // Add space for title and padding
      }}
    >
      {/* Chart Header */}
      {processedData.title && (
        <div className="mb-4">
          <h3 style={CHART_STYLES.title}>
            {processedData.title}
          </h3>
        </div>
      )}

      {/* Chart Container */}
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={processedData.data}
            margin={{
              top: 20,
              right: 30,
              left: 20,
              bottom: 5,
            }}
          >
            <CartesianGrid 
              strokeDasharray="3 3" 
              stroke={JOVEO_COLORS.chartGrid}
              opacity={0.5}
            />
            
            <XAxis 
              dataKey="category" 
              axisLine={false}
              tickLine={false}
              tick={{ 
                fontSize: 12, 
                fill: JOVEO_COLORS.textSecondary,
                fontFamily: 'SF Pro Text, sans-serif'
              }}
            />
            
            <YAxis 
              axisLine={false}
              tickLine={false}
              tick={{ 
                fontSize: 12, 
                fill: JOVEO_COLORS.textSecondary,
                fontFamily: 'SF Pro Text, sans-serif'
              }}
              tickFormatter={formatCurrency}
            />
            
            {showTooltip && (
              <Tooltip
                content={<CustomTooltip />}
                cursor={{ fill: 'rgba(48, 63, 159, 0.1)' }}
              />
            )}
            
            <Bar 
              dataKey="value" 
              fill={processedData.config?.colors?.[0] || JOVEO_COLORS.primary}
              radius={[4, 4, 0, 0]}
              maxBarSize={60}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
