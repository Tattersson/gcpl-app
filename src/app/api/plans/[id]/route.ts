import { NextRequest, NextResponse } from 'next/server';
import {
  deletePracticePlan,
  getPracticePlanById,
  updatePracticePlan,
} from '@/lib/db';
import { getServerSession } from '@/lib/auth';

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await context.params;
  const plan = await getPracticePlanById(id);
  if (!plan) {
    return NextResponse.json({ error: 'Practice plan not found' }, { status: 404 });
  }
  return NextResponse.json({ plan });
}

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await context.params;
  try {
    const body = await req.json();
    const updated = await updatePracticePlan(id, body);
    if (!updated) {
      return NextResponse.json({ error: 'Practice plan not found' }, { status: 404 });
    }
    return NextResponse.json({ plan: updated });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Failed to update practice plan' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await context.params;
  const deleted = await deletePracticePlan(id);
  return NextResponse.json({ deleted });
}
