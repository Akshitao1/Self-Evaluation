import { NextResponse } from 'next/server';

// Sample data for the combination chart (Spend vs CPA)
const combinationChartData = [
  { period: '01', spend: 2500, cpa: 12.5, date: '01 Aug 2025' },
  { period: '02', spend: 1000, cpa: 8.2, date: '02 Aug 2025' },
  { period: '03', spend: 2000, cpa: 14.8, date: '03 Aug 2025' },
  { period: '04', spend: 3000, cpa: 18.1, date: '04 Aug 2025' },
  { period: '05', spend: 4500, cpa: 22.3, date: '05 Aug 2025' },
  { period: '06', spend: 3000, cpa: 16.7, date: '06 Aug 2025' },
  { period: '07', spend: 3800, cpa: 19.5, date: '07 Aug 2025' },
  { period: '08', spend: 4200, cpa: 21.2, date: '08 Aug 2025' },
  { period: '09', spend: 3600, cpa: 17.8, date: '09 Aug 2025' },
  { period: '10', spend: 4100, cpa: 20.1, date: '10 Aug 2025' }
];

export async function GET() {
  try {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 300));
    
    return NextResponse.json(combinationChartData);
  } catch {
    return NextResponse.json(
      { error: 'Failed to fetch chart data' },
      { status: 500 }
    );
  }
}
