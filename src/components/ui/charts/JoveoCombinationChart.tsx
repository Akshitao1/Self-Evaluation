"use client";

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  ComposedChart, 
  Bar, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Legend
} from 'recharts';
import { Loader2 } from 'lucide-react';
import { type CombinationChartData, type SupportedDataFormat, type CombinationChartConfig } from '@/lib/chart-types';
import { processCombinationChartData, formatCurrency } from '@/lib/chart-data-processor';
import { JOVEO_COLORS, CHART_STYLES, getColorPalette } from '@/lib/joveo-design-tokens';

// Fallback data if API fails
const fallbackData = [
  { period: '01', spend: 2500, cpa: 12.5, date: '01 Aug 2025' },
  { period: '02', spend: 1000, cpa: 8.2, date: '02 Aug 2025' },
  { period: '03', spend: 2000, cpa: 14.8, date: '03 Aug 2025' },
  { period: '04', spend: 3000, cpa: 18.1, date: '04 Aug 2025' },
  { period: '05', spend: 4500, cpa: 22.3, date: '05 Aug 2025' },
  { period: '06', spend: 3000, cpa: 16.7, date: '06 Aug 2025' }
];

const fetchChartData = async () => {
  try {
    const response = await fetch('/api/chart-data');
    if (!response.ok) {
      throw new Error('Failed to fetch data');
    }
    return response.json();
  } catch (error) {
    console.warn('Using fallback data due to API error:', error);
    return fallbackData;
  }
};

interface JoveoCombinationChartProps {
  data?: SupportedDataFormat;
  title?: string;
  height?: number;
  showLegend?: boolean;
  showTooltip?: boolean;
  barSeries?: string[];
  lineSeries?: string[];
  colorPalette?: 'default' | 'performance' | 'channels' | 'status';
  className?: string;
}

const formatCPA = (value: number): string => {
  return `$${value.toFixed(2)}`;
};

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
        <p className="font-medium mb-2" style={{ fontFamily: 'SF Pro Text, sans-serif' }}>
          {label}
        </p>
        {payload.map((item: any, index: number) => (
          <div key={index} className="flex items-center gap-2 mb-1">
            <div 
              className="w-3 h-3 rounded-[2px]" 
              style={{ backgroundColor: item.color }}
            />
            <span className="text-sm" style={{ fontFamily: 'SF Pro Text, sans-serif' }}>
              {item.name}: {item.dataKey === 'spend' ? formatCurrency(item.value) : 
                          item.dataKey === 'cpa' ? formatCPA(item.value) : 
                          item.value}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export function JoveoCombinationChart({ 
  data: propData,
  title = "Performance Comparison",
  height = 300,
  showLegend = true,
  showTooltip = true,
  barSeries,
  lineSeries,
  colorPalette = 'performance',
  className = "" 
}: JoveoCombinationChartProps) {
  const { data: apiData, error, isLoading } = useQuery({
    queryKey: ['chartData'],
    queryFn: fetchChartData,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Use prop data if provided, otherwise use API data or fallback
  const rawData = propData || apiData || fallbackData;

  // Process the data using our standardized processor
  const processedData: CombinationChartData = processCombinationChartData(rawData, {
    title,
    colors: getColorPalette(colorPalette),
    height,
    showLegend,
    showTooltip,
    barSeries: barSeries || ['spend'],
    lineSeries: lineSeries || ['cpa']
  } as CombinationChartConfig);

  if (isLoading) {
    return (
      <div 
        className={`w-full ${className}`}
        style={{
          ...CHART_STYLES.container,
          height: height + 100
        }}
      >
        <div className="flex flex-col justify-center items-center" style={{ height }}>
          <Loader2 className="h-8 w-8 animate-spin" style={{ color: JOVEO_COLORS.primary }} />
          <p className="mt-3" style={{ 
            color: JOVEO_COLORS.textPrimary,
            fontFamily: 'SF Pro Text, sans-serif',
            fontSize: '14px'
          }}>
            Loading Chart Data...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    console.warn('Chart data error:', error);
  }

  const colors = processedData.config?.colors || getColorPalette(colorPalette);

  return (
    <div 
      className={`w-full ${className}`}
      style={CHART_STYLES.container}
    >
      {/* Chart Header */}
      {processedData.title && (
        <div className="flex justify-between items-center mb-6">
          <h3 style={CHART_STYLES.title}>
            {processedData.title}
          </h3>
        </div>
      )}

      {/* Chart Container */}
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={processedData.data}
            margin={{
              top: 20,
              right: 30,
              left: 20,
              bottom: 20,
            }}
          >
            <CartesianGrid 
              strokeDasharray="3 3" 
              stroke={JOVEO_COLORS.chartGrid}
              opacity={0.5}
            />
            
            {/* X-Axis */}
            <XAxis 
              dataKey="category" 
              stroke={JOVEO_COLORS.textSecondary}
              fontSize={12}
              axisLine={false}
              tickLine={false}
              fontFamily="SF Pro Text, sans-serif"
            />
            
            {/* Left Y-Axis (Bars) */}
            <YAxis 
              yAxisId="left"
              stroke={JOVEO_COLORS.textSecondary}
              fontSize={12}
              tickFormatter={formatCurrency}
              axisLine={false}
              tickLine={false}
              fontFamily="SF Pro Text, sans-serif"
            />
            
            {/* Right Y-Axis (Lines) */}
            <YAxis 
              yAxisId="right"
              orientation="right"
              stroke={JOVEO_COLORS.textSecondary}
              fontSize={12}
              tickFormatter={formatCPA}
              axisLine={false}
              tickLine={false}
              fontFamily="SF Pro Text, sans-serif"
            />
            
            {/* Tooltip */}
            {showTooltip && (
              <Tooltip 
                cursor={{ fill: 'rgba(48, 63, 159, 0.1)' }}
                content={<CustomTooltip />}
              />
            )}
            
            {/* Legend */}
            {showLegend && (
              <Legend 
                verticalAlign="top" 
                height={36}
                iconType="circle"
                wrapperStyle={{
                  fontFamily: 'SF Pro Text, sans-serif',
                  fontSize: '12px'
                }}
              />
            )}
            
            {/* Render Bar Series */}
            {processedData.barSeries?.map((seriesName, index) => (
              <Bar
                key={`bar-${seriesName}`}
                yAxisId="left"
                dataKey={seriesName}
                name={seriesName}
                fill={colors[index % colors.length]}
                radius={[4, 4, 0, 0]}
                barSize={40}
              />
            ))}
            
            {/* Render Line Series */}
            {processedData.lineSeries?.map((seriesName, index) => (
              <Line
                key={`line-${seriesName}`}
                yAxisId="right"
                type="monotone"
                dataKey={seriesName}
                name={seriesName}
                stroke={colors[(processedData.barSeries?.length || 0) + index % colors.length]}
                strokeWidth={3}
                dot={{ fill: colors[(processedData.barSeries?.length || 0) + index % colors.length], strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, strokeWidth: 2 }}
              />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
