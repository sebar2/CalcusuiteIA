import React, { useState, useEffect } from 'react';
import {
  Building2,
  ShieldCheck,
  Sparkles,
  Plus,
  Terminal,
  CheckCircle2,
  AlertTriangle,
  Database,
  KeyRound,
  RefreshCw,
  Crown,
  Layers,
  Copy,
  Check,
  Lock,
} from 'lucide-react';
import { apiService, getStoredUser } from '../services/api';
import type { TenantAccountItem } from '../types';

interface MasterAdminTenantsViewProps {
  onLicenseChanged?: (updatedTenant: TenantAccountItem) => void;
}

const LICENSE_TIERS_INFO = [
  {
    key: 'STARTER',
    label: 'Licencia Starter (Pyme)',
    price: 79,
    maxUsers: 3,
    description:
      'Ideal para equipos comerciales en etapa inicial: Pipeline CRM Kanban con etiquetas de origen, Webhook Web, WhatsApp y Chat Omnicanal Básico.',
    restrictedSummary: 'Restringe 3PL Logística, Facturación Electrónica y Licitaciones SICE.',
  },
  {
    key: 'PRO',
    label: 'Licencia Pro (Growth & AdTech)',
    price: 190,
    maxUsers: 10,
    description:
      'Para empresas en expansión comercial: Habilita los 5 Canales AdTech (Google Ads, Meta, WhatsApp, Email, Web), Copiloto IA Gratuito y Facturación Electrónica B2B.',
    restrictedSummary: 'Restringe únicamente módulos operativos de Flota 3PL.',
  },
  {
    key: 'ENTERPRISE_3PL',
    label: 'Licencia Enterprise & 3PL (Suite Completa)',
    price: 490,
    maxUsers: 999,
    description:
      'Licencia por defecto durante los 14 días gratuitos de prueba: 100% de módulos desbloqueados, Hub Omnicanal IA 24/7, Suite 3PL Completa, Licitaciones SICE/RUPE y Auditoría ISO 27001.',
    restrictedSummary: 'Ninguno (100% de la plataforma habilitada).',
  },
];

