import { NextRequest, NextResponse } from 'next/server';
import {
  deleteOffIcePractice,
  getOffIcePracticeById,
  updateOffIcePractice,
} from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

// Public read.
export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const practice = await getOffIcePracticeById(id);
  if (!practice) {
    return NextResponse.json({ error: 'Off-ice practice not found' }, { status: 404 });
  }
  const { ownerId: _ownerId, ...publicPractice } = practice;
  return NextResponse.json({ practice: publicPractice });
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
    const practice = await updateOffIcePractice(id, body);
    if (!practice) {
      return NextResponse.json({ error: 'Off-ice practice not found' }, { status: 404 });
    }
    return NextResponse.json({ practice });
  } catch {
    return NextResponse.json({ error: 'Failed to update off-ice practice' }, { status: 400 });
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
  const deleted = await deleteOffIcePractice(id);
  return NextResponse.json({ deleted });
}
