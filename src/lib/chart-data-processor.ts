/**
 * Chart Data Processing Utilities
 * Smart data transformation and validation for all chart types
 */

import {
  type SupportedDataFormat,
  type UniversalChartData,
  type BarChartData,
  type MultiBarChartData,
  type LineChartData,
  type MultiLineChartData,
  type PieChartData,
  type CombinationChartData,
  type AreaChartData,
  type ChartConfig,
  type MultiBarChartConfig,
  type CombinationChartConfig,
  type ValidationResult,
  type BaseDataPoint,
  ChartType
} from './chart-types';
import { getColorPalette, type ChartColorPalette } from './joveo-design-tokens';

// ==================== DATA VALIDATION ====================

/**
 * Validates input data and returns validation result
 */
export function validateChartData(data: any): ValidationResult {
  const result: ValidationResult = {
    isValid: true,
    errors: [],
    warnings: []
  };

  // Check if data exists
  if (!data) {
    result.isValid = false;
    result.errors.push('Data is required');
    return result;
  }

  // Check if data is an array
  if (!Array.isArray(data)) {
    result.isValid = false;
    result.errors.push('Data must be an array');
    return result;
  }

  // Check if data is not empty
  if (data.length === 0) {
    result.isValid = false;
    result.errors.push('Data array cannot be empty');
    return result;
  }

  // Validate each data point
  data.forEach((item, index) => {
    if (typeof item !== 'object' || item === null) {
      result.errors.push(`Data item at index ${index} must be an object`);
      result.isValid = false;
    }
  });

  return result;
}

/**
 * Validates specific chart data format
 */
export function validateChartDataFormat(
  data: BaseDataPoint[],
  chartType: ChartType
): ValidationResult {
  const result = validateChartData(data);
  if (!result.isValid) return result;

  const firstItem = data[0];
  
  switch (chartType) {
    case ChartType.BAR:
    case ChartType.LINE:
    case ChartType.AREA:
      if (!('category' in firstItem) && !('name' in firstItem) && !('label' in firstItem)) {
        result.warnings.push('Consider having a "category", "name", or "label" field for better chart rendering');
      }
      break;
      
    case ChartType.PIE:
      if (!('name' in firstItem) || !('value' in firstItem)) {
        result.warnings.push('Pie charts work best with "name" and "value" fields');
      }
      break;
      
    case ChartType.COMBINATION:
      if (Object.keys(firstItem).length < 3) {
        result.warnings.push('Combination charts typically need multiple data series');
      }
      break;
  }

  return result;
}

// ==================== DATA NORMALIZATION ====================

/**
 * Normalizes input data to a consistent format
 */
export function normalizeData(data: SupportedDataFormat): BaseDataPoint[] {
  // Handle array of key-value pairs [[key, value], ...]
  if (Array.isArray(data) && data.length > 0 && Array.isArray(data[0])) {
    return (data as [string, number][]).map(([key, value]) => ({
      category: key,
      name: key,
      value: value
    }));
  }

  // Handle simple object {key: value, ...}
  if (!Array.isArray(data) && typeof data === 'object') {
    return Object.entries(data as Record<string, number>).map(([key, value]) => ({
      category: key,
      name: key,
      value: value
    }));
  }

  // Handle array of objects (already normalized)
  if (Array.isArray(data)) {
    return data.map(item => {
      if (typeof item === 'object' && item !== null) {
        return item as BaseDataPoint;
      }
      return { value: item as number };
    });
  }

  throw new Error('Unsupported data format');
}

/**
 * Auto-detects the most appropriate chart type based on data structure
 */
export function detectChartType(data: BaseDataPoint[]): ChartType {
  if (data.length === 0) return ChartType.BAR;

  const firstItem = data[0];
  const keys = Object.keys(firstItem);
  const numericKeys = keys.filter(key => typeof firstItem[key] === 'number');

  // Pie chart: has name/label and single value
  if ((keys.includes('name') || keys.includes('label')) && numericKeys.length === 1) {
    return ChartType.PIE;
  }

  // Multi-series: multiple numeric values
  if (numericKeys.length > 1) {
    // Check if it looks like time series data for combination chart
    if (keys.some(key => key.toLowerCase().includes('date') || key.toLowerCase().includes('time'))) {
      return ChartType.COMBINATION;
    }
    return ChartType.MULTI_BAR;
  }

  // Single series with time-like data
  if (keys.some(key => key.toLowerCase().includes('date') || key.toLowerCase().includes('time'))) {
    return ChartType.LINE;
  }

  // Default to bar chart
  return ChartType.BAR;
}

// ==================== CHART DATA PROCESSORS ====================

/**
 * Processes data for Bar Charts
 */
