import { NextRequest, NextResponse } from 'next/server';
import { createPracticePlan, listPracticePlans } from '@/lib/db';
import { getServerSession } from '@/lib/auth';

export async function GET() {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const plans = await listPracticePlans();
  return NextResponse.json({ plans });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const created = await createPracticePlan({
      ownerId: session.user.id,
      title: body.title,
      description: body.description,
      practiceDate: body.practiceDate,
      durationMinutes: body.durationMinutes,
      defaultRinkType: body.defaultRinkType,
      rosterConfig: body.rosterConfig,
      viewConfig: body.viewConfig,
      drills: body.drills,
    });
    return NextResponse.json({ plan: created });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Failed to create practice plan' },
      { status: 500 }
    );
  }
}
