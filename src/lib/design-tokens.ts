import designSystem from '../../.cursor/profiles/joveo-ai-dashboard/design.json';

// Safe chart configuration helper aligned to the available JSON structure
export function getChartConfig(type: string, variant = 'default') {
  const charts: Record<string, any> = (designSystem as any)?.components?.charts || {};
  const chartConfig = charts?.[type];
  const variants = chartConfig?.variants;
  return variants ? variants[variant] : undefined;
}

// Export raw tokens for consumers that want to read from the JSON directly
export const designTokens: any = (designSystem as any)?.designTokens || {};
export default designSystem as any;