export const MasterAdminTenantsView: React.FC<MasterAdminTenantsViewProps> = ({
  onLicenseChanged,
}) => {
  const [currentTenant, setCurrentTenant] = useState<TenantAccountItem | null>(null);
  const [tenantsList, setTenantsList] = useState<TenantAccountItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSwitchingLicense, setIsSwitchingLicense] = useState<boolean>(false);
  const [banner, setBanner] = useState<{ type: 'success' | 'warning' | 'error'; text: string } | null>(null);
  const [copiedCli, setCopiedCli] = useState<boolean>(false);

  // Modal Aprovisionar Nueva Cuenta Multi-Tenant
  const [isProvisionModalOpen, setIsProvisionModalOpen] = useState<boolean>(false);
  const [newSlug, setNewSlug] = useState<string>('');
  const [newCompanyName, setNewCompanyName] = useState<string>('');
  const [newRut, setNewRut] = useState<string>('');
  const [newAdminEmail, setNewAdminEmail] = useState<string>('');
  const [newAdminUsername, setNewAdminUsername] = useState<string>('');
  const [newAdminPassword, setNewAdminPassword] = useState<string>('');
  const [newLicenseTier, setNewLicenseTier] = useState<string>('ENTERPRISE_3PL');
  const [isProvisioning, setIsProvisioning] = useState<boolean>(false);

  // Configuración 2FA TOTP
  const [totpSetupData, setTotpSetupData] = useState<{
    status: string;
    user_id: string;
    totp_secret: string;
    otpauth_uri: string;
    instructions: string;
  } | null>(null);
  const [totpVerifyCode, setTotpVerifyCode] = useState<string>('');
  const [isEnabling2FA, setIsEnabling2FA] = useState<boolean>(false);

  const storedUser = getStoredUser();
  const isMasterSuperAdmin = Boolean(
    storedUser?.is_master_superadmin ||
    storedUser?.user_id?.toLowerCase() === 'seba' ||
    storedUser?.user_id?.toLowerCase() === 'sebar_2@hotmail.com'
  );

  const loadData = async () => {
    setIsLoading(true);
    try {
      const curr = await apiService.getCurrentTenant();
      setCurrentTenant(curr);
      if (isMasterSuperAdmin) {
        const allTenants = await apiService.getAllTenants().catch(() => []);
        setTenantsList(allTenants.length > 0 ? allTenants : [curr]);
      } else {
        setTenantsList([curr]);
      }
    } catch (err: any) {
      setBanner({
        type: 'error',
        text: err.response?.data?.detail || 'No se pudo cargar la información de licencias Multi-Tenant.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSwitchLicense = async (targetTier: string, tenantId?: string) => {
    const targetId = tenantId || currentTenant?.id;
    if (!targetId) return;
    setIsSwitchingLicense(true);
    try {
      const updated = await apiService.updateTenantLicense(targetId, {
        simulated_tier: targetTier,
        license_tier: targetTier,
      });
      if (currentTenant && updated.id === currentTenant.id) {
        setCurrentTenant(updated);
        if (onLicenseChanged) onLicenseChanged(updated);
        window.dispatchEvent(new CustomEvent('calcu:license:changed', { detail: updated }));
      }
      setTenantsList((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      setBanner({
        type: 'success',
        text: `Licencia de "${updated.nombre_empresa}" conmutada en vivo a [${updated.capabilities?.name || targetTier}]. El menú lateral ha actualizado los módulos habilitados.`,
      });
    } catch (err: any) {
      setBanner({
        type: 'error',
        text: err.response?.data?.detail || 'No se pudo cambiar la licencia.',
      });
    } finally {
      setIsSwitchingLicense(false);
    }
  };

  const handleProvisionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProvisioning(true);
    try {
      const slugClean =
        newSlug.trim() ||
        newCompanyName
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '_')
          .replace(/^_|_$/g, '');
      const created = await apiService.provisionTenant({
        slug: slugClean,
        nombre_empresa: newCompanyName.trim(),
        rut: newRut.trim() || undefined,
        admin_email: newAdminEmail.trim() || `admin@${slugClean}.com.uy`,
        admin_username: newAdminUsername.trim(),
        admin_password: newAdminPassword,
        license_tier: newLicenseTier,
        trial_days: 14,
      });
      setTenantsList((prev) => [created, ...prev]);
      setIsProvisionModalOpen(false);
      setNewSlug('');
      setNewCompanyName('');
      setNewRut('');
      setNewAdminEmail('');
      setNewAdminUsername('');
      setNewAdminPassword('');
      setBanner({
        type: 'success',
        text: `Cuenta "${created.nombre_empresa}" aprovisionada con éxito en esquema aislado (${created.schema_name}) con 14 días Trial en Licencia ${created.effective_tier}.`,
      });
    } catch (err: any) {
      setBanner({
        type: 'error',
        text: err.response?.data?.detail || 'Error al aprovisionar el nuevo tenant.',
      });
    } finally {
      setIsProvisioning(false);
    }
  };

  const handleStart2FASetup = async () => {
    try {
      const data = await apiService.setup2FA();
      setTotpSetupData(data);
    } catch (err: any) {
      setBanner({
        type: 'error',
        text: err.response?.data?.detail || 'Error al generar semilla TOTP 2FA.',
      });
    }
  };

  const handleConfirm2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!totpVerifyCode.trim()) return;
    setIsEnabling2FA(true);
    try {
      const res = await apiService.enable2FA(totpVerifyCode.trim());
      setBanner({ type: 'success', text: res.message });
      setTotpSetupData(null);
      setTotpVerifyCode('');
    } catch (err: any) {
      setBanner({
        type: 'error',
        text: err.response?.data?.detail || 'Código TOTP inválido.',
      });
    } finally {
      setIsEnabling2FA(false);
    }
  };

  const cliCommand = `python -m app.cli.provision_tenant --slug "distsur" --empresa "Distribuidora del Sur S.A." --rut "219988770019" --admin-user "admin_sur" --admin-pass "ClaveSegura2026!" --tier ENTERPRISE_3PL --trial-days 14`;

  return (
    <div className="space-y-6">
      {/* Cabecera Principal */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-md">
            <Crown size={24} />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                {isMasterSuperAdmin
                  ? "Licenciamiento SaaS Multi-Tenant & Panel Super-Admin"
                  : "Licenciamiento SaaS & Estado de Cuenta Corporativa"}
              </h1>
              {currentTenant?.subscription_status === 'TRIAL_14_DAYS' && (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 flex items-center gap-1">
                  <Sparkles size={12} />
                  <span>Trial Activo ({currentTenant.trial_days_remaining} días restantes)</span>
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {isMasterSuperAdmin
                ? "Aislamiento de Base de Datos por Cuenta (`Schema-per-Tenant`), Simulador de Licencias en Modo Trial (14 días) y Seguridad 2FA TOTP."
                : "Simulador de planes en modo evaluación de 14 días para su cuenta, verificación de módulos habilitados y seguridad 2FA TOTP."}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={loadData}
            disabled={isLoading}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            title="Refrescar estado de cuentas"
          >
            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
          </button>
          {isMasterSuperAdmin && (
            <button
              onClick={() => setIsProvisionModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#00a2e8] hover:bg-[#008ecb] text-white text-xs font-bold shadow-sm transition-all cursor-pointer"
            >
              <Plus size={15} />
              <span>+ Aprovisionar Nueva Cuenta (Tenant)</span>
            </button>
          )}
        </div>
      </div>

      {/* Feedback Banner */}
      {banner && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between text-xs font-medium ${
            banner.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
              : banner.type === 'warning'
              ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200'
              : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {banner.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
            <span>{banner.text}</span>
          </div>
          <button onClick={() => setBanner(null)} className="font-bold ml-4">
            ×
          </button>
        </div>
      )}

      {/* SECCIÓN 1: Simulador Interactivo de Licencia en Modo 14 Días Trial */}
      {currentTenant && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#00a2e8]">
                Cuenta Activa: {currentTenant.nombre_empresa} ({currentTenant.id})
              </span>
              <h2 className="text-base font-bold text-slate-900 dark:text-white mt-0.5">
                Conmutador Interactivo de Licencia (Modo Prueba Gratuita 14 Días)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Por defecto su cuenta inicia los 14 días gratuitos con la <strong>Licencia Enterprise &amp; 3PL</strong> completa. Como administrador puede alternar de plan aquí mismo para experimentar qué módulos habilita o restringe cada licencia antes de contratar.
              </p>
            </div>
            <div className="text-right shrink-0">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-mono text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
                <Database size={13} className="text-[#00a2e8]" />
                <span>Schema: {currentTenant.schema_name}</span>
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {LICENSE_TIERS_INFO.map((tier) => {
              const isCurrent = currentTenant.effective_tier === tier.key;

              return (
                <div
                  key={tier.key}
                  className={`rounded-2xl p-4 border transition-all flex flex-col justify-between ${
                    isCurrent
                      ? 'border-[#00a2e8] bg-sky-50/40 dark:bg-sky-950/30 ring-2 ring-[#00a2e8]/30 shadow-sm'
                      : 'border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-800/30'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                        {tier.label}
                      </span>
                      {tier.key === 'ENTERPRISE_3PL' && (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300">
                          Default 14d Trial
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-base font-black text-[#00a2e8]">
                      USD ${tier.price}{' '}
                      <span className="text-[11px] font-normal text-slate-400">/ mes</span>
                    </div>
                    <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                      {tier.description}
                    </p>

                    <div className="mt-3 space-y-1 text-[11px] text-slate-500 dark:text-slate-400">
                      <div>
                        • Límite de Usuarios: <strong>{tier.maxUsers}</strong>
                      </div>
                      <div>
                        • Alcance: <strong>{tier.restrictedSummary}</strong>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={isCurrent || isSwitchingLicense}
                    onClick={() => handleSwitchLicense(tier.key)}
                    className={`mt-4 w-full py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      isCurrent
                        ? 'bg-emerald-600 text-white cursor-default'
                        : 'bg-[#00a2e8] hover:bg-[#008ecb] text-white shadow-xs'
                    }`}
                  >
                    {isCurrent ? '✓ Plan Activo en su Cuenta' : `Simular Plan ${tier.key}`}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SECCIÓN 2: Seguridad 2FA TOTP & Automatización CLI */}
      <div className={`grid grid-cols-1 ${isMasterSuperAdmin ? 'lg:grid-cols-2' : ''} gap-5`}>
        {/* Tarjeta 2FA TOTP */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs space-y-3">
          <div className="flex items-center gap-2.5">
            <KeyRound size={20} className="text-emerald-600" />
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Autenticación de Dos Factores (2FA / TOTP RFC 6238)
              </h3>
              <p className="text-xs text-slate-500">
                Compatible con Google Authenticator, Authy y Microsoft Authenticator.
              </p>
            </div>
          </div>

          {!totpSetupData ? (
            <div className="pt-2">
              <button
                type="button"
                onClick={handleStart2FASetup}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer"
              >
                <Lock size={13} />
                <span>Generar Llave 2FA para mi Usuario</span>
              </button>
            </div>
          ) : (
            <form onSubmit={handleConfirm2FA} className="space-y-3 pt-2 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-1">
                <span className="text-[10px] font-bold uppercase text-slate-400 block">
                  Semilla Base32 (Agregar en Google Authenticator / Authy):
                </span>
                <code className="text-sm font-mono font-bold text-emerald-600 dark:text-emerald-400 break-all">
                  {totpSetupData.totp_secret}
                </code>
                <p className="text-[11px] text-slate-500 mt-1">{totpSetupData.instructions}</p>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  maxLength={6}
                  required
                  value={totpVerifyCode}
                  onChange={(e) => setTotpVerifyCode(e.target.value)}
                  placeholder="Código de 6 dígitos..."
                  className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 font-mono font-bold text-slate-900 dark:text-white"
                />
                <button
                  type="submit"
                  disabled={isEnabling2FA}
                  className="px-4 py-2 rounded-xl bg-[#00a2e8] text-white font-bold cursor-pointer"
                >
                  {isEnabling2FA ? 'Verificando...' : 'Activar 2FA'}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Tarjeta Script CLI de Aprovisionamiento (Solo Superadministrador Maestro) */}
        {isMasterSuperAdmin && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Terminal size={20} className="text-indigo-600" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Script CLI de Aprovisionamiento Automatizado
                  </h3>
                  <p className="text-xs text-slate-500">
                    Cree licencias y bases de datos aisladas por terminal sin tocar código.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(cliCommand);
                  setCopiedCli(true);
                  setTimeout(() => setCopiedCli(false), 2000);
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
              >
                {copiedCli ? <Check size={13} /> : <Copy size={13} />}
                <span>{copiedCli ? 'Copiado' : 'Copiar CLI'}</span>
              </button>
            </div>

            <pre className="p-3 rounded-xl bg-slate-950 text-emerald-400 font-mono text-[11px] overflow-x-auto">
              {cliCommand}
            </pre>
          </div>
        )}
      </div>

      {/* SECCIÓN 3: Tabla de Cuentas (Tenants) Aprovisionadas (Solo Superadministrador Maestro) */}
      {isMasterSuperAdmin && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Layers size={16} className="text-[#00a2e8]" />
              <span>Cuentas Corporativas Aisladas ({tenantsList.length})</span>
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] uppercase tracking-wider text-slate-400">
                  <th className="py-2.5 px-3">Tenant ID / Slug</th>
                  <th className="py-2.5 px-3">Empresa / Razón Social</th>
                  <th className="py-2.5 px-3">Esquema / DB Aislada</th>
                  <th className="py-2.5 px-3">Licencia Efectiva</th>
                  <th className="py-2.5 px-3">Estado Suscripción</th>
                  <th className="py-2.5 px-3 text-right">Conmutar Plan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {tenantsList.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-800 dark:text-slate-200">
                      <div>{t.id}</div>
                      <div className="text-[10px] text-slate-400">@{t.admin_username}</div>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-bold text-slate-900 dark:text-white">{t.nombre_empresa}</div>
                      {t.rut && <div className="text-[10px] text-slate-400 font-mono">RUT: {t.rut}</div>}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600 dark:text-slate-300">
                      <div>Schema: {t.schema_name}</div>
                      <div className="text-[10px] text-slate-400">Strategy: {t.db_strategy}</div>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-sky-50 dark:bg-sky-950/60 text-[#00a2e8] border border-sky-200 dark:border-sky-800">
                        {t.capabilities?.name || t.effective_tier}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      {t.subscription_status === 'TRIAL_14_DAYS' ? (
                        <span className="text-amber-600 dark:text-amber-400 font-semibold">
                          14d Trial ({t.trial_days_remaining}d restantes)
                        </span>
                      ) : (
                        <span className="text-emerald-600 font-semibold">{t.subscription_status}</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <select
                        value={t.effective_tier}
                        onChange={(e) => handleSwitchLicense(e.target.value, t.id)}
                        className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs font-bold text-slate-800 dark:text-white"
                      >
                        <option value="STARTER">Starter CRM</option>
                        <option value="PRO">Pro Growth &amp; AdTech</option>
                        <option value="ENTERPRISE_3PL">Enterprise &amp; 3PL</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Aprovisionar Nueva Cuenta Multi-Tenant */}
      {isProvisionModalOpen && isMasterSuperAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Building2 size={20} className="text-[#00a2e8]" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Aprovisionar Nueva Cuenta SaaS Aislada (Tenant)
                </h3>
              </div>
              <button
                onClick={() => setIsProvisionModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleProvisionSubmit} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Razón Social / Empresa *
                  </label>
                  <input
                    type="text"
                    required
                    value={newCompanyName}
                    onChange={(e) => setNewCompanyName(e.target.value)}
                    placeholder="ej. Distribuidora del Sur S.A."
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Slug / Identificador Cuenta *
                  </label>
                  <input
                    type="text"
                    required
                    value={newSlug}
                    onChange={(e) => setNewSlug(e.target.value)}
                    placeholder="ej. distsur"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    RUT / ID Fiscal
                  </label>
                  <input
                    type="text"
                    value={newRut}
                    onChange={(e) => setNewRut(e.target.value)}
                    placeholder="ej. 218899000012"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Email Corporativo Admin *
                  </label>
                  <input
                    type="email"
                    required
                    value={newAdminEmail}
                    onChange={(e) => setNewAdminEmail(e.target.value)}
                    placeholder="admin@distsur.com.uy"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Usuario Admin de la Cuenta *
                  </label>
                  <input
                    type="text"
                    required
                    value={newAdminUsername}
                    onChange={(e) => setNewAdminUsername(e.target.value)}
                    placeholder="ej. admin_sur"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Contraseña Inicial *
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={newAdminPassword}
                    onChange={(e) => setNewAdminPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Licencia Inicial (14 días Trial)
                </label>
                <select
                  value={newLicenseTier}
                  onChange={(e) => setNewLicenseTier(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-bold"
                >
                  <option value="ENTERPRISE_3PL">Licencia Enterprise &amp; 3PL (Default Trial)</option>
                  <option value="PRO">Licencia Pro Supply &amp; FP&amp;A</option>
                  <option value="STARTER">Licencia Starter CRM &amp; Omnicanal</option>
                </select>
              </div>

              <div className="p-3 rounded-xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 text-[11px] text-sky-800 dark:text-sky-200 flex items-center gap-2">
                <ShieldCheck size={16} className="shrink-0 text-[#00a2e8]" />
                <span>
                  Se creará automáticamente una base de datos aislada y los 5 conectores multicanal listos para el nuevo cliente.
                </span>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsProvisionModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isProvisioning}
                  className="px-4 py-2 rounded-xl bg-[#00a2e8] hover:bg-[#008ecb] text-white font-bold shadow-sm cursor-pointer"
                >
                  {isProvisioning ? 'Aprovisionando...' : 'Crear Cuenta & Base Aislada'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default MasterAdminTenantsView;
