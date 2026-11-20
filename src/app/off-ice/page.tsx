import React from 'react';
import { redirect } from 'next/navigation';
import { getOptionalSession } from '@/lib/auth';
import {
  getSystemSettings,
  isSetupComplete,
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
  if (!(await isSetupComplete())) {
    redirect('/setup');
  }

  // Public page. Editing is only offered to administrators; the API enforces it regardless.
  const session = await getOptionalSession();
  const isAdmin = session?.user.role === 'ADMIN';

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
      <Navbar user={session?.user ?? null} authMode={settings.authMode} />

      <main className="mx-auto max-w-7xl px-3 py-4 sm:px-6 sm:py-8">
        <OffIceClient
          // Owner IDs are internal; the client only needs the practice content.
          initialPractices={practices.map((p) => ({ ...p, ownerId: null }))}
          isAdmin={isAdmin}
          editId={isAdmin ? edit : undefined}
        />
      </main>
    </div>
  );
}
