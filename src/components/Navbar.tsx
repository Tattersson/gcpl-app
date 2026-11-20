'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  PlusCircle,
  LayoutDashboard,
  Dumbbell,
  Settings,
  LogOut,
  KeyRound,
  UserCheck,
  Palette,
} from 'lucide-react';
import { AppUser } from '@/types/planner';
import { BrandLogo, useBranding } from '@/components/BrandingProvider';

interface NavbarProps {
  user: AppUser | null;
  authMode?: 'local' | 'keycloak';
}

export default function Navbar({ user, authMode = 'local' }: NavbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { branding } = useBranding();

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  return (
    <header
      className="sticky top-0 z-30 border-b border-black/15 shadow-md transition-colors"
      style={{
        backgroundColor: branding.headerBgColor || 'var(--brand-header-bg, #0f172a)',
        color: branding.headerTextColor || 'var(--brand-header-text, #ffffff)',
      }}
    >
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-y-2 px-4 py-3 sm:px-6">
        {/* contents on mobile so the nav can wrap to its own full-width row */}
        <div className="contents md:flex md:items-center md:gap-6">
          <Link href="/dashboard" className="flex min-w-0 items-center gap-2.5">
            {branding.showLogoInSharedView !== false && <BrandLogo size="md" />}
            <div>
              <span
                className="text-base font-bold tracking-tight"
                style={{ color: branding.headerTextColor || '#ffffff' }}
              >
                {branding.siteName}
              </span>
              {branding.siteTagline && (
                <span className="ml-2 hidden rounded bg-sky-500/20 px-2 py-0.5 text-xs font-medium text-sky-300 sm:inline-block">
                  {branding.siteTagline}
                </span>
              )}
            </div>
          </Link>

          {/* Library links are public; only the admin-only items depend on the session. */}
          {(
            <nav className="order-last -mx-1 flex w-full items-center gap-1 overflow-x-auto whitespace-nowrap md:order-none md:mx-0 md:w-auto">
              <Link
                href="/dashboard"
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition ${
                  pathname === '/dashboard'
                    ? 'bg-white/15 text-sky-300 shadow-inner'
                    : 'opacity-80 hover:bg-white/10 hover:opacity-100'
                }`}
              >
                <LayoutDashboard className="h-4 w-4" />
                Practice Plans
              </Link>
              <Link
                href="/off-ice"
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition ${
                  pathname?.startsWith('/off-ice')
                    ? 'bg-white/15 text-sky-300 shadow-inner'
                    : 'opacity-80 hover:bg-white/10 hover:opacity-100'
                }`}
              >
                <Dumbbell className="h-4 w-4" />
                Off-Ice Practices
              </Link>
              {user?.role === 'ADMIN' && (
              <Link
                href="/plans/new"
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition ${
                  pathname === '/plans/new'
                    ? 'bg-white/15 text-sky-300 shadow-inner'
                    : 'opacity-80 hover:bg-white/10 hover:opacity-100'
                }`}
              >
                <PlusCircle className="h-4 w-4" />
                New Plan Wizard
              </Link>
              )}
              {user?.role === 'ADMIN' && (
                <Link
                  href="/admin"
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition ${
                    pathname?.startsWith('/admin')
                      ? 'bg-white/15 text-sky-300 shadow-inner'
                      : 'opacity-80 hover:bg-white/10 hover:opacity-100'
                  }`}
                >
                  <Palette className="h-4 w-4" />
                  <Settings className="h-3.5 w-3.5 -ml-1" />
                  Admin &amp; Branding
                </Link>
              )}
            </nav>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div
            className="hidden items-center gap-1.5 rounded-full border border-white/15 bg-black/25 px-3 py-1 text-xs font-medium sm:flex"
            title={
              authMode === 'keycloak'
                ? 'Authenticated via Keycloak OIDC'
                : 'Authenticated via Local Auth.js Session'
            }
          >
            {authMode === 'keycloak' ? (
              <>
                <KeyRound className="h-3.5 w-3.5 text-amber-400" />
                <span>Keycloak SSO</span>
              </>
            ) : (
              <>
                <UserCheck className="h-3.5 w-3.5 text-emerald-400" />
                <span>Local Auth.js</span>
              </>
            )}
          </div>

          {user ? (
            <div className="flex items-center gap-3">
              <div className="hidden text-right text-xs sm:block">
                <div className="font-semibold">{user.name}</div>
                <div className="opacity-70">{user.role}</div>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center gap-1 rounded-md border border-white/20 bg-white/10 px-2.5 py-1.5 text-xs font-medium hover:bg-rose-600 hover:border-rose-500 hover:text-white transition"
                title="Sign out"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="rounded-md bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-500"
            >
              Coach Sign In
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