export function processBarChartData(
  data: SupportedDataFormat,
  config?: ChartConfig
): BarChartData {
  const normalized = normalizeData(data);
  const validation = validateChartDataFormat(normalized, ChartType.BAR);
  
  if (!validation.isValid) {
    console.error('Bar chart data validation failed:', validation.errors);
    throw new Error(`Invalid bar chart data: ${validation.errors.join(', ')}`);
  }

  // Transform to bar chart format
  const chartData = normalized.map(item => {
    const category = (item.category || item.name || item.label || 'Category') as string;
    const value = (item.value || Object.values(item).find(v => typeof v === 'number') || 0) as number;
    
    return {
      category,
      value,
      ...item // Include any additional properties
    };
  });

  return {
    title: config?.title || 'Bar Chart',
    data: chartData,
    config: {
      colors: config?.colors || getColorPalette('default'),
      height: config?.height || 300,
      showLegend: config?.showLegend ?? false,
      showTooltip: config?.showTooltip ?? true,
      showGrid: config?.showGrid ?? true,
      ...config
    }
  };
}

/**
 * Processes data for Multi-Bar Charts
 */
export function processMultiBarChartData(
  data: SupportedDataFormat,
  config?: MultiBarChartConfig
): MultiBarChartData {
  const normalized = normalizeData(data);
  const validation = validateChartDataFormat(normalized, ChartType.MULTI_BAR);

  if (!validation.isValid) {
    console.error('Multi-bar chart data validation failed:', validation.errors);
    throw new Error(`Invalid multi-bar chart data: ${validation.errors.join(', ')}`);
  }

  // Auto-detect series if not provided
  const firstItem = normalized[0];
  const allKeys = Object.keys(firstItem);
  const categoryKey = allKeys.find(key => 
    key === 'category' || key === 'name' || key === 'label'
  ) || allKeys[0];
  
  const series = config?.series || allKeys.filter(key => 
    key !== categoryKey && typeof firstItem[key] === 'number'
  );

  const chartData = normalized.map(item => {
    const category = (item[categoryKey] || 'Category') as string;
    const result: any = { category };
    
    // Add each series value
    series.forEach(seriesName => {
      result[seriesName] = item[seriesName] || 0;
    });
    
    return result;
  });

  return {
    title: config?.title || 'Multi-Bar Chart',
    data: chartData,
    series,
    config: {
      colors: config?.colors || getColorPalette('default'),
      height: config?.height || 300,
      showLegend: config?.showLegend ?? true,
      showTooltip: config?.showTooltip ?? true,
      showGrid: config?.showGrid ?? true,
      ...config
    }
  };
}

/**
 * Processes data for Line Charts
 */
export function processLineChartData(
  data: SupportedDataFormat,
  config?: ChartConfig
): LineChartData {
  const normalized = normalizeData(data);
  const validation = validateChartDataFormat(normalized, ChartType.LINE);

  if (!validation.isValid) {
    console.error('Line chart data validation failed:', validation.errors);
    throw new Error(`Invalid line chart data: ${validation.errors.join(', ')}`);
  }

  const chartData = normalized.map(item => {
    const category = (item.category || item.name || item.label || item.date || 'Category') as string;
    const value = (item.value || Object.values(item).find(v => typeof v === 'number') || 0) as number;
    
    return {
      category,
      value,
      ...item
    };
  });

  return {
    title: config?.title || 'Line Chart',
    data: chartData,
    config: {
      colors: config?.colors || getColorPalette('performance'),
      height: config?.height || 300,
      showLegend: config?.showLegend ?? false,
      showTooltip: config?.showTooltip ?? true,
      showGrid: config?.showGrid ?? true,
      ...config
    }
  };
}

/**
 * Processes data for Pie Charts
 */
export function processPieChartData(
  data: SupportedDataFormat,
  config?: ChartConfig
): PieChartData {
  const normalized = normalizeData(data);
  const validation = validateChartDataFormat(normalized, ChartType.PIE);

  if (!validation.isValid) {
    console.error('Pie chart data validation failed:', validation.errors);
    throw new Error(`Invalid pie chart data: ${validation.errors.join(', ')}`);
  }

  const colors = config?.colors || getColorPalette('default');
  
  const chartData = normalized.map((item, index) => {
    const name = (item.name || item.category || item.label || `Slice ${index + 1}`) as string;
    const value = (item.value || Object.values(item).find(v => typeof v === 'number') || 0) as number;
    
    return {
      name,
      value,
      fill: item.fill as string || colors[index % colors.length]
    };
  });

  return {
    title: config?.title || 'Pie Chart',
    data: chartData,
    config: {
      colors,
      height: config?.height || 300,
      showLegend: config?.showLegend ?? true,
      showTooltip: config?.showTooltip ?? true,
      ...config
    }
  };
}

