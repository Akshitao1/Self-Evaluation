import React from 'react';
import { cn } from '@/lib/utils';
import { ChevronUp, ChevronDown, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../tooltip';

interface TrendData {
  value: number;
  type: 'up' | 'down';
  label?: string;
}

interface MetricCardProps {
  title: string;
  value: string | number;
  trend?: TrendData;
  description?: string;
  icon?: React.ReactNode;
  chart?: React.ReactNode;
  className?: string;
  variant?: 'default' | 'compact' | 'chart';
}

export function MetricCard({
  title,
  value,
  trend,
  description,
  icon,
  chart,
  className,
  variant = 'default'
}: MetricCardProps) {
  const renderTrend = () => {
    if (!trend) return null;

    const isPositive = trend.type === 'up';
    return (
      <div className="flex items-center gap-1">
        <div className={cn(
          "flex items-center text-xs font-medium",
          isPositive ? "text-[#43A047]" : "text-red-500"
        )}>
          {isPositive ? (
            <ChevronUp className="w-3 h-3" />
          ) : (
            <ChevronDown className="w-3 h-3" />
          )}
          <span>{trend.value}%</span>
        </div>
        {trend.label && (
          <span className="text-xs text-[#3D4759]/60">
            {trend.label}
          </span>
        )}
      </div>
    );
  };

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex flex-col">
        <span className="text-sm text-[#3D4759] font-normal">{title}</span>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-semibold text-[#1C2536]">{value}</span>
          {renderTrend()}
        </div>
      </div>

      {description && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="w-4 h-4 text-[#3D4759]/60" />
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs text-black">{description}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      {variant === 'chart' && chart && (
        <div className="mt-2 h-[120px]">
          {chart}
        </div>
      )}
    </div>
  );
}
