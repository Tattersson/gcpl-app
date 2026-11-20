import { NextRequest, NextResponse } from 'next/server';
import { createUser, listUsers, updateUserById } from '@/lib/db';
import { hashPassword, requireAdmin } from '@/lib/auth';

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const users = await listUsers();
  return NextResponse.json({ users });
}

export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

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
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  try {
    const body = await req.json();
    const { userId, role, active, name } = body;
    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    // Never leave the instance without an active administrator.
    const demotes = role !== undefined && role !== 'ADMIN';
    const deactivates = active === false;
    if (demotes || deactivates) {
      const users = await listUsers();
      const target = users.find((u) => u.id === userId);
      const isActiveAdmin = (u: { role: string; active: boolean }) => u.role === 'ADMIN' && u.active;
      const otherActiveAdmins = users.filter((u) => u.id !== userId && isActiveAdmin(u));
      if (target && isActiveAdmin(target) && otherActiveAdmins.length === 0) {
        return NextResponse.json(
          { error: 'Cannot demote or deactivate the last active administrator.' },
          { status: 400 }
        );
      }
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
