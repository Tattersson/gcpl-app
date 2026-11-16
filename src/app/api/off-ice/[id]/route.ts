import { NextRequest, NextResponse } from 'next/server';
import {
  deleteOffIcePractice,
  getOffIcePracticeById,
  updateOffIcePractice,
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
  const practice = await getOffIcePracticeById(id);
  if (!practice) {
    return NextResponse.json({ error: 'Off-ice practice not found' }, { status: 404 });
  }
  return NextResponse.json({ practice });
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
    const practice = await updateOffIcePractice(id, body);
    if (!practice) {
      return NextResponse.json({ error: 'Off-ice practice not found' }, { status: 404 });
    }
    return NextResponse.json({ practice });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Failed to update off-ice practice' },
      { status: 400 }
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
  if (session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }
  const { id } = await context.params;
  const deleted = await deleteOffIcePractice(id);
  return NextResponse.json({ deleted });
}
