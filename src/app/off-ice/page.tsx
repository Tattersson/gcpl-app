import React from 'react';
import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/auth';
import {
  getSystemSettings,
  getUserCount,
  listOffIcePractices,
} from '@/lib/db';
import Navbar from '@/components/Navbar';
import OffIceClient from '@/components/off-ice/OffIceClient';

export const dynamic = 'force-dynamic';

export default async function OffIcePage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const { edit } = await searchParams;
  const userCount = await getUserCount();
  if (userCount === 0) {
    redirect('/setup');
  }

  const session = await getServerSession();
  if (!session) {
    redirect('/login');
  }

  const [practices, settings] = await Promise.all([
    listOffIcePractices(),
    getSystemSettings(),
  ]);
  const branding = settings.brandingConfig;

  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: branding.backgroundColor }}
    >
      <Navbar user={session.user} authMode={settings.authMode} />

      <main className="mx-auto max-w-7xl px-3 py-4 sm:px-6 sm:py-8">
        <OffIceClient
          initialPractices={practices}
          isAdmin={session.user.role === 'ADMIN'}
          editId={edit}
        />
      </main>
    </div>
  );
}
