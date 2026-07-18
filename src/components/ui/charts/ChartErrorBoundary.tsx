"use client";

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { JOVEO_COLORS, CHART_STYLES } from '@/lib/joveo-design-tokens';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error?: Error;
}

/**
 * Error boundary specifically for chart components
 * Prevents chart errors from crashing the entire application
 */
export class ChartErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Chart Error Boundary caught an error:', error, errorInfo);
    
    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  public render() {
    if (this.state.hasError) {
      // Custom fallback UI or default error message
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div 
          className="w-full flex flex-col items-center justify-center p-6 text-center"
          style={{
            ...CHART_STYLES.container,
            minHeight: '200px',
            backgroundColor: JOVEO_COLORS.backgroundSecondary,
            border: `1px dashed ${JOVEO_COLORS.border}`
          }}
        >
          <div className="mb-4">
            <svg 
              width="48" 
              height="48" 
              viewBox="0 0 24 24" 
              fill="none" 
              xmlns="http://www.w3.org/2000/svg"
            >
              <path 
                d="M12 2L2 7L12 12L22 7L12 2Z" 
                stroke={JOVEO_COLORS.textSecondary} 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              />
              <path 
                d="M2 17L12 22L22 17" 
                stroke={JOVEO_COLORS.textSecondary} 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              />
              <path 
                d="M2 12L12 17L22 12" 
                stroke={JOVEO_COLORS.textSecondary} 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              />
            </svg>
          </div>
          
          <h3 
            className="mb-2 font-medium"
            style={{ 
              color: JOVEO_COLORS.textPrimary,
              fontFamily: 'SF Pro Text, sans-serif',
              fontSize: '16px'
            }}
          >
            Chart Error
          </h3>
          
          <p 
            className="text-sm mb-4"
            style={{ 
              color: JOVEO_COLORS.textSecondary,
              fontFamily: 'SF Pro Text, sans-serif'
            }}
          >
            Unable to render chart. Please check the data format.
          </p>
          
          {process.env.NODE_ENV === 'development' && this.state.error && (
            <details className="text-left w-full max-w-md">
              <summary 
                className="text-xs cursor-pointer mb-2"
                style={{ color: JOVEO_COLORS.textSecondary }}
              >
                Error Details (Development)
              </summary>
              <pre 
                className="text-xs p-2 rounded overflow-auto max-h-32"
                style={{ 
                  backgroundColor: JOVEO_COLORS.gray100,
                  color: JOVEO_COLORS.textPrimary
                }}
              >
                {this.state.error.message}
              </pre>
            </details>
          )}
          
          <button
            onClick={() => this.setState({ hasError: false, error: undefined })}
            className="px-4 py-2 text-sm rounded transition-colors"
            style={{
              backgroundColor: JOVEO_COLORS.primary,
              color: JOVEO_COLORS.backgroundPrimary,
              fontFamily: 'SF Pro Text, sans-serif'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.opacity = '0.9';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.opacity = '1';
            }}
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * HOC wrapper for easy use with functional components
 */
export function withChartErrorBoundary<T extends object>(
  Component: React.ComponentType<T>
) {
  return function WrappedComponent(props: T) {
    return (
      <ChartErrorBoundary>
        <Component {...props} />
      </ChartErrorBoundary>
    );
  };
}

/**
 * Hook for functional components to wrap their content
 */
export function useChartErrorBoundary() {
  return {
    ChartErrorBoundary,
    withErrorBoundary: withChartErrorBoundary
  };
}
