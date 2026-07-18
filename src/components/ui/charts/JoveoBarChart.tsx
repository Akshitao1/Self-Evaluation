"use client";

import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { type BarChartData, type MultiBarChartData, type SupportedDataFormat, type MultiBarChartConfig } from '@/lib/chart-types';
import { processBarChartData, processMultiBarChartData, formatNumber } from '@/lib/chart-data-processor';
import { JOVEO_COLORS, CHART_STYLES, getColorPalette } from '@/lib/joveo-design-tokens';
import { cn } from '@/lib/utils';

interface JoveoBarChartProps {
  data: SupportedDataFormat;
  title?: string;
  variant?: 'default' | 'grouped';
  height?: number;
  showLegend?: boolean;
  showTooltip?: boolean;
  colorPalette?: 'default' | 'performance' | 'channels' | 'status';
  className?: string;
}

// Custom tooltip component
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
        {payload.map((item: any, index: number) => (
          <p key={index} className="text-sm">
            <span style={{ color: item.color }}>●</span> {item.name}: {formatNumber(item.value)}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export function JoveoBarChart({ 
  data,
  title,
  variant = 'default', 
  height,
  showLegend = false,
  showTooltip = true,
  colorPalette = 'default',
  className 
}: JoveoBarChartProps) {
  // Detect if data should be processed as multi-bar or single bar
  const isMultiSeries = Array.isArray(data) && data.length > 0 && 
    Object.keys(data[0]).filter(key => typeof data[0][key] === 'number').length > 1;

  // Process data based on type
  const processedData = isMultiSeries && variant === 'grouped'
    ? processMultiBarChartData(data, {
        title: title || 'Bar Chart',
        colors: getColorPalette(colorPalette),
        height: height || 300,
        showLegend,
        showTooltip
      } as MultiBarChartConfig) as MultiBarChartData
    : processBarChartData(data, {
        title: title || 'Bar Chart',
        colors: getColorPalette(colorPalette),
        height: height || 300,
        showLegend,
        showTooltip
      }) as BarChartData;

  const chartHeight = processedData.config?.height || 300;
  const colors = processedData.config?.colors || getColorPalette(colorPalette);

  return (
    <div 
      className={cn('w-full', className)}
      style={CHART_STYLES.container}
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
              stroke={JOVEO_COLORS.textSecondary}
              fontSize={12}
              axisLine={false}
              tickLine={false}
              fontFamily="SF Pro Text, sans-serif"
            />
            
            <YAxis 
              stroke={JOVEO_COLORS.textSecondary}
              fontSize={12}
              tickFormatter={formatNumber}
              axisLine={false}
              tickLine={false}
              fontFamily="SF Pro Text, sans-serif"
            />
            
            {showTooltip && (
              <Tooltip 
                content={<CustomTooltip />}
                cursor={{ fill: 'rgba(48, 63, 159, 0.1)' }}
              />
            )}
            
            {showLegend && 'series' in processedData && (
              <Legend 
                iconType="rect"
                wrapperStyle={{
                  fontFamily: 'SF Pro Text, sans-serif',
                  fontSize: '12px'
                }}
              />
            )}
            
            {/* Render bars based on chart type */}
            {'series' in processedData ? (
              // Multi-bar chart
              processedData.series.map((seriesName, index) => (
                <Bar
                  key={seriesName}
                  dataKey={seriesName}
                  name={seriesName}
                  fill={colors[index % colors.length]}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={variant === 'grouped' ? 24 : 60}
                />
              ))
            ) : (
              // Single bar chart
              <Bar
                dataKey="value"
                fill={colors[0]}
                radius={[4, 4, 0, 0]}
                maxBarSize={60}
              />
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}