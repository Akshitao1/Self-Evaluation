import { NextResponse } from 'next/server';

// Sample data for the dashboard charts
const sampleData = [
  { Category: 'Search', 'Total Days': '120450', 'Spend': '120450', 'CPA': '18.20' },
  { Category: 'Display', 'Total Days': '89000', 'Spend': '89000', 'CPA': '22.15' },
  { Category: 'Social', 'Total Days': '156000', 'Spend': '156000', 'CPA': '15.80' },
  { Category: 'Video', 'Total Days': '98000', 'Spend': '98000', 'CPA': '25.40' },
  { Category: 'Affiliate', 'Total Days': '67000', 'Spend': '67000', 'CPA': '28.90' },
  { Category: 'Direct', 'Total Days': '45000', 'Spend': '45000', 'CPA': '12.50' },
  { Category: 'Email', 'Total Days': '32000', 'Spend': '32000', 'CPA': '8.75' },
  { Category: 'Retargeting', 'Total Days': '78000', 'Spend': '78000', 'CPA': '19.20' }
];

export async function GET() {
  try {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    return NextResponse.json(sampleData);
  } catch {
    return NextResponse.json(
      { error: 'Failed to fetch data' },
      { status: 500 }
    );
  }
}
