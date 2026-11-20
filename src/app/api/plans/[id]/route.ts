import { NextRequest, NextResponse } from 'next/server';
import {
  deletePracticePlan,
  getPracticePlanById,
  updatePracticePlan,
} from '@/lib/db';
import { requireAdmin, getOptionalSession } from '@/lib/auth';
import { toPublicPlan } from '@/lib/publicDto';

// Public read.
export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const [session, plan] = await Promise.all([getOptionalSession(), getPracticePlanById(id)]);
  if (!plan) {
    return NextResponse.json({ error: 'Practice plan not found' }, { status: 404 });
  }
  return NextResponse.json({
    plan: session?.user.role === 'ADMIN' ? plan : toPublicPlan(plan),
  });
}

// Admin only.
export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { id } = await context.params;
  try {
    const body = await req.json();
    const updated = await updatePracticePlan(id, body);
    if (!updated) {
      return NextResponse.json({ error: 'Practice plan not found' }, { status: 404 });
    }
    return NextResponse.json({ plan: updated });
  } catch {
    return NextResponse.json({ error: 'Failed to update practice plan' }, { status: 500 });
  }
}

// Admin only.
export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { id } = await context.params;
  const deleted = await deletePracticePlan(id);
  return NextResponse.json({ deleted });
}
