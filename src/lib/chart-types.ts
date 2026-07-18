/**
 * Standardized Chart Data Types for Joveo Dashboard
 * All charts use these unified interfaces for consistency
 */

// ==================== CORE DATA INTERFACES ====================

/**
 * Base interface for all chart data points
 */
export interface BaseDataPoint {
  [key: string]: string | number | boolean | null | undefined;
}

/**
 * Universal chart data format - works with all chart types
 */
export interface UniversalChartData {
  title?: string;
  subtitle?: string;
  data: BaseDataPoint[];
  config?: ChartConfig;
}

/**
 * Chart configuration options
 */
export interface ChartConfig {
  title?: string;
  colors?: string[];
  height?: number;
  showLegend?: boolean;
  showTooltip?: boolean;
  showGrid?: boolean;
  responsive?: boolean;
  xAxisKey?: string;
  yAxisKey?: string | string[];
  formatters?: {
    [key: string]: (value: any) => string;
  };
}

// ==================== CHART-SPECIFIC INTERFACES ====================

/**
 * Bar Chart Data - Compatible with Recharts BarChart
 */
export interface BarChartData extends UniversalChartData {
  data: Array<{
    category: string;
    value: number;
    [key: string]: string | number;
  }>;
}

/**
 * Multi-Series Bar Chart Data
 */
export interface MultiBarChartData extends UniversalChartData {
  data: Array<{
    category: string;
    [seriesName: string]: string | number;
  }>;
  series: string[]; // Names of the data series
}

/**
 * Line Chart Data - Compatible with Recharts LineChart
 */
export interface LineChartData extends UniversalChartData {
  data: Array<{
    category: string;
    value: number;
    [key: string]: string | number;
  }>;
}

/**
 * Multi-Line Chart Data
 */
export interface MultiLineChartData extends UniversalChartData {
  data: Array<{
    category: string;
    [seriesName: string]: string | number;
  }>;
  series: string[];
}

/**
 * Pie Chart Data - Compatible with Recharts PieChart
 */
export interface PieChartData extends UniversalChartData {
  data: Array<{
    name: string;
    value: number;
    fill?: string;
  }>;
}

/**
 * Combination Chart Data - Compatible with Recharts ComposedChart
 */
export interface CombinationChartData extends UniversalChartData {
  data: Array<{
    category: string;
    [key: string]: string | number;
  }>;
  barSeries?: string[];
  lineSeries?: string[];
  areaSeries?: string[];
}

/**
 * Area Chart Data - Compatible with Recharts AreaChart
 */
export interface AreaChartData extends UniversalChartData {
  data: Array<{
    category: string;
    value: number;
    [key: string]: string | number;
  }>;
}

// ==================== COMMON DATA FORMATS ====================

/**
 * Time series data format (common for spend/performance data)
 */
export interface TimeSeriesData {
  date: string | Date;
  value: number;
  [key: string]: string | number | Date;
}

/**
 * Category value data format (common for channel/demographic data)
 */
export interface CategoryValueData {
  category: string;
  value: number;
  percentage?: number;
  [key: string]: string | number;
}

/**
 * Key-value pair data format (simplest format)
 */
export interface KeyValueData {
  key: string;
  value: number;
  [key: string]: string | number;
}

// ==================== DATA TRANSFORMATION TYPES ====================

/**
 * Supported input data formats that can be auto-transformed
 */
export type SupportedDataFormat = 
  | BaseDataPoint[]
  | TimeSeriesData[]
  | CategoryValueData[]
  | KeyValueData[]
  | Record<string, number>
  | [string, number][];

/**
 * Chart type enumeration
 */
export enum ChartType {
  BAR = 'bar',
  MULTI_BAR = 'multiBar',
  LINE = 'line',
  MULTI_LINE = 'multiLine',
  PIE = 'pie',
  AREA = 'area',
  COMBINATION = 'combination'
}

/**
 * Extended chart config for multi-bar charts
 */
export interface MultiBarChartConfig extends ChartConfig {
  series?: string[];
}

/**
 * Extended chart config for combination charts
 */
export interface CombinationChartConfig extends ChartConfig {
  barSeries?: string[];
  lineSeries?: string[];
  areaSeries?: string[];
}

/**
 * Data processor function type
 */
export type DataProcessor<T extends UniversalChartData> = (
  data: SupportedDataFormat,
  config?: ChartConfig
) => T;

// ==================== VALIDATION TYPES ====================

/**
 * Data validation result
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Data validator function type
 */
export type DataValidator = (data: any) => ValidationResult;
