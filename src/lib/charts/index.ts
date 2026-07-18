/**
 * Joveo Chart System - Main Export File
 * Import everything you need from this single file
 */

// ==================== TYPES ====================
export type {
  // Core Types
  SupportedDataFormat,
  UniversalChartData,
  ChartConfig,
  MultiBarChartConfig,
  CombinationChartConfig,
  
  // Chart-Specific Types
  BarChartData,
  MultiBarChartData,
  LineChartData,
  MultiLineChartData,
  PieChartData,
  CombinationChartData,
  AreaChartData,
  
  // Common Data Types
  BaseDataPoint,
  TimeSeriesData,
  CategoryValueData,
  KeyValueData,
  
  // Validation Types
  ValidationResult,
  DataValidator,
  DataProcessor
} from '../chart-types';

export { ChartType } from '../chart-types';

// ==================== DESIGN TOKENS ====================
export {
  // Colors
  JOVEO_COLORS,
  CHART_COLOR_PALETTES,
  
  // Typography & Styling
  TYPOGRAPHY,
  SPACING,
  CHART_DIMENSIONS,
  ANIMATIONS,
  CHART_STYLES,
  
  // Helper Functions
  getColorPalette,
  getColorByIndex,
  getChartTheme,
  
  // Types
  type JoveoColorKey,
  type ChartColorPalette,
  type ChartVariant
} from '../joveo-design-tokens';

// ==================== DATA PROCESSING ====================
export {
  // Validation Functions
  validateChartData,
  validateChartDataFormat,
  
  // Data Transformation
  normalizeData,
  detectChartType,
  
  // Chart-Specific Processors
  processBarChartData,
  processMultiBarChartData,
  processLineChartData,
  processPieChartData,
  processCombinationChartData,
  processAreaChartData,
  
  // Smart Processor
  processChartData,
  
  // Utility Functions
  formatCurrency,
  formatPercentage,
  formatNumber,
  createFormatters
} from '../chart-data-processor';

// ==================== EXAMPLES & DOCUMENTATION ====================
export {
  // Sample Data
  sampleBarData,
  sampleMultiBarData,
  sampleTimeSeriesData,
  samplePieData,
  sampleChannelData,
  sampleKeyValueData,
  sampleObjectData,
  
  // Usage Examples
  chartUsageExamples,
  supportedDataFormats,
  colorPaletteGuide,
  quickReference,
  migrationGuide,
  systemBenefits
} from '../chart-examples';

// ==================== CHART COMPONENTS ====================
// Note: Chart components should be imported directly from their files
// Example: import { JoveoBarChart } from '@/components/ui/charts/JoveoBarChart';

/**
 * Quick Start Guide:
 * 
 * 1. Import chart component:
 *    import { JoveoBarChart } from '@/components/ui/charts';
 * 
 * 2. Import types if needed:
 *    import type { SupportedDataFormat } from '@/lib/charts';
 * 
 * 3. Use with any data format:
 *    <JoveoBarChart data={yourData} title="My Chart" />
 * 
 * 4. The system handles the rest automatically!
 */
