import { redirect } from 'next/navigation';
import { isSetupComplete } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  // Fresh instance: run first-time setup. Otherwise the dashboard is public.
  if (!(await isSetupComplete())) {
    redirect('/setup');
  }
  redirect('/dashboard');
}
