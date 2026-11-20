import { NextRequest, NextResponse } from 'next/server';
import { createPracticePlan, listPracticePlans } from '@/lib/db';
import { requireAdmin, getOptionalSession } from '@/lib/auth';
import { toPublicPlan } from '@/lib/publicDto';

// Public: the practice library can be browsed without signing in.
export async function GET() {
  const session = await getOptionalSession();
  const plans = await listPracticePlans();
  // Admins see full records; everyone else gets the public shape.
  return NextResponse.json({
    plans: session?.user.role === 'ADMIN' ? plans : plans.map(toPublicPlan),
  });
}

// Admin only.
export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  try {
    const body = await req.json();
    const created = await createPracticePlan({
      ownerId: guard.session.user.id,
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
  } catch {
    return NextResponse.json({ error: 'Failed to create practice plan' }, { status: 500 });
  }
}
