'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { KeyRound, CheckCircle2, ArrowRight } from 'lucide-react';
import { BrandLogo, useBranding } from '@/components/BrandingProvider';

export default function FirstRunSetupPage() {
  const router = useRouter();
  const { branding } = useBranding();
  const [name, setName] = useState('Head Goalie Coach');
  const [email, setEmail] = useState('admin@gcpl.local');
  const [password, setPassword] = useState('');
  const [enableKeycloak, setEnableKeycloak] = useState(false);
  const [issuerUrl, setIssuerUrl] = useState('http://localhost:8080/realms/gcpl');
  const [realm, setRealm] = useState('gcpl');
  const [clientId, setClientId] = useState('gcpl-web');
  const [clientSecret, setClientSecret] = useState('');
  const [publicOrigin, setPublicOrigin] = useState('http://localhost:3000');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          password,
          enableKeycloak,
          keycloakConfig: {
            issuerUrl,
            realm,
            clientId,
            clientSecret,
            publicOrigin,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Setup failed');
        setLoading(false);
        return;
      }
      router.push('/dashboard');
      router.refresh();
    } catch (err: any) {
      setError(err?.message || 'Network error');
      setLoading(false);
    }
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center p-4"
      style={{
        background: `linear-gradient(135deg, ${branding.headerBgColor} 0%, ${branding.secondaryColor} 55%, ${branding.primaryColor} 100%)`,
      }}
    >
      <div className="mui-card-elevated w-full max-w-xl border border-slate-700/30 p-5 shadow-2xl sm:p-8">
        <div className="flex items-center gap-3">
          <BrandLogo size="lg" />
          <div>
            <span className="rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-bold text-sky-800">
              First-Run Instance Bootstrap
            </span>
            <h1 className="mt-1 text-2xl font-extrabold text-slate-900">
              Initialize {branding.siteName}
            </h1>
          </div>
        </div>

        <p className="mt-3 text-xs leading-relaxed text-slate-600">
          Create the primary Administrator account stored in PostgreSQL. By default, local NextAuth/Auth.js authentication is enabled. You can also connect an existing Keycloak server now or anytime later from the in-app Admin Settings without editing <code className="rounded bg-slate-100 px-1 py-0.5">.env</code> files.
        </p>

        {error && (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-bold text-slate-700">
                Admin / Head Coach Name
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-sky-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700">
                Admin Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-sky-600 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700">
              Admin Password (min 6 characters)
            </label>
            <input
              type="password"
              required
              minLength={6}
              placeholder="Enter strong admin password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-sky-600 focus:outline-none"
            />
          </div>

          {/* Optional Direct Keycloak Configuration Toggle */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <label className="flex items-center justify-between cursor-pointer">
              <div className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-amber-600" />
                <span className="text-xs font-bold text-slate-800">
                  Configure & Enable External Keycloak SSO Now (Optional)
                </span>
              </div>
              <input
                type="checkbox"
                checked={enableKeycloak}
                onChange={(e) => setEnableKeycloak(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-sky-600"
              />
            </label>

            {enableKeycloak && (
              <div className="mt-4 grid grid-cols-1 gap-3 border-t border-slate-200 pt-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-600">
                    Keycloak Issuer / Server URL
                  </label>
                  <input
                    type="url"
                    required={enableKeycloak}
                    value={issuerUrl}
                    onChange={(e) => setIssuerUrl(e.target.value)}
                    placeholder="https://keycloak.example.com/realms/gcpl"
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600">
                    Realm Name
                  </label>
                  <input
                    type="text"
                    value={realm}
                    onChange={(e) => setRealm(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600">
                    OIDC Client ID
                  </label>
                  <input
                    type="text"
                    required={enableKeycloak}
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600">
                    Client Secret
                  </label>
                  <input
                    type="password"
                    value={clientSecret}
                    onChange={(e) => setClientSecret(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600">
                    App Public Origin URL
                  </label>
                  <input
                    type="url"
                    value={publicOrigin}
                    onChange={(e) => setPublicOrigin(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs"
                  />
                </div>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-sky-600 py-3 text-sm font-bold text-white shadow-md hover:bg-sky-500 transition disabled:opacity-50"
          >
            <CheckCircle2 className="h-4 w-4" />
            {loading
              ? 'Initializing Database & Starter Practice Plan...'
              : 'Complete Setup & Open Coach Dashboard'}
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
