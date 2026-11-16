import { redirect } from 'next/navigation';
import { getUserCount } from '@/lib/db';
import { getServerSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const userCount = await getUserCount();
  if (userCount === 0) {
    redirect('/setup');
  }

  const session = await getServerSession();
  if (!session) {
    redirect('/login');
  }

  redirect('/dashboard');
}
