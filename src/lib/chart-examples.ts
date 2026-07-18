/**
 * Chart Usage Examples and Documentation
 * Demonstrates how to use the standardized Joveo chart system
 */

import { type SupportedDataFormat } from './chart-types';

// ==================== SAMPLE DATA ====================

/**
 * Simple array of objects (most common format)
 */
export const sampleBarData: SupportedDataFormat = [
  { category: 'Search', value: 25000 },
  { category: 'Social', value: 18000 },
  { category: 'Display', value: 22000 },
  { category: 'Video', value: 15000 },
  { category: 'Email', value: 12000 }
];

/**
 * Multi-series data for grouped bar charts
 */
export const sampleMultiBarData: SupportedDataFormat = [
  { category: 'Q1', revenue: 25000, spend: 8000, profit: 17000 },
  { category: 'Q2', revenue: 32000, spend: 12000, profit: 20000 },
  { category: 'Q3', revenue: 28000, spend: 10000, profit: 18000 },
  { category: 'Q4', revenue: 35000, spend: 13000, profit: 22000 }
];

/**
 * Time series data
 */
export const sampleTimeSeriesData: SupportedDataFormat = [
  { date: '2024-01', spend: 15000, cpa: 25.50 },
  { date: '2024-02', spend: 18000, cpa: 22.30 },
  { date: '2024-03', spend: 22000, cpa: 28.75 },
  { date: '2024-04', spend: 19000, cpa: 24.10 },
  { date: '2024-05', spend: 25000, cpa: 21.80 }
];

/**
 * Pie chart data
 */
export const samplePieData: SupportedDataFormat = [
  { name: 'Desktop', value: 45 },
  { name: 'Mobile', value: 35 },
  { name: 'Tablet', value: 20 }
];

/**
 * Channel spend data
 */
export const sampleChannelData: SupportedDataFormat = [
  { channel: 'Google Ads', spend: 45000 },
  { channel: 'Facebook', spend: 28000 },
  { channel: 'LinkedIn', spend: 18000 },
  { channel: 'Twitter', spend: 12000 },
  { channel: 'TikTok', spend: 8000 }
];

/**
 * Key-value pairs (simple format)
 */
export const sampleKeyValueData: [string, number][] = [
  ['Active', 156],
  ['Pending', 89],
  ['Inactive', 34],
  ['Suspended', 12]
];

/**
 * Object format (simple)
 */
export const sampleObjectData: Record<string, number> = {
  'North America': 52000,
  'Europe': 38000,
  'Asia Pacific': 29000,
  'Latin America': 15000,
  'Africa': 8000
};

// ==================== USAGE EXAMPLES ====================

/**
 * Example usage patterns for different chart types
 */
export const chartUsageExamples = {
  
  // Basic Bar Chart
  barChart: {
    simple: `
// Simple bar chart with minimal config
<JoveoBarChart 
  data={sampleBarData}
  title="Channel Performance"
/>`,
    
    advanced: `
// Advanced bar chart with custom styling
<JoveoBarChart 
  data={sampleBarData}
  title="Channel Performance"
  height={400}
  showTooltip={true}
  colorPalette="channels"
  className="my-custom-class"
/>`
  },

  // Multi-Bar Chart  
  multiBarChart: {
    simple: `
// Grouped bar chart
<JoveoBarChart 
  data={sampleMultiBarData}
  title="Quarterly Performance"
  variant="grouped"
  showLegend={true}
/>`,
    
    advanced: `
// Custom multi-bar chart
<JoveoBarChart 
  data={sampleMultiBarData}
  title="Quarterly Performance"
  variant="grouped"
  height={350}
  showLegend={true}
  colorPalette="performance"
/>`
  },

  // Pie Chart
  pieChart: {
    simple: `
// Simple pie chart
<JoveoPieChart 
  data={samplePieData}
  title="Device Distribution"
/>`,
    
    advanced: `
// Compact pie chart with custom colors
<JoveoPieChart 
  data={samplePieData}
  title="Device Distribution"
  variant="compact"
  height={250}
  colorPalette="status"
  showLegend={true}
/>`
  },

  // Combination Chart
  combinationChart: {
    simple: `
// Auto-detected combination chart
<JoveoCombinationChart 
  data={sampleTimeSeriesData}
  title="Spend vs CPA"
/>`,
    
    advanced: `
// Custom combination chart
<JoveoCombinationChart 
  data={sampleTimeSeriesData}
  title="Performance Trends"
  height={400}
  barSeries={['spend']}
  lineSeries={['cpa']}
  colorPalette="performance"
  showLegend={true}
/>`
  },

  // Spend by Channel Chart
  spendByChannel: {
    simple: `
// Simple spend chart
<JoveoSpendByChannelChart 
  data={sampleChannelData}
/>`,
    
    advanced: `
// Custom spend chart
<JoveoSpendByChannelChart 
  data={sampleChannelData}
  title="Marketing Spend by Channel"
  height={350}
  colorPalette="channels"
  showTooltip={true}
/>`
  }
};

