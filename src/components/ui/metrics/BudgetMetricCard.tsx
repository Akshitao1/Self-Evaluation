import React from 'react';
import { cn } from '@/lib/utils';
import { MetricCard } from './MetricCard';
import { Progress } from '../progress';

interface BudgetMetricCardProps {
  title: string;
  spent: number | string;
  budget: number | string;
  trend?: {
    value: number;
    type: 'up' | 'down';
    label?: string;
  };
  description?: string;
  className?: string;
  variant?: 'default' | 'compact';
}

export function BudgetMetricCard({
  title,
  spent,
  budget,
  trend,
  description,
  className,
  variant = 'default'
}: BudgetMetricCardProps) {
  // Handle both string and number formats
  const parseValue = (value: number | string): number => {
    if (typeof value === 'number') return value;
    // Parse string values like "$150K", "$128K", etc.
    const cleaned = value.replace(/[$,]/g, '');
    if (cleaned.endsWith('K')) {
      return parseFloat(cleaned.slice(0, -1)) * 1000;
    }
    if (cleaned.endsWith('M')) {
      return parseFloat(cleaned.slice(0, -1)) * 1000000;
    }
    return parseFloat(cleaned) || 0;
  };

  const spentValue = parseValue(spent);
  const budgetValue = parseValue(budget);
  const percentage = budgetValue > 0 ? (spentValue / budgetValue) * 100 : 0;
  
  const formattedSpent = typeof spent === 'string' ? spent : new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(spentValue);

  const getProgressColor = (percentage: number) => {
    if (percentage >= 90) return 'bg-red-500';
    if (percentage >= 75) return 'bg-orange-500';
    return 'bg-joveo-blue';
  };

  return (
    <div className={cn('space-y-4', className)}>
      <MetricCard
        title={title}
        value={formattedSpent}
        trend={trend}
        description={description}
        variant={variant}
      />
      
      <div className="px-6 pb-4">
        <div className="flex justify-between items-center mb-2">
          <span className="joveo-label text-joveo-text">
            Budget: {typeof budget === 'string' ? budget : new Intl.NumberFormat('en-US', {
              style: 'currency',
              currency: 'USD',
              maximumFractionDigits: 0
            }).format(budgetValue)}
          </span>
          <span className="joveo-label text-joveo-text">
            {percentage.toFixed(1)}%
          </span>
        </div>
        
        <Progress
          value={percentage}
          className="h-1.5 bg-gray-100"
          indicatorClassName={cn(
            "transition-all",
            getProgressColor(percentage)
          )}
        />
        
        {percentage >= 90 && (
          <p className="mt-2 text-xs text-red-500">
            Warning: Budget limit approaching
          </p>
        )}
      </div>
    </div>
  );
}
