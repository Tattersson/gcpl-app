import { NextRequest, NextResponse } from 'next/server';
import { createOffIcePractice, listOffIcePractices } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

// Public: the off-ice library can be browsed without signing in.
export async function GET() {
  const practices = await listOffIcePractices();
  return NextResponse.json({
    practices: practices.map(({ ownerId: _ownerId, ...rest }) => rest),
  });
}

// Admin only.
export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  try {
    const body = await req.json();
    const practice = await createOffIcePractice({
      ownerId: guard.session.user.id,
      title: body.title,
      description: body.description,
      durationMinutes: body.durationMinutes,
      equipment: body.equipment,
      tags: body.tags,
      images: body.images,
    });
    return NextResponse.json({ practice });
  } catch {
    return NextResponse.json({ error: 'Failed to create off-ice practice' }, { status: 400 });
  }
}