// ==================== DATA FORMAT EXAMPLES ====================

/**
 * All the different data formats that are automatically supported
 */
export const supportedDataFormats = {
  
  // Array of objects (recommended)
  arrayOfObjects: [
    { category: 'A', value: 100 },
    { category: 'B', value: 200 }
  ],

  // Multi-series objects
  multiSeries: [
    { category: 'Q1', sales: 1000, marketing: 200 },
    { category: 'Q2', sales: 1200, marketing: 250 }
  ],

  // Key-value pairs
  keyValuePairs: [
    ['Category A', 100],
    ['Category B', 200]
  ],

  // Simple object
  simpleObject: {
    'Category A': 100,
    'Category B': 200
  },

  // Time series
  timeSeries: [
    { date: '2024-01', value: 100 },
    { date: '2024-02', value: 150 }
  ],

  // Pie chart format
  pieFormat: [
    { name: 'Slice A', value: 30 },
    { name: 'Slice B', value: 70 }
  ]
};

// ==================== COLOR PALETTE EXAMPLES ====================

/**
 * Available color palettes and their use cases
 */
export const colorPaletteGuide = {
  default: {
    description: 'General purpose palette for most charts',
    colors: ['#303F9F', '#7681E8', '#43A047', '#FFAB00', '#FF5252'],
    bestFor: ['General data', 'Mixed categories', 'Default use cases']
  },
  
  performance: {
    description: 'Performance-focused palette for metrics',
    colors: ['#303F9F', '#43A047', '#FFAB00', '#FF5252', '#7681E8'],
    bestFor: ['Revenue charts', 'Performance metrics', 'KPI dashboards']
  },
  
  channels: {
    description: 'Marketing channel specific colors',
    colors: ['#303F9F', '#7681E8', '#43A047', '#FFAB00', '#FF5252', '#7C4DFF'],
    bestFor: ['Channel performance', 'Marketing data', 'Spend analysis']
  },
  
  status: {
    description: 'Status-based colors for states',
    colors: ['#43A047', '#FFAB00', '#FF5252', '#6B7280'],
    bestFor: ['Status charts', 'Health metrics', 'Binary states']
  }
};

// ==================== QUICK REFERENCE ====================

/**
 * Quick reference for common chart patterns
 */
export const quickReference = {
  
  // When to use each chart type
  chartTypeGuide: {
    bar: 'Comparing categories or showing discrete values',
    multiBar: 'Comparing multiple metrics across categories', 
    pie: 'Showing parts of a whole or percentages',
    line: 'Showing trends over time',
    combination: 'Comparing different types of metrics together',
    area: 'Showing volume or cumulative data over time'
  },

  // Common prop patterns
  commonProps: {
    title: 'Chart title (optional)',
    height: 'Chart height in pixels (default: 300)',
    showLegend: 'Show/hide legend (varies by chart)',
    showTooltip: 'Show/hide tooltips (default: true)',
    colorPalette: 'Color scheme to use',
    className: 'Additional CSS classes'
  },

  // Error handling
  errorHandling: {
    invalidData: 'Charts validate data and show helpful error messages',
    emptyData: 'Empty arrays are handled gracefully with error messages',
    malformedData: 'Data format issues are caught and reported clearly'
  }
};

// ==================== MIGRATION GUIDE ====================

/**
 * Migration guide from old chart format to new standardized format
 */
export const migrationGuide = {
  
  oldBarChart: {
    before: `
// Old format (complex, error-prone)
<JoveoBarChart 
  data={{
    title: "My Chart",
    labels: ["A", "B", "C"],
    datasets: [{
      label: "Series 1",
      data: [10, 20, 30],
      colorIndex: 0
    }]
  }}
/>`,
    
    after: `
// New format (simple, flexible)
<JoveoBarChart 
  data={[
    { category: "A", value: 10 },
    { category: "B", value: 20 },
    { category: "C", value: 30 }
  ]}
  title="My Chart"
/>`
  },

  oldPieChart: {
    before: `
// Old format (custom SVG, complex)
<JoveoPieChart 
  data={{
    title: "Distribution",
    values: [30, 40, 30],
    labels: ["A", "B", "C"],
    legend: [...]
  }}
/>`,
    
    after: `
// New format (Recharts-based, simple)
<JoveoPieChart 
  data={[
    { name: "A", value: 30 },
    { name: "B", value: 40 },
    { name: "C", value: 30 }
  ]}
  title="Distribution"
/>`
  }
};

/**
 * Benefits of the new system
 */
export const systemBenefits = {
  consistency: 'All charts use the same data format and API',
  flexibility: 'Automatic data transformation from multiple input formats',
  reliability: 'Built-in validation and error handling',
  performance: 'Optimized Recharts-based rendering',
  maintainability: 'Centralized styling and color management',
  accessibility: 'Built-in ARIA labels and keyboard navigation',
  documentation: 'Comprehensive examples and type safety'
};
