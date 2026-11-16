import { NextRequest, NextResponse } from 'next/server';
import { createUser, listUsers, updateUserById } from '@/lib/db';
import { getServerSession, hashPassword } from '@/lib/auth';

export async function GET() {
  const session = await getServerSession();
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }
  const users = await listUsers();
  return NextResponse.json({ users });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { name, email, password, role, authProvider } = body;

    if (!name || !email) {
      return NextResponse.json(
        { error: 'Name and email are required.' },
        { status: 400 }
      );
    }

    const passwordHash = password ? await hashPassword(password) : null;
    const created = await createUser({
      name,
      email,
      passwordHash,
      role: role === 'ADMIN' ? 'ADMIN' : 'COACH',
      authProvider: authProvider === 'keycloak' ? 'keycloak' : 'local',
    });

    return NextResponse.json({ user: created });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Failed to create user' },
      { status: 400 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession();
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { userId, role, active, name } = body;
    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const updated = await updateUserById(userId, { role, active, name });
    if (!updated) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    return NextResponse.json({ user: updated });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Failed to update user' },
      { status: 400 }
    );
  }
}
