import React from 'react';
import { cn } from '@/lib/utils';

export interface TypographyProps {
  variant?: 
    | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
    | 'subtitle1SemiBold' | 'subtitle1Medium' | 'subtitle1Regular'
    | 'subtitle2SemiBold' | 'subtitle2Medium' | 'subtitle2Regular'
    | 'body1SemiBold' | 'body1Medium' | 'body1Regular'
    | 'body2SemiBold' | 'body2Medium' | 'body2Regular'
    | 'captionRegular' | 'overlineRegular' | 'tooltipRegular';
  children: React.ReactNode;
  className?: string;
  color?: 
    | 'text.lighter' | 'text.light' | 'text.main' | 'text.dark' | 'text.darker'
    | 'primary.main' | 'secondary.main' | 'error.main' | 'warning.main'
    | 'success.main' | 'info.main' | string;
  component?: keyof React.JSX.IntrinsicElements;
}

const variantClasses = {
  h1: 'text-6xl font-light leading-tight',
  h2: 'text-4xl font-light leading-tight',
  h3: 'text-3xl font-normal leading-tight',
  h4: 'text-2xl font-medium leading-normal',
  h5: 'text-xl font-bold leading-normal',
  h6: 'text-lg font-semibold leading-relaxed',
  subtitle1SemiBold: 'text-lg font-semibold leading-relaxed',
  subtitle1Medium: 'text-lg font-medium leading-relaxed',
  subtitle1Regular: 'text-lg font-normal leading-relaxed',
  subtitle2SemiBold: 'text-base font-semibold leading-normal',
  subtitle2Medium: 'text-base font-medium leading-normal',
  subtitle2Regular: 'text-base font-normal leading-normal',
  body1SemiBold: 'text-sm font-semibold leading-relaxed',
  body1Medium: 'text-sm font-medium leading-relaxed',
  body1Regular: 'text-sm font-normal leading-relaxed',
  body2SemiBold: 'text-xs font-semibold leading-relaxed',
  body2Medium: 'text-xs font-medium leading-relaxed',
  body2Regular: 'text-xs font-normal leading-relaxed',
  captionRegular: 'text-xs font-normal leading-tight',
  overlineRegular: 'text-xs font-normal leading-normal uppercase tracking-wide',
  tooltipRegular: 'text-xs font-light leading-tight',
};

const colorClasses = {
  'text.lighter': 'text-slate-300',
  'text.light': 'text-slate-500',
  'text.main': 'text-slate-600',
  'text.dark': 'text-slate-700',
  'text.darker': 'text-slate-900',
  'primary.main': 'text-blue-700',
  'secondary.main': 'text-indigo-600',
  'error.main': 'text-red-600',
  'warning.main': 'text-orange-600',
  'success.main': 'text-green-600',
  'info.main': 'text-blue-500',
};

const variantElements = {
  h1: 'h1',
  h2: 'h2',
  h3: 'h3',
  h4: 'h4',
  h5: 'h5',
  h6: 'h6',
  subtitle1SemiBold: 'p',
  subtitle1Medium: 'p',
  subtitle1Regular: 'p',
  subtitle2SemiBold: 'p',
  subtitle2Medium: 'p',
  subtitle2Regular: 'p',
  body1SemiBold: 'p',
  body1Medium: 'p',
  body1Regular: 'p',
  body2SemiBold: 'p',
  body2Medium: 'p',
  body2Regular: 'p',
  captionRegular: 'span',
  overlineRegular: 'span',
  tooltipRegular: 'span',
} as const;

export const Typography: React.FC<TypographyProps> = ({
  variant = 'body1Regular',
  children,
  className,
  color,
  component,
  ...props
}) => {
  const Element = component || variantElements[variant] || 'p';
  
  const variantClass = variantClasses[variant];
  const colorClass = color ? (colorClasses[color as keyof typeof colorClasses] || '') : 'text-slate-900';
  
  return (
    <Element
      className={cn(variantClass, colorClass, className)}
      {...props}
    >
      {children}
    </Element>
  );
};

export default Typography; 