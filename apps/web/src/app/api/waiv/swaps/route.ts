import { NextResponse, type NextRequest } from 'next/server';

import { getWaivSwapsPage } from '@/modules/waiv-token/server';

const CURSOR_MAX_LENGTH = 200;

export async function GET(request: NextRequest) {
  const cursor = request.nextUrl.searchParams.get('cursor');
  if (cursor !== null && (cursor.length === 0 || cursor.length > CURSOR_MAX_LENGTH)) {
    return NextResponse.json({ error: 'invalid_cursor' }, { status: 400 });
  }
  const page = await getWaivSwapsPage(cursor);
  if (!page) {
    return NextResponse.json({ error: 'unavailable' }, { status: 503 });
  }
  return NextResponse.json(page);
}
