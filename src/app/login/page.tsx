'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { KeyRound, Lock, AlertTriangle } from 'lucide-react';
import { BrandLogo, useBranding } from '@/components/BrandingProvider';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlError = searchParams.get('error');
  const { branding, replaceBranding } = useBranding();

  const [authMode, setAuthMode] = useState<'local' | 'keycloak'>('local');
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showEmergencyLocal, setShowEmergencyLocal] = useState(false);
  const [error, setError] = useState(urlError || '');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function checkState() {
      try {
        const res = await fetch('/api/setup');
        const data = await res.json();
        if (data.needsSetup) {
          router.replace('/setup');
          return;
        }
        setAuthMode(data.authMode || 'local');
        if (data.brandingConfig) {
          replaceBranding(data.brandingConfig);
        }
      } catch {
        // Fallback to local login form
      } finally {
        setLoadingConfig(false);
      }
    }
    checkState();
  }, [router]);

  async function handleLocalLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          emergencyLocalAdmin: authMode === 'keycloak' && showEmergencyLocal,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.redirectUrl && !showEmergencyLocal) {
          window.location.href = data.redirectUrl;
          return;
        }
        setError(data.error || 'Invalid credentials');
        setSubmitting(false);
        return;
      }
      router.push('/dashboard');
      router.refresh();
    } catch (err: any) {
      setError(err?.message || 'Sign in failed');
      setSubmitting(false);
    }
  }

  if (loadingConfig) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900 text-white">
        <div className="text-sm font-semibold text-slate-300">
          Loading GCPL Authentication...
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center p-4"
      style={{
        background: `linear-gradient(135deg, ${branding.headerBgColor} 0%, ${branding.secondaryColor} 55%, ${branding.primaryColor} 100%)`,
      }}
    >
      <div className="mui-card-elevated w-full max-w-md border border-slate-700/30 p-8 shadow-2xl">
        <div className="flex items-center gap-3">
          <BrandLogo size="lg" />
          <div>
            <h1 className="text-xl font-extrabold text-slate-900">
              {branding.siteName}
            </h1>
            <p className="text-xs font-medium text-slate-500">
              {branding.siteTagline ||
                (authMode === 'keycloak'
                  ? 'Enterprise Keycloak OIDC Authentication Active'
                  : 'Local Auth.js Credentials Authentication Active')}
            </p>
          </div>
        </div>

        {error && (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700">
            <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        {/* When Keycloak is configured, NextAuth local login is disabled and Keycloak SSO is primary */}
        {authMode === 'keycloak' && !showEmergencyLocal ? (
          <div className="mt-6 space-y-4">
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-900">
              This instance is configured to authenticate exclusively through your organization&apos;s <strong>Keycloak SSO</strong> server.
            </div>

            <a
              href="/api/auth/keycloak/login"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-sky-600 py-3 text-sm font-bold text-white shadow-md hover:bg-sky-500 transition"
            >
              <KeyRound className="h-4 w-4" />
              Sign In with Keycloak SSO
            </a>

            <div className="pt-3 text-center">
              <button
                type="button"
                onClick={() => setShowEmergencyLocal(true)}
                className="text-[11px] font-medium text-slate-400 underline hover:text-slate-600"
              >
                Admin Emergency Local Recovery Login
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleLocalLogin} className="mt-6 space-y-4">
            {authMode === 'keycloak' && showEmergencyLocal && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-2.5 text-[11px] font-medium text-amber-800">
                Emergency Admin Recovery: Sign in with your local PostgreSQL ADMIN account to update or disable Keycloak settings.
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700">
                Coach / Admin Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@gcpl.local"
                className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-sky-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700">
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-sky-600 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="mui-btn-contained flex w-full items-center justify-center gap-2 py-3 text-sm shadow-md disabled:opacity-50"
            >
              <Lock className="h-4 w-4" />
              {submitting ? 'Signing In...' : 'Sign In'}
            </button>

            {authMode === 'keycloak' && showEmergencyLocal && (
              <button
                type="button"
                onClick={() => setShowEmergencyLocal(false)}
                className="block w-full text-center text-xs font-semibold text-sky-600 hover:underline"
              >
                Back to Keycloak SSO Sign In
              </button>
            )}
          </form>
        )}
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-900" />}>
      <LoginContent />
    </Suspense>
  );
}
