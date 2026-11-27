import { NextResponse, type NextRequest } from 'next/server';

import { getWaivChart, parseWaivChartPeriod } from '@/modules/waiv-token/server';

export async function GET(request: NextRequest) {
  const period = parseWaivChartPeriod(request.nextUrl.searchParams.get('period'));
  if (!period) {
    return NextResponse.json({ error: 'invalid_period' }, { status: 400 });
  }
  const chart = await getWaivChart(period);
  if (!chart) {
    return NextResponse.json({ error: 'unavailable' }, { status: 503 });
  }
  return NextResponse.json(chart);
}
