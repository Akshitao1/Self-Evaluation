import React from 'react';
import { cn } from '@/lib/utils';
import { MetricCard } from './MetricCard';
import { JOVEO_COLORS } from '@/lib/joveo-design-tokens';
import { validateChartData } from '@/lib/chart-data-processor';

interface SparklineData {
  data: number[];
  labels?: string[];
  color?: string;
}

interface SparklineMetricCardProps {
  title: string;
  value: string | number;
  sparkline?: SparklineData;
  data?: number[]; // Legacy support for direct data prop
  color?: string; // Legacy support for direct color prop
  trend?: {
    value: number;
    type: 'up' | 'down';
    label?: string;
  };
  description?: string;
  className?: string;
}

export function SparklineMetricCard({
  title,
  value,
  sparkline,
  data, // Legacy prop support
  color, // Legacy prop support
  trend,
  description,
  className
}: SparklineMetricCardProps) {
  // Error boundary wrapper
  try {
    const chartHeight = 50;
    const chartWidth = 200;
    
    // Handle both new sparkline prop and legacy data prop formats
    const chartData = sparkline?.data || data || [];
    const chartColor = sparkline?.color || color || JOVEO_COLORS.primary;
    
    // Quick validation before processing
    if (!chartData || !Array.isArray(chartData) || chartData.length === 0) {
      console.warn('SparklineMetricCard: No valid data array provided for sparkline chart');
      return (
        <MetricCard
          title={title}
          value={value}
          trend={trend}
          description={description}
          className={className}
        />
      );
    }
    
    // Validate data using our standardized validation
    const validation = validateChartData(chartData);
    
    // Error handling for invalid data
    if (!validation.isValid) {
      console.warn('SparklineMetricCard: Invalid data provided for sparkline chart:', validation.errors);
      return (
        <MetricCard
          title={title}
          value={value}
          trend={trend}
          description={description}
          className={className}
        />
      );
    }
    
    // Ensure all data points are valid numbers
    const validData = chartData.filter(point => typeof point === 'number' && !isNaN(point) && isFinite(point));
    
    if (validData.length === 0) {
      console.warn('SparklineMetricCard: No valid numeric data points found');
      return (
        <MetricCard
          title={title}
          value={value}
          trend={trend}
          description={description}
          className={className}
        />
      );
    }
  
  // Calculate points for sparkline
  const maxValue = Math.max(...validData);
  const minValue = Math.min(...validData);
  const range = maxValue - minValue || 1; // Prevent division by zero
  
  const points = validData.map((value, index) => {
    const x = validData.length === 1 ? chartWidth / 2 : (index / (validData.length - 1)) * chartWidth;
    const y = range === 0 ? chartHeight / 2 : chartHeight - ((value - minValue) / range) * chartHeight;
    return `${x},${y}`;
  }).join(' ');

  const SparklineChart = () => (
    <svg
      width={chartWidth}
      height={chartHeight}
      className="overflow-visible"
    >
      {/* Grid lines */}
      <line
        x1="0"
        y1={chartHeight / 2}
        x2={chartWidth}
        y2={chartHeight / 2}
        stroke={JOVEO_COLORS.chartGrid}
        strokeWidth="1"
        strokeDasharray="2,2"
      />
      
      {/* Sparkline */}
      <polyline
        points={points}
        fill="none"
        stroke={chartColor}
        strokeWidth="1.5"
        className="transition-all duration-300"
      />
      
      {/* End point */}
      {validData.length > 0 && (
        <circle
          cx={validData.length === 1 ? chartWidth / 2 : chartWidth}
          cy={range === 0 ? chartHeight / 2 : chartHeight - ((validData[validData.length - 1] - minValue) / range) * chartHeight}
          r="2"
          fill={chartColor}
        />
      )}
    </svg>
  );

    return (
      <MetricCard
        title={title}
        value={value}
        trend={trend}
        description={description}
        variant="chart"
        chart={<SparklineChart />}
        className={className}
      />
    );
  } catch (error) {
    // Catch any unexpected errors and render fallback
    console.error('SparklineMetricCard: Unexpected error occurred:', error);
    return (
      <MetricCard
        title={title}
        value={value}
        trend={trend}
        description={description}
        className={className}
      />
    );
  }
}