/**
 * Processes data for Combination Charts
 */
export function processCombinationChartData(
  data: SupportedDataFormat,
  config?: CombinationChartConfig
): CombinationChartData {
  const normalized = normalizeData(data);
  const validation = validateChartDataFormat(normalized, ChartType.COMBINATION);

  if (!validation.isValid) {
    console.error('Combination chart data validation failed:', validation.errors);
    throw new Error(`Invalid combination chart data: ${validation.errors.join(', ')}`);
  }

  // Auto-detect series if not provided
  const firstItem = normalized[0];
  const allKeys = Object.keys(firstItem);
  const categoryKey = allKeys.find(key => 
    key === 'category' || key === 'name' || key === 'label' || 
    key.toLowerCase().includes('date') || key.toLowerCase().includes('period')
  ) || allKeys[0];
  
  const numericKeys = allKeys.filter(key => 
    key !== categoryKey && typeof firstItem[key] === 'number'
  );

  const barSeries = config?.barSeries || numericKeys.slice(0, Math.ceil(numericKeys.length / 2));
  const lineSeries = config?.lineSeries || numericKeys.slice(Math.ceil(numericKeys.length / 2));

  const chartData = normalized.map(item => {
    const category = (item[categoryKey] || 'Category') as string;
    const result: any = { category };
    
    // Add all numeric values
    numericKeys.forEach(key => {
      result[key] = item[key] || 0;
    });
    
    return result;
  });

  return {
    title: config?.title || 'Combination Chart',
    data: chartData,
    barSeries,
    lineSeries,
    areaSeries: config?.areaSeries || [],
    config: {
      colors: config?.colors || getColorPalette('performance'),
      height: config?.height || 300,
      showLegend: config?.showLegend ?? true,
      showTooltip: config?.showTooltip ?? true,
      showGrid: config?.showGrid ?? true,
      ...config
    }
  };
}

/**
 * Processes data for Area Charts
 */
export function processAreaChartData(
  data: SupportedDataFormat,
  config?: ChartConfig
): AreaChartData {
  const normalized = normalizeData(data);
  const validation = validateChartDataFormat(normalized, ChartType.AREA);

  if (!validation.isValid) {
    console.error('Area chart data validation failed:', validation.errors);
    throw new Error(`Invalid area chart data: ${validation.errors.join(', ')}`);
  }

  const chartData = normalized.map(item => {
    const category = (item.category || item.name || item.label || item.date || 'Category') as string;
    const value = (item.value || Object.values(item).find(v => typeof v === 'number') || 0) as number;
    
    return {
      category,
      value,
      ...item
    };
  });

  return {
    title: config?.title || 'Area Chart',
    data: chartData,
    config: {
      colors: config?.colors || getColorPalette('performance'),
      height: config?.height || 300,
      showLegend: config?.showLegend ?? false,
      showTooltip: config?.showTooltip ?? true,
      showGrid: config?.showGrid ?? true,
      ...config
    }
  };
}

// ==================== SMART CHART PROCESSOR ====================

/**
 * Automatically processes data and detects the best chart type
 */
export function processChartData(
  data: SupportedDataFormat,
  preferredType?: ChartType,
  config?: ChartConfig
): UniversalChartData {
  const normalized = normalizeData(data);
  const detectedType = preferredType || detectChartType(normalized);

  switch (detectedType) {
    case ChartType.BAR:
      return processBarChartData(data, config);
      
    case ChartType.MULTI_BAR:
      return processMultiBarChartData(data, config);
      
    case ChartType.LINE:
      return processLineChartData(data, config);
      
    case ChartType.PIE:
      return processPieChartData(data, config);
      
    case ChartType.COMBINATION:
      return processCombinationChartData(data, config);
      
    case ChartType.AREA:
      return processAreaChartData(data, config);
      
    default:
      return processBarChartData(data, config);
  }
}

// ==================== UTILITY FUNCTIONS ====================

/**
 * Formats currency values
 */
export function formatCurrency(value: number): string {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(1)}K`;
  }
  return `$${value.toLocaleString()}`;
}

/**
 * Formats percentage values
 */
export function formatPercentage(value: number): string {
  return `${value.toFixed(1)}%`;
}

/**
 * Formats large numbers
 */
export function formatNumber(value: number): string {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }
  return value.toLocaleString();
}

/**
 * Creates default formatters for common data types
 */
export function createFormatters(dataType: 'currency' | 'percentage' | 'number' = 'number') {
  switch (dataType) {
    case 'currency':
      return { value: formatCurrency };
    case 'percentage':
      return { value: formatPercentage };
    default:
      return { value: formatNumber };
  }
}
