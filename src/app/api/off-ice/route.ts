import { NextRequest, NextResponse } from 'next/server';
import { createOffIcePractice, listOffIcePractices } from '@/lib/db';
import { getServerSession } from '@/lib/auth';

export async function GET() {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const practices = await listOffIcePractices();
  return NextResponse.json({ practices });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const practice = await createOffIcePractice({
      ownerId: session.user.id,
      title: body.title,
      description: body.description,
      durationMinutes: body.durationMinutes,
      equipment: body.equipment,
      tags: body.tags,
      images: body.images,
    });
    return NextResponse.json({ practice });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Failed to create off-ice practice' },
      { status: 400 }
    );
  }
}
