'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import {
  AppUser,
  BrandingConfig,
  KeycloakConfig,
  MaterialFontPreset,
  MaterialShapePreset,
  UserRole,
} from '@/types/planner';
import {
  DEFAULT_BRANDING_CONFIG,
  MATERIAL_THEME_PRESETS,
  generateTonalPalette,
  normalizeBrandingConfig,
  resolveEffectiveFavicon,
} from '@/lib/branding';
import { BrandLogo, useBranding } from '@/components/BrandingProvider';
import {
  KeyRound,
  Users,
  CheckCircle2,
  AlertCircle,
  Plus,
  RefreshCw,
  ShieldCheck,
  Server,
  Palette,
  Upload,
  Trash2,
  RotateCcw,
  Sparkles,
  Globe,
  Type,
  Shapes,
  Image as ImageIcon,
  Eye,
  Save,
} from 'lucide-react';

export default function AdminSettingsPage() {
  const router = useRouter();
  const { branding: activeBranding, replaceBranding } = useBranding();

  const [authorizedAdmin, setAuthorizedAdmin] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState<'branding' | 'keycloak' | 'users'>('branding');
  const [authMode, setAuthMode] = useState<'local' | 'keycloak'>('local');
  const [dbBackend, setDbBackend] = useState<'postgres' | 'fallback'>('postgres');
  const [kcConfig, setKcConfig] = useState<KeycloakConfig>({
    issuerUrl: '',
    realm: 'gcpl',
    clientId: 'gcpl-web',
    clientSecret: '',
    publicOrigin: 'http://localhost:3000',
  });

  const [brandingForm, setBrandingForm] = useState<BrandingConfig>(() =>
    normalizeBrandingConfig(activeBranding)
  );
  const [savingBranding, setSavingBranding] = useState(false);
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const faviconInputRef = useRef<HTMLInputElement | null>(null);

  const [users, setUsers] = useState<AppUser[]>([]);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('COACH');

  const [statusMsg, setStatusMsg] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [testingKc, setTestingKc] = useState(false);
  const [savingKc, setSavingKc] = useState(false);

  async function loadData() {
    try {
      const [settingsRes, usersRes] = await Promise.all([
        fetch('/api/admin/settings', { cache: 'no-store' }),
        fetch('/api/admin/users', { cache: 'no-store' }),
      ]);
      // Strict Admin-Only Guard: Non-admins receive 403 on /api/admin/users
      if (settingsRes.status === 403 || usersRes.status === 403 || !usersRes.ok) {
        setAuthorizedAdmin(false);
        router.replace('/dashboard');
        return;
      }
      setAuthorizedAdmin(true);

      if (settingsRes.ok) {
        const sData = await settingsRes.json();
        setAuthMode(sData.authMode || 'local');
        if (sData.dbBackend) setDbBackend(sData.dbBackend);
        if (sData.keycloakConfig) setKcConfig(sData.keycloakConfig);
        if (sData.brandingConfig) {
          const normalized = normalizeBrandingConfig(sData.brandingConfig);
          setBrandingForm(normalized);
          replaceBranding(normalized);
        }
      }
      if (usersRes.ok) {
        const uData = await usersRes.json();
        setUsers(uData.users || []);
      }
    } catch {
      // Ignore transient error
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function updateBrandingField<K extends keyof BrandingConfig>(
    key: K,
    value: BrandingConfig[K]
  ) {
    const next = normalizeBrandingConfig({
      ...brandingForm,
      [key]: value,
    });
    setBrandingForm(next);
    replaceBranding(next);
  }

  function handleApplyPreset(presetId: string) {
    const preset = MATERIAL_THEME_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    const next = normalizeBrandingConfig({
      ...brandingForm,
      ...preset.colors,
    });
    setBrandingForm(next);
    replaceBranding(next);
    setStatusMsg({
      type: 'success',
      text: `Applied "${preset.name}" Material 3 color palette. Click Save Branding to persist for all users.`,
    });
  }

  function handleResetBrandingDefaults() {
    const next = normalizeBrandingConfig({
      ...DEFAULT_BRANDING_CONFIG,
      // Keep uploaded logo/favicon if desired? No, reset colors & typography while preserving or resetting
    });
    setBrandingForm(next);
    replaceBranding(next);
    setStatusMsg({
      type: 'success',
      text: 'Reset design & branding to default Material Ice Blue settings. Click Save Branding to persist.',
    });
  }

  function handleImageFileUpload(
    file: File | undefined,
    target: 'logo' | 'favicon'
  ) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setStatusMsg({
        type: 'error',
        text: 'Please select a valid image file (PNG, SVG, JPG, WebP, or ICO).',
      });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setStatusMsg({
        type: 'error',
        text: 'Image file size must be under 2 MB for optimal performance.',
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      if (!result) return;
      if (target === 'logo') {
        const next = normalizeBrandingConfig({
          ...brandingForm,
          logoDataUrl: result,
        });
        setBrandingForm(next);
        replaceBranding(next);
        setStatusMsg({
          type: 'success',
          text: brandingForm.useLogoAsFavicon
            ? `Loaded "${file.name}" as both Instance Logo and Browser Favicon.`
            : `Loaded "${file.name}" as Instance Logo.`,
        });
      } else {
        const next = normalizeBrandingConfig({
          ...brandingForm,
          faviconDataUrl: result,
        });
        setBrandingForm(next);
        replaceBranding(next);
        setStatusMsg({
          type: 'success',
          text: `Loaded "${file.name}" as dedicated Browser Favicon.`,
        });
      }
    };
    reader.readAsDataURL(file);
  }

  async function handleSaveBranding(e: React.FormEvent) {
    e.preventDefault();
    setSavingBranding(true);
    setStatusMsg(null);

    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandingConfig: brandingForm,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatusMsg({
          type: 'error',
          text: data.error || 'Failed to save branding configuration',
        });
      } else {
        const saved = normalizeBrandingConfig(data.brandingConfig);
        setBrandingForm(saved);
        replaceBranding(saved);
        setStatusMsg({
          type: 'success',
          text: 'Instance Design & Branding saved! Colors, logo, and favicon are now live across the entire instance.',
        });
      }
    } catch (err: any) {
      setStatusMsg({
        type: 'error',
        text: err?.message || 'Error saving branding settings',
      });
    } finally {
      setSavingBranding(false);
    }
  }

  async function handleTestKeycloak() {
    setTestingKc(true);
    setStatusMsg(null);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keycloakConfig: kcConfig }),
      });
      const data = await res.json();
      if (data.reachable) {
        setStatusMsg({
          type: 'success',
          text: `Keycloak OIDC Discovery Verified: ${data.message}`,
        });
      } else {
        setStatusMsg({
          type: 'error',
          text: data.message || 'Could not reach Keycloak discovery endpoint.',
        });
      }
    } catch (err: any) {
      setStatusMsg({
        type: 'error',
        text: err?.message || 'Keycloak test failed',
      });
    } finally {
      setTestingKc(false);
    }
  }

  async function handleSaveKeycloakSettings(e: React.FormEvent) {
    e.preventDefault();
    setSavingKc(true);
    setStatusMsg(null);

    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          authMode,
          keycloakConfig: kcConfig,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatusMsg({
          type: 'error',
          text: data.error || 'Failed to save authentication settings',
        });
      } else {
        setStatusMsg({
          type: 'success',
          text:
            authMode === 'keycloak'
              ? 'Saved! Dynamic Keycloak OIDC is now active (NextAuth local login disabled).'
              : 'Saved! Local NextAuth/Auth.js authentication is active.',
        });
      }
    } catch (err: any) {
      setStatusMsg({
        type: 'error',
        text: err?.message || 'Error saving settings',
      });
    } finally {
      setSavingKc(false);
    }
  }

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    setStatusMsg(null);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName,
          email: newEmail,
          password: newPassword,
          role: newRole,
          authProvider: 'local',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatusMsg({
          type: 'error',
          text: data.error || 'Could not create user',
        });
        return;
      }
      setNewName('');
      setNewEmail('');
      setNewPassword('');
      setStatusMsg({
        type: 'success',
        text: `Created ${data.user.role} account for ${data.user.email}`,
      });
      loadData();
    } catch (err: any) {
      setStatusMsg({
        type: 'error',
        text: err?.message || 'Error creating user',
      });
    }
  }

  async function handleToggleUser(
    user: AppUser,
    patch: { role?: UserRole; active?: boolean }
  ) {
    await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, ...patch }),
    });
    loadData();
  }

  if (authorizedAdmin === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900 text-white">
        <div className="text-sm font-semibold text-slate-300">
          Verifying Administrator Privileges...
        </div>
      </div>
    );
  }

  if (authorizedAdmin === false) {
    return null;
  }

  const currentAdmin = users.find((u) => u.role === 'ADMIN') || null;
  const primaryTones = generateTonalPalette(brandingForm.primaryColor);
  const secondaryTones = generateTonalPalette(brandingForm.secondaryColor);
  const accentTones = generateTonalPalette(brandingForm.accentColor);
  const effectiveFavicon = resolveEffectiveFavicon(brandingForm);

  return (
    <div
      className="min-h-screen pb-16"
      style={{ backgroundColor: brandingForm.backgroundColor }}
    >
      <Navbar user={currentAdmin} authMode={authMode} />

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {/* Google Material Design 3 Admin Header Card */}
        <div className="mui-card-elevated p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <BrandLogo size="lg" overrideBranding={brandingForm} />
              <div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-3 py-0.5 text-[11px] font-bold uppercase tracking-wider text-sky-800">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Admin-Only Control Center
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-teal-100 px-2.5 py-0.5 text-[11px] font-bold text-teal-800">
                    Google Material UI
                  </span>
                </div>
                <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900">
                  Instance Design, Branding &amp; System Administration
                </h1>
                <p className="mt-0.5 text-xs text-slate-600">
                  Customize global Material 3 colors, logo &amp; favicon assets, Keycloak SSO, and coach accounts. Restricted strictly to Administrators.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm">
              <Server className="h-4 w-4 text-sky-600" />
              <span>
                Storage Engine:{' '}
                <strong>
                  {dbBackend === 'postgres'
                    ? 'PostgreSQL Database'
                    : 'Local Persistence Store'}
                </strong>
              </span>
            </div>
          </div>

          {/* Google Material UI Tabs Bar */}
          <div
            role="tablist"
            aria-label="Admin configuration sections"
            className="mt-6 flex flex-wrap gap-2 border-b border-slate-200"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'branding'}
              onClick={() => setActiveTab('branding')}
              className={`relative flex items-center gap-2 px-5 py-3 text-sm font-bold transition ${
                activeTab === 'branding'
                  ? 'text-sky-600'
                  : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
              }`}
            >
              <Palette className="h-4 w-4" />
              <span>Instance Design &amp; Branding</span>
              {activeTab === 'branding' && (
                <span
                  className="absolute inset-x-0 bottom-0 h-0.5 rounded-t-full"
                  style={{ backgroundColor: brandingForm.primaryColor }}
                />
              )}
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'keycloak'}
              onClick={() => setActiveTab('keycloak')}
              className={`relative flex items-center gap-2 px-5 py-3 text-sm font-bold transition ${
                activeTab === 'keycloak'
                  ? 'text-sky-600'
                  : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
              }`}
            >
              <KeyRound className="h-4 w-4" />
              <span>Dynamic Keycloak &amp; Auth Mode</span>
              {activeTab === 'keycloak' && (
                <span
                  className="absolute inset-x-0 bottom-0 h-0.5 rounded-t-full"
                  style={{ backgroundColor: brandingForm.primaryColor }}
                />
              )}
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'users'}
              onClick={() => setActiveTab('users')}
              className={`relative flex items-center gap-2 px-5 py-3 text-sm font-bold transition ${
                activeTab === 'users'
                  ? 'text-sky-600'
                  : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
              }`}
            >
              <Users className="h-4 w-4" />
              <span>Coach &amp; Admin Users ({users.length})</span>
              {activeTab === 'users' && (
                <span
                  className="absolute inset-x-0 bottom-0 h-0.5 rounded-t-full"
                  style={{ backgroundColor: brandingForm.primaryColor }}
                />
              )}
            </button>
          </div>
        </div>

        {/* Material UI Alert / Snackbar Banner */}
        {statusMsg && (
          <div
            role="alert"
            className={`mt-5 flex items-center justify-between gap-3 rounded-xl border px-4 py-3.5 text-xs font-semibold shadow-sm ${
              statusMsg.type === 'success'
                ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                : 'border-rose-300 bg-rose-50 text-rose-900'
            }`}
          >
            <div className="flex items-center gap-2.5">
              {statusMsg.type === 'success' ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
              )}
              <span>{statusMsg.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setStatusMsg(null)}
              className="rounded px-2 py-0.5 text-[11px] font-bold opacity-70 hover:opacity-100"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* ================================================================ */}
        {/* TAB 1: INSTANCE DESIGN & BRANDING STUDIO (GOOGLE MATERIAL UI)    */}
        {/* ================================================================ */}
        {activeTab === 'branding' && (
          <form onSubmit={handleSaveBranding} className="mt-6 space-y-6">
            {/* Section 1: Material 3 Theme Presets */}
            <section className="mui-card-elevated p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-sky-600" />
                    <h2 className="text-base font-extrabold text-slate-900">
                      Google Material 3 Theme Presets
                    </h2>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Start with a curated Material Design 3 color system or customize individual Primary, Secondary, and Alternative colors below.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleResetBrandingDefaults}
                  className="mui-btn-outlined flex items-center gap-1.5 px-3.5 py-2 text-xs"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Reset to Default Theme
                </button>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {MATERIAL_THEME_PRESETS.map((preset) => {
                  const isSelected =
                    brandingForm.primaryColor.toLowerCase() ===
                      preset.colors.primaryColor.toLowerCase() &&
                    brandingForm.accentColor.toLowerCase() ===
                      preset.colors.accentColor.toLowerCase();

                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleApplyPreset(preset.id)}
                      className={`mui-card-outlined flex flex-col justify-between p-4 text-left transition ${
                        isSelected
                          ? 'ring-2 ring-sky-500 border-sky-500 bg-sky-50/40'
                          : 'hover:bg-slate-50'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-extrabold text-slate-900">
                            {preset.name}
                          </span>
                          <div className="flex items-center -space-x-1">
                            <span
                              className="h-5 w-5 rounded-full border border-white shadow-sm"
                              style={{ backgroundColor: preset.colors.primaryColor }}
                              title={`Primary: ${preset.colors.primaryColor}`}
                            />
                            <span
                              className="h-5 w-5 rounded-full border border-white shadow-sm"
                              style={{ backgroundColor: preset.colors.secondaryColor }}
                              title={`Secondary: ${preset.colors.secondaryColor}`}
                            />
                            <span
                              className="h-5 w-5 rounded-full border border-white shadow-sm"
                              style={{ backgroundColor: preset.colors.accentColor }}
                              title={`Alternative: ${preset.colors.accentColor}`}
                            />
                            <span
                              className="h-5 w-5 rounded-full border border-white shadow-sm"
                              style={{ backgroundColor: preset.colors.headerBgColor }}
                              title={`Header: ${preset.colors.headerBgColor}`}
                            />
                          </div>
                        </div>
                        <p className="mt-1.5 text-[11px] text-slate-600">
                          {preset.description}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Section 2: Logo & Favicon Upload + Brand Identity */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* Logo & Favicon Asset Uploader */}
              <section className="mui-card-elevated flex flex-col justify-between p-6">
                <div>
                  <div className="flex items-center gap-2">
                    <ImageIcon className="h-4 w-4 text-sky-600" />
                    <h2 className="text-base font-extrabold text-slate-900">
                      Logo &amp; Browser Favicon Image Upload
                    </h2>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Upload your club or organization emblem (PNG, SVG, WebP, JPG, ICO). It can work simultaneously as the Top App Bar Logo, Shared Plan Logo, and Browser Favicon.
                  </p>

                  {/* Hidden file inputs */}
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/png,image/svg+xml,image/jpeg,image/webp,image/x-icon"
                    className="hidden"
                    onChange={(e) => {
                      handleImageFileUpload(e.target.files?.[0], 'logo');
                      e.target.value = '';
                    }}
                  />
                  <input
                    ref={faviconInputRef}
                    type="file"
                    accept="image/png,image/svg+xml,image/x-icon,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      handleImageFileUpload(e.target.files?.[0], 'favicon');
                      e.target.value = '';
                    }}
                  />

                  {/* Material Dropzone */}
                  <div
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const file = e.dataTransfer.files?.[0];
                      handleImageFileUpload(file, 'logo');
                    }}
                    className="mt-4 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-sky-300 bg-sky-50/40 p-5 text-center transition hover:bg-sky-50/80"
                  >
                    <BrandLogo size="lg" overrideBranding={brandingForm} />
                    <p className="mt-3 text-xs font-bold text-slate-800">
                      {brandingForm.logoDataUrl
                        ? 'Custom Brand Image Active'
                        : 'Drag & drop a logo image here, or click to upload'}
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      Supports PNG, SVG, WebP, JPG, ICO (Max 2 MB)
                    </p>

                    <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => logoInputRef.current?.click()}
                        className="mui-btn-contained flex items-center gap-1.5 px-4 py-2 text-xs"
                      >
                        <Upload className="h-3.5 w-3.5" />
                        {brandingForm.logoDataUrl
                          ? 'Replace Brand Image'
                          : 'Upload Brand Image (Logo & Favicon)'}
                      </button>

                      {brandingForm.logoDataUrl && (
                        <button
                          type="button"
                          onClick={() => updateBrandingField('logoDataUrl', '')}
                          className="flex items-center gap-1 rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Remove Logo
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Material Switches for Favicon & Shared View behavior */}
                  <div className="mt-4 space-y-3">
                    <label className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3">
                      <div className="pr-3">
                        <div className="text-xs font-bold text-slate-900">
                          Use uploaded logo image as Browser Favicon
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Automatically sets the browser tab icon (<code className="rounded bg-slate-200 px-1">&lt;link rel=&quot;icon&quot;&gt;</code>) to your uploaded logo image.
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={brandingForm.useLogoAsFavicon}
                        onChange={(e) =>
                          updateBrandingField('useLogoAsFavicon', e.target.checked)
                        }
                        className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                      />
                    </label>

                    {!brandingForm.useLogoAsFavicon && (
                      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-sky-200 bg-sky-50/40 p-3">
                        <div className="flex items-center gap-2.5">
                          {brandingForm.faviconDataUrl ? (
                            <img
                              src={brandingForm.faviconDataUrl}
                              alt="Dedicated favicon"
                              className="h-7 w-7 rounded border border-slate-300 bg-white object-contain p-0.5"
                            />
                          ) : (
                            <Globe className="h-5 w-5 text-sky-600" />
                          )}
                          <div>
                            <div className="text-xs font-bold text-slate-900">
                              Dedicated Browser Favicon Image
                            </div>
                            <div className="text-[11px] text-slate-500">
                              {brandingForm.faviconDataUrl
                                ? 'Custom separate favicon uploaded'
                                : 'Upload a separate square icon for browser tabs'}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => faviconInputRef.current?.click()}
                            className="mui-btn-outlined px-3 py-1.5 text-xs"
                          >
                            Upload Favicon
                          </button>
                          {brandingForm.faviconDataUrl && (
                            <button
                              type="button"
                              onClick={() =>
                                updateBrandingField('faviconDataUrl', '')
                              }
                              className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-bold text-rose-700"
                            >
                              Clear
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    <label className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3">
                      <div className="pr-3">
                        <div className="text-xs font-bold text-slate-900">
                          Show custom logo &amp; branding on Shared Practice Plan views
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Displays your uploaded logo and custom instance title on public read-only links (<code className="rounded bg-slate-200 px-1">/share/[token]</code>).
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={brandingForm.showLogoInSharedView}
                        onChange={(e) =>
                          updateBrandingField(
                            'showLogoInSharedView',
                            e.target.checked
                          )
                        }
                        className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                      />
                    </label>
                  </div>
                </div>

                {/* Browser Tab Favicon Preview Bar */}
                <div className="mt-4 rounded-xl border border-slate-200 bg-slate-100 p-3">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Live Browser Tab &amp; Favicon Preview
                  </div>
                  <div className="mt-1.5 flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 shadow-sm">
                    {effectiveFavicon ? (
                      <img
                        src={effectiveFavicon}
                        alt="Favicon preview"
                        className="h-4 w-4 shrink-0 rounded-sm object-contain"
                      />
                    ) : (
                      <div
                        className="flex h-4 w-4 shrink-0 items-center justify-center rounded-sm text-white"
                        style={{ backgroundColor: brandingForm.primaryColor }}
                      >
                        <span className="text-[9px] font-black">G</span>
                      </div>
                    )}
                    <span className="truncate text-xs font-semibold text-slate-800">
                      {brandingForm.siteName}
                      {brandingForm.siteTagline
                        ? ` — ${brandingForm.siteTagline}`
                        : ''}
                    </span>
                  </div>
                </div>
              </section>

              {/* Brand Identity, Typography & Material Shape Scale */}
              <section className="mui-card-elevated flex flex-col justify-between p-6">
                <div className="space-y-5">
                  <div>
                    <div className="flex items-center gap-2">
                      <Type className="h-4 w-4 text-sky-600" />
                      <h2 className="text-base font-extrabold text-slate-900">
                        Instance Identity, Typography &amp; Shape
                      </h2>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Configure the instance name, subtitle badge, Material font family, and corner radius scale.
                    </p>
                  </div>

                  {/* Material Outlined TextField: Instance Name */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700">
                      Instance Name / Brand Title
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={60}
                      value={brandingForm.siteName}
                      onChange={(e) =>
                        updateBrandingField('siteName', e.target.value)
                      }
                      placeholder="GCPL"
                      className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-200"
                    />
                    <span className="mt-1 block text-[11px] text-slate-500">
                      Displayed in the Top App Bar, Login screen, Shared Plan header, and Browser Tab title.
                    </span>
                  </div>

                  {/* Material Outlined TextField: Instance Tagline */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700">
                      Instance Subtitle / Tagline Badge
                    </label>
                    <input
                      type="text"
                      maxLength={120}
                      value={brandingForm.siteTagline}
                      onChange={(e) =>
                        updateBrandingField('siteTagline', e.target.value)
                      }
                      placeholder="Goalie Coach Practice Planner"
                      className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-200"
                    />
                  </div>

                  {/* Material Typography Selector */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700">
                      Google Material Typography Family
                    </label>
                    <div className="mt-1.5 grid grid-cols-3 gap-2">
                      {(
                        [
                          { id: 'roboto', label: 'Google Roboto', sample: 'Roboto Sans' },
                          { id: 'inter', label: 'Modern Inter', sample: 'Inter UI' },
                          { id: 'system', label: 'Native System', sample: 'System Sans' },
                        ] as { id: MaterialFontPreset; label: string; sample: string }[]
                      ).map((f) => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => updateBrandingField('fontPreset', f.id)}
                          className={`rounded-xl border p-3 text-left transition ${
                            brandingForm.fontPreset === f.id
                              ? 'border-sky-600 bg-sky-50/70 ring-2 ring-sky-200'
                              : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                          }`}
                        >
                          <div className="text-xs font-extrabold text-slate-900">
                            {f.label}
                          </div>
                          <div className="mt-0.5 text-[11px] text-slate-500">
                            {f.sample}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Material Shape Scale Selector */}
                  <div>
                    <div className="flex items-center gap-1.5">
                      <Shapes className="h-3.5 w-3.5 text-sky-600" />
                      <label className="block text-xs font-bold text-slate-700">
                        Material 3 Component Shape / Corner Radius
                      </label>
                    </div>
                    <div className="mt-1.5 grid grid-cols-3 gap-2">
                      {(
                        [
                          { id: 'sharp', label: 'Sharp (4px)', radius: '4px' },
                          { id: 'rounded', label: 'Rounded (12px)', radius: '12px' },
                          { id: 'pill', label: 'Expressive (20px)', radius: '20px' },
                        ] as { id: MaterialShapePreset; label: string; radius: string }[]
                      ).map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => updateBrandingField('shapePreset', s.id)}
                          className={`border p-3 text-left transition ${
                            brandingForm.shapePreset === s.id
                              ? 'border-sky-600 bg-sky-50/70 ring-2 ring-sky-200'
                              : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                          }`}
                          style={{ borderRadius: s.radius }}
                        >
                          <div className="text-xs font-extrabold text-slate-900">
                            {s.label}
                          </div>
                          <div className="mt-0.5 text-[11px] text-slate-500">
                            Cards &amp; Buttons
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            </div>

            {/* Section 3: Custom Color Pickers (Primary, Secondary, Alternative/Accent, Header, Surfaces) */}
            <section className="mui-card-elevated p-6">
              <div>
                <div className="flex items-center gap-2">
                  <Palette className="h-4 w-4 text-sky-600" />
                  <h2 className="text-base font-extrabold text-slate-900">
                    Instance Color System (Primary, Secondary, Alternative &amp; Surfaces)
                  </h2>
                </div>
                <p className="mt-0.5 text-xs text-slate-500">
                  Pick any custom color or enter a hex code. GCPL automatically generates full Material 3 tonal shades (<code className="rounded bg-slate-100 px-1">50</code>–<code className="rounded bg-slate-100 px-1">950</code>) and updates buttons, badges, headers, and interactive views across the instance.
                </p>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {/* Primary Color */}
                <div className="mui-card-outlined p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="inline-block rounded bg-sky-100 px-2 py-0.5 text-[10px] font-bold uppercase text-sky-800">
                        Primary Color
                      </span>
                      <h3 className="mt-1 text-xs font-extrabold text-slate-900">
                        Main Actions &amp; Highlights
                      </h3>
                    </div>
                    <input
                      type="color"
                      aria-label="Primary Brand Color"
                      value={brandingForm.primaryColor}
                      onChange={(e) =>
                        updateBrandingField('primaryColor', e.target.value)
                      }
                      className="h-10 w-12 cursor-pointer rounded-lg border border-slate-300 bg-white p-0.5"
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500">
                    Primary buttons, active tabs, goalie badges, and key interactive controls.
                  </p>
                  <div className="mt-3 flex items-center gap-2">
                    <input
                      type="text"
                      value={brandingForm.primaryColor}
                      onChange={(e) =>
                        updateBrandingField('primaryColor', e.target.value)
                      }
                      className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 font-mono text-xs font-bold uppercase text-slate-900"
                    />
                  </div>
                  {/* Tonal Strip */}
                  <div className="mt-3 grid grid-cols-11 overflow-hidden rounded-md border border-slate-200">
                    {Object.entries(primaryTones).map(([stop, shade]) => (
                      <div
                        key={stop}
                        className="h-4"
                        style={{ backgroundColor: shade.hex }}
                        title={`Primary ${stop}: ${shade.hex}`}
                      />
                    ))}
                  </div>
                </div>

                {/* Secondary Color */}
                <div className="mui-card-outlined p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="inline-block rounded bg-slate-200 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-800">
                        Secondary Color
                      </span>
                      <h3 className="mt-1 text-xs font-extrabold text-slate-900">
                        Supporting Structural Tone
                      </h3>
                    </div>
                    <input
                      type="color"
                      aria-label="Secondary Brand Color"
                      value={brandingForm.secondaryColor}
                      onChange={(e) =>
                        updateBrandingField('secondaryColor', e.target.value)
                      }
                      className="h-10 w-12 cursor-pointer rounded-lg border border-slate-300 bg-white p-0.5"
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500">
                    Hero banners, secondary buttons, dark cards, and structural accents.
                  </p>
                  <div className="mt-3 flex items-center gap-2">
                    <input
                      type="text"
                      value={brandingForm.secondaryColor}
                      onChange={(e) =>
                        updateBrandingField('secondaryColor', e.target.value)
                      }
                      className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 font-mono text-xs font-bold uppercase text-slate-900"
                    />
                  </div>
                  <div className="mt-3 grid grid-cols-11 overflow-hidden rounded-md border border-slate-200">
                    {Object.entries(secondaryTones).map(([stop, shade]) => (
                      <div
                        key={stop}
                        className="h-4"
                        style={{ backgroundColor: shade.hex }}
                        title={`Secondary ${stop}: ${shade.hex}`}
                      />
                    ))}
                  </div>
                </div>

                {/* Alternative / Accent Color */}
                <div className="mui-card-outlined p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="inline-block rounded bg-teal-100 px-2 py-0.5 text-[10px] font-bold uppercase text-teal-800">
                        Alternative / Accent Color
                      </span>
                      <h3 className="mt-1 text-xs font-extrabold text-slate-900">
                        Tertiary &amp; Tonal Callouts
                      </h3>
                    </div>
                    <input
                      type="color"
                      aria-label="Alternative Accent Color"
                      value={brandingForm.accentColor}
                      onChange={(e) =>
                        updateBrandingField('accentColor', e.target.value)
                      }
                      className="h-10 w-12 cursor-pointer rounded-lg border border-slate-300 bg-white p-0.5"
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500">
                    Alternative badges, tonal buttons, secondary highlights, and status chips.
                  </p>
                  <div className="mt-3 flex items-center gap-2">
                    <input
                      type="text"
                      value={brandingForm.accentColor}
                      onChange={(e) =>
                        updateBrandingField('accentColor', e.target.value)
                      }
                      className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 font-mono text-xs font-bold uppercase text-slate-900"
                    />
                  </div>
                  <div className="mt-3 grid grid-cols-11 overflow-hidden rounded-md border border-slate-200">
                    {Object.entries(accentTones).map(([stop, shade]) => (
                      <div
                        key={stop}
                        className="h-4"
                        style={{ backgroundColor: shade.hex }}
                        title={`Alternative ${stop}: ${shade.hex}`}
                      />
                    ))}
                  </div>
                </div>

                {/* Header / Top App Bar Colors */}
                <div className="mui-card-outlined p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="inline-block rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-700">
                        Top App Bar / Navbar
                      </span>
                      <h3 className="mt-1 text-xs font-extrabold text-slate-900">
                        Header Background &amp; Text
                      </h3>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="color"
                        aria-label="Header Background Color"
                        value={brandingForm.headerBgColor}
                        onChange={(e) =>
                          updateBrandingField('headerBgColor', e.target.value)
                        }
                        className="h-9 w-10 cursor-pointer rounded-lg border border-slate-300 bg-white p-0.5"
                        title="Header Background Color"
                      />
                      <input
                        type="color"
                        aria-label="Header Text Color"
                        value={brandingForm.headerTextColor}
                        onChange={(e) =>
                          updateBrandingField('headerTextColor', e.target.value)
                        }
                        className="h-9 w-10 cursor-pointer rounded-lg border border-slate-300 bg-white p-0.5"
                        title="Header Text Color"
                      />
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[10px] font-semibold text-slate-500">
                        Header BG
                      </span>
                      <input
                        type="text"
                        value={brandingForm.headerBgColor}
                        onChange={(e) =>
                          updateBrandingField('headerBgColor', e.target.value)
                        }
                        className="mt-0.5 w-full rounded-lg border border-slate-300 px-2 py-1 font-mono text-xs font-bold uppercase"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] font-semibold text-slate-500">
                        Header Text
                      </span>
                      <input
                        type="text"
                        value={brandingForm.headerTextColor}
                        onChange={(e) =>
                          updateBrandingField('headerTextColor', e.target.value)
                        }
                        className="mt-0.5 w-full rounded-lg border border-slate-300 px-2 py-1 font-mono text-xs font-bold uppercase"
                      />
                    </div>
                  </div>
                </div>

                {/* Page Background Color */}
                <div className="mui-card-outlined p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="inline-block rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-700">
                        Canvas Background
                      </span>
                      <h3 className="mt-1 text-xs font-extrabold text-slate-900">
                        Global Page Background
                      </h3>
                    </div>
                    <input
                      type="color"
                      aria-label="Page Background Color"
                      value={brandingForm.backgroundColor}
                      onChange={(e) =>
                        updateBrandingField('backgroundColor', e.target.value)
                      }
                      className="h-10 w-12 cursor-pointer rounded-lg border border-slate-300 bg-white p-0.5"
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500">
                    Default background canvas behind dashboards and practice sheets.
                  </p>
                  <div className="mt-3">
                    <input
                      type="text"
                      value={brandingForm.backgroundColor}
                      onChange={(e) =>
                        updateBrandingField('backgroundColor', e.target.value)
                      }
                      className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 font-mono text-xs font-bold uppercase"
                    />
                  </div>
                </div>

                {/* Material Card / Surface Color */}
                <div className="mui-card-outlined p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="inline-block rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-700">
                        Card Surface
                      </span>
                      <h3 className="mt-1 text-xs font-extrabold text-slate-900">
                        Material Paper / Card Surface
                      </h3>
                    </div>
                    <input
                      type="color"
                      aria-label="Material Card Surface Color"
                      value={brandingForm.surfaceColor}
                      onChange={(e) =>
                        updateBrandingField('surfaceColor', e.target.value)
                      }
                      className="h-10 w-12 cursor-pointer rounded-lg border border-slate-300 bg-white p-0.5"
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500">
                    Surface fill for Material cards, modals, and drill containers.
                  </p>
                  <div className="mt-3">
                    <input
                      type="text"
                      value={brandingForm.surfaceColor}
                      onChange={(e) =>
                        updateBrandingField('surfaceColor', e.target.value)
                      }
                      className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 font-mono text-xs font-bold uppercase"
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* Section 4: Live Interactive Material UI Preview & Save Bar */}
            <section className="mui-card-elevated overflow-hidden">
              <div className="border-b border-slate-200 bg-slate-50/80 px-6 py-3.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Eye className="h-4 w-4 text-sky-600" />
                  <span className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
                    Live Material UI Component &amp; View Preview
                  </span>
                </div>
                <span className="text-[11px] font-medium text-slate-500">
                  Reflects Primary, Secondary, Alternative, Logo &amp; Shape settings in real time
                </span>
              </div>

              <div
                className="p-6"
                style={{ backgroundColor: brandingForm.backgroundColor }}
              >
                {/* Mock App Bar */}
                <div
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 shadow-md"
                  style={{
                    backgroundColor: brandingForm.headerBgColor,
                    color: brandingForm.headerTextColor,
                    borderRadius: 'var(--brand-radius, 12px)',
                  }}
                >
                  <div className="flex items-center gap-2.5">
                    <BrandLogo size="sm" overrideBranding={brandingForm} />
                    <span className="text-sm font-bold">
                      {brandingForm.siteName}
                    </span>
                    {brandingForm.siteTagline && (
                      <span
                        className="rounded px-2 py-0.5 text-[11px] font-semibold"
                        style={{
                          backgroundColor: `${brandingForm.primaryColor}33`,
                          color: primaryTones['200'].hex,
                        }}
                      >
                        {brandingForm.siteTagline}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs font-semibold">
                    <span
                      className="rounded-md px-2.5 py-1"
                      style={{
                        backgroundColor: 'rgba(255,255,255,0.14)',
                        color: primaryTones['300'].hex,
                      }}
                    >
                      Practice Plans
                    </span>
                    <span className="opacity-75">Shared View</span>
                  </div>
                </div>

                {/* Mock Material Card & Buttons */}
                <div
                  className="mt-4 border border-slate-200/80 p-5 shadow-sm"
                  style={{
                    backgroundColor: brandingForm.surfaceColor,
                    borderRadius: 'var(--brand-radius, 12px)',
                  }}
                >
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className="px-2.5 py-0.5 text-[11px] font-bold text-white"
                          style={{
                            backgroundColor: brandingForm.primaryColor,
                            borderRadius: 'var(--brand-radius, 8px)',
                          }}
                        >
                          Primary Badge
                        </span>
                        <span
                          className="px-2.5 py-0.5 text-[11px] font-bold text-white"
                          style={{
                            backgroundColor: brandingForm.secondaryColor,
                            borderRadius: 'var(--brand-radius, 8px)',
                          }}
                        >
                          Secondary Tone
                        </span>
                        <span
                          className="px-2.5 py-0.5 text-[11px] font-bold text-white"
                          style={{
                            backgroundColor: brandingForm.accentColor,
                            borderRadius: 'var(--brand-radius, 8px)',
                          }}
                        >
                          Alternative Accent
                        </span>
                      </div>
                      <h4 className="mt-2 text-base font-extrabold text-slate-900">
                        Pro Goalie Crease Mastery &amp; Post Integration
                      </h4>
                      <p className="text-xs text-slate-600">
                        Preview of Material Design 3 typography, surface elevation, and custom brand colors across the planner.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5">
                      <button
                        type="button"
                        className="mui-btn-contained px-4 py-2 text-xs"
                      >
                        Contained Primary
                      </button>
                      <button
                        type="button"
                        className="mui-btn-tonal px-4 py-2 text-xs"
                      >
                        Tonal Alternative
                      </button>
                      <button
                        type="button"
                        className="mui-btn-outlined px-4 py-2 text-xs"
                      >
                        Outlined Action
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white px-6 py-4">
                <span className="text-xs text-slate-500">
                  Changes are restricted to Administrators and apply immediately to all users and shared plan views upon saving.
                </span>
                <button
                  type="submit"
                  disabled={savingBranding}
                  className="mui-btn-contained flex items-center gap-2 px-6 py-2.5 text-sm disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  {savingBranding
                    ? 'Saving Instance Branding...'
                    : 'Save Instance Design & Branding'}
                </button>
              </div>
            </section>
          </form>
        )}

        {/* ================================================================ */}
        {/* TAB 2: DYNAMIC KEYCLOAK & AUTH MODE                              */}
        {/* ================================================================ */}
        {activeTab === 'keycloak' && (
          <form
            onSubmit={handleSaveKeycloakSettings}
            className="mui-card-elevated mt-6 space-y-6 p-6"
          >
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Authentication Provider Selection
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                When <strong>Local (NextAuth/Auth.js)</strong> is selected, coaches sign in with PostgreSQL credentials. When <strong>Keycloak OIDC Only</strong> is selected, NextAuth local login is disabled and authentication routes through your configured Keycloak server.
              </p>

              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setAuthMode('local')}
                  className={`flex flex-col items-start rounded-xl border p-4 text-left transition ${
                    authMode === 'local'
                      ? 'border-sky-600 bg-sky-50/70 ring-2 ring-sky-200'
                      : 'border-slate-200 bg-slate-50/60 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-emerald-600" />
                    <span className="text-sm font-bold text-slate-900">
                      Local NextAuth / Auth.js (No Keycloak)
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-600">
                    Uses built-in database credentials and JWT sessions. Ideal before Keycloak is connected.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setAuthMode('keycloak')}
                  className={`flex flex-col items-start rounded-xl border p-4 text-left transition ${
                    authMode === 'keycloak'
                      ? 'border-sky-600 bg-sky-50/70 ring-2 ring-sky-200'
                      : 'border-slate-200 bg-slate-50/60 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <KeyRound className="h-5 w-5 text-amber-500" />
                    <span className="text-sm font-bold text-slate-900">
                      Keycloak OIDC Only (External Keycloak)
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-600">
                    Routes all coach &amp; admin logins through your Keycloak realm configured below.
                  </p>
                </button>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Keycloak Connection Parameters (Stored in Database)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Add your Redirect URI in Keycloak Client Settings as:{' '}
                    <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-slate-800">
                      {kcConfig.publicOrigin || 'http://localhost:3000'}
                      /api/auth/callback/keycloak
                    </code>
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleTestKeycloak}
                  disabled={testingKc || !kcConfig.issuerUrl}
                  className="flex items-center gap-1.5 rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-800 hover:bg-slate-100 disabled:opacity-40"
                >
                  <RefreshCw
                    className={`h-3.5 w-3.5 ${testingKc ? 'animate-spin' : ''}`}
                  />
                  {testingKc
                    ? 'Testing OIDC Discovery...'
                    : 'Test Keycloak Connection'}
                </button>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700">
                    Keycloak Server or Realm Issuer URL
                  </label>
                  <input
                    type="url"
                    value={kcConfig.issuerUrl}
                    onChange={(e) =>
                      setKcConfig({ ...kcConfig, issuerUrl: e.target.value })
                    }
                    placeholder="http://localhost:8080/realms/gcpl"
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700">
                    Realm Name
                  </label>
                  <input
                    type="text"
                    value={kcConfig.realm}
                    onChange={(e) =>
                      setKcConfig({ ...kcConfig, realm: e.target.value })
                    }
                    placeholder="gcpl"
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700">
                    Client ID
                  </label>
                  <input
                    type="text"
                    value={kcConfig.clientId}
                    onChange={(e) =>
                      setKcConfig({ ...kcConfig, clientId: e.target.value })
                    }
                    placeholder="gcpl-web"
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700">
                    Client Secret (if Confidential Client)
                  </label>
                  <input
                    type="password"
                    value={kcConfig.clientSecret}
                    onChange={(e) =>
                      setKcConfig({ ...kcConfig, clientSecret: e.target.value })
                    }
                    placeholder="gcpl-keycloak-secret"
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700">
                    Application Public Origin URL
                  </label>
                  <input
                    type="url"
                    value={kcConfig.publicOrigin}
                    onChange={(e) =>
                      setKcConfig({ ...kcConfig, publicOrigin: e.target.value })
                    }
                    placeholder="http://localhost:3000"
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-900"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end border-t border-slate-100 pt-4">
              <button
                type="submit"
                disabled={savingKc}
                className="mui-btn-contained px-6 py-2.5 text-sm disabled:opacity-50"
              >
                {savingKc
                  ? 'Saving Configuration...'
                  : 'Save Authentication & Keycloak Configuration'}
              </button>
            </div>
          </form>
        )}

        {/* ================================================================ */}
        {/* TAB 3: COACH & ADMIN USER MANAGEMENT                             */}
        {/* ================================================================ */}
        {activeTab === 'users' && (
          <div className="mt-6 space-y-6">
            <form
              onSubmit={handleCreateUser}
              className="mui-card-elevated p-6"
            >
              <h2 className="text-base font-bold text-slate-900">
                Add Goalie Coach or Administrator
              </h2>
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-4">
                <input
                  type="text"
                  required
                  placeholder="Full Name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="rounded-xl border border-slate-300 px-3 py-2 text-xs"
                />
                <input
                  type="email"
                  required
                  placeholder="coach@team.org"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="rounded-xl border border-slate-300 px-3 py-2 text-xs"
                />
                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder="Initial Password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="rounded-xl border border-slate-300 px-3 py-2 text-xs"
                />
                <div className="flex gap-2">
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as UserRole)}
                    className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold"
                  >
                    <option value="COACH">COACH</option>
                    <option value="ADMIN">ADMIN</option>
                  </select>
                  <button
                    type="submit"
                    className="mui-btn-contained flex flex-1 items-center justify-center gap-1 px-3 py-2 text-xs"
                  >
                    <Plus className="h-4 w-4" />
                    Add
                  </button>
                </div>
              </div>
            </form>

            <div className="mui-card-elevated overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-bold">Name</th>
                    <th className="px-4 py-3 font-bold">Email</th>
                    <th className="px-4 py-3 font-bold">Provider</th>
                    <th className="px-4 py-3 font-bold">Role</th>
                    <th className="px-4 py-3 font-bold">Status</th>
                    <th className="px-4 py-3 font-bold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50/80">
                      <td className="px-4 py-3 font-bold text-slate-900">
                        {u.name}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{u.email}</td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 font-semibold text-slate-700">
                          {u.authProvider}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2.5 py-0.5 font-bold ${
                            u.role === 'ADMIN'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-sky-100 text-sky-800'
                          }`}
                        >
                          {u.role}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2 py-0.5 font-bold ${
                            u.active
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {u.active ? 'Active' : 'Disabled'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right space-x-2">
                        <button
                          type="button"
                          onClick={() =>
                            handleToggleUser(u, {
                              role: u.role === 'ADMIN' ? 'COACH' : 'ADMIN',
                            })
                          }
                          className="rounded border border-slate-300 bg-white px-2 py-1 font-semibold text-slate-700 hover:bg-slate-100"
                        >
                          Make {u.role === 'ADMIN' ? 'COACH' : 'ADMIN'}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleToggleUser(u, { active: !u.active })
                          }
                          className="rounded border border-slate-300 bg-white px-2 py-1 font-semibold text-slate-700 hover:bg-slate-100"
                        >
                          {u.active ? 'Disable' : 'Enable'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
