"use client";

import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { type PieChartData, type SupportedDataFormat } from '@/lib/chart-types';
import { processPieChartData, formatNumber, formatPercentage } from '@/lib/chart-data-processor';
import { JOVEO_COLORS, CHART_STYLES, getColorPalette } from '@/lib/joveo-design-tokens';

interface JoveoPieChartProps {
  data: SupportedDataFormat;
  title?: string;
  variant?: 'default' | 'compact';
  height?: number;
  showLegend?: boolean;
  showTooltip?: boolean;
  colorPalette?: 'default' | 'performance' | 'channels' | 'status';
  className?: string;
}

// Custom tooltip component
const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0];
    return (
      <div 
        className="bg-white border border-gray-200 p-3 rounded-[4px] shadow-lg"
        style={{
          backgroundColor: JOVEO_COLORS.chartTooltipBg,
          color: JOVEO_COLORS.chartTooltipText,
          border: `1px solid ${JOVEO_COLORS.border}`
        }}
      >
        <p className="font-medium">{data.name}</p>
        <p className="text-sm">
          Value: {formatNumber(data.value)}
        </p>
        <p className="text-sm">
          Percentage: {formatPercentage((data.value / payload[0].payload.total) * 100)}
        </p>
      </div>
    );
  }
  return null;
};

// Custom legend component
const CustomLegend = ({ payload }: any) => {
  return (
    <div className="flex flex-col gap-2 ml-4">
      {payload.map((item: any, index: number) => (
        <div key={index} className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-sm"
            style={{ backgroundColor: item.color }}
          />
          <span 
            className="text-sm"
            style={{ 
              color: JOVEO_COLORS.textPrimary,
              fontFamily: 'SF Pro Text, sans-serif'
            }}
          >
            {item.value}
          </span>
        </div>
      ))}
    </div>
  );
};

export function JoveoPieChart({ 
  data,
  title,
  variant = 'default',
  height,
  showLegend = true,
  showTooltip = true,
  colorPalette = 'default',
  className = ""
}: JoveoPieChartProps) {
  // Process the data using our standardized processor
  const processedData: PieChartData = processPieChartData(data, {
    title: title || 'Pie Chart',
    colors: getColorPalette(colorPalette),
    height: height || (variant === 'compact' ? 200 : 300),
    showLegend,
    showTooltip
  });

  // Calculate total for percentage calculations
  const total = processedData.data.reduce((sum, item) => sum + item.value, 0);
  
  // Add total to each data point for tooltip calculations
  const dataWithTotal = processedData.data.map(item => ({
    ...item,
    total
  }));

  const chartHeight = processedData.config?.height || 300;
  const isCompact = variant === 'compact';

  return (
    <div 
      className={`w-full ${className}`}
      style={{
        ...CHART_STYLES.container,
        padding: isCompact ? '16px' : '24px'
      }}
    >
      {/* Chart Header */}
      {processedData.title && (
        <div className="mb-6">
          <h3 style={CHART_STYLES.title}>
            {processedData.title}
          </h3>
        </div>
      )}

      {/* Chart Container */}
      <div style={{ height: chartHeight }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={dataWithTotal}
              cx="50%"
              cy="50%"
              innerRadius={isCompact ? 30 : 60}
              outerRadius={isCompact ? 70 : 100}
              paddingAngle={2}
              dataKey="value"
              animationBegin={0}
              animationDuration={600}
            >
              {dataWithTotal.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={entry.fill || processedData.config?.colors?.[index] || JOVEO_COLORS.primary}
                  className="hover:opacity-80 transition-opacity duration-200"
                />
              ))}
            </Pie>
            
            {showTooltip && (
              <Tooltip 
                content={<CustomTooltip />}
                cursor={{ fill: 'rgba(48, 63, 159, 0.1)' }}
              />
            )}
            
            {showLegend && (
              <Legend 
                content={<CustomLegend />}
                verticalAlign="middle"
                align="right"
                layout="vertical"
                wrapperStyle={{ paddingLeft: '20px' }}
              />
            )}
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
