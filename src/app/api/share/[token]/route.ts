import { NextRequest, NextResponse } from 'next/server';
import { getPracticePlanByShareToken } from '@/lib/db';

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  const { token } = await context.params;
  const plan = await getPracticePlanByShareToken(token);
  if (!plan) {
    return NextResponse.json(
      { error: 'Shared practice plan not found or sharing is disabled.' },
      { status: 404 }
    );
  }
  return NextResponse.json({ plan });
}
