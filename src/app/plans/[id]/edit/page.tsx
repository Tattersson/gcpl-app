import { redirect } from 'next/navigation';
import { getOptionalSession } from '@/lib/auth';
import EditorClient from './EditorClient';

export const dynamic = 'force-dynamic';

// Administrators only. The editor's saves are also enforced by the PUT/DELETE API routes.
export default async function EditPlanPage() {
  const session = await getOptionalSession();
  if (!session) {
    redirect('/login');
  }
  if (session.user.role !== 'ADMIN') {
    redirect('/dashboard');
  }
  return <EditorClient />;
}
