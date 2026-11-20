import { redirect } from 'next/navigation';
import { getOptionalSession } from '@/lib/auth';
import WizardClient from './WizardClient';

export const dynamic = 'force-dynamic';

// Administrators only. Creating plans is also enforced by POST /api/plans.
export default async function NewPlanPage() {
  const session = await getOptionalSession();
  if (!session) {
    redirect('/login');
  }
  if (session.user.role !== 'ADMIN') {
    redirect('/dashboard');
  }
  return <WizardClient />;
}
