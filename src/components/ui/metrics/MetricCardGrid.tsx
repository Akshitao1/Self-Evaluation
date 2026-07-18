import React from 'react';
import { cn } from '@/lib/utils';

interface MetricCardGridProps {
  children: React.ReactNode;
  className?: string;
}

export function MetricCardGrid({ children, className }: MetricCardGridProps) {
  return (
    <div
      className={cn(
        'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6',
        className
      )}
    >
      {children}
    </div>
  );
}
