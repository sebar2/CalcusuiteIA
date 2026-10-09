import React, { useState } from 'react';
import { Building2, Mail, Phone, MapPin } from 'lucide-react';

export interface CompanyContactData {
  nombre: string;
  rut?: string | null;
  logo_url?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  contacto?: string | null;
}

interface CompanyContactCardProps {
  company: CompanyContactData;
  variant?: 'compact' | 'full';
  className?: string;
}

export const CompanyContactCard: React.FC<CompanyContactCardProps> = ({
  company,
  variant = 'compact',
  className = '',
}) => {
  const [logoError, setLogoError] = useState(false);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join('');
  };

  const renderLogo = (sizeClass: string, iconSize: number) => {
    if (company.logo_url && !logoError) {
      return (
        <img
          src={company.logo_url}
          alt={company.nombre}
          onError={() => setLogoError(true)}
          className={`${sizeClass} rounded-lg object-contain bg-white dark:bg-slate-800 p-1 border border-slate-200 dark:border-slate-700/80 shadow-xs shrink-0`}
        />
      );
    }
    return (
      <div
        className={`${sizeClass} rounded-lg bg-gradient-to-br from-sky-500/10 to-indigo-500/20 dark:from-sky-950/40 dark:to-indigo-950/40 border border-sky-200 dark:border-sky-800/60 flex items-center justify-center font-bold text-sky-600 dark:text-sky-400 shrink-0 text-xs shadow-xs`}
      >
        {company.nombre ? getInitials(company.nombre) : <Building2 size={iconSize} />}
      </div>
    );
  };

  if (variant === 'compact') {
    return (
      <div className={`flex items-start gap-2.5 p-2 rounded-lg bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/50 ${className}`}>
        {renderLogo('w-8 h-8', 16)}
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-xs text-slate-800 dark:text-slate-100 truncate">
            {company.nombre}
          </div>
          {company.rut && (
            <div className="text-[10px] text-slate-400 font-mono">
              RUT: {company.rut}
            </div>
          )}
          <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            {company.email && (
              <a
                href={`mailto:${company.email}`}
                className="inline-flex items-center gap-1 hover:text-[#00a2e8] transition-colors"
                title={`Enviar email a ${company.email}`}
              >
                <Mail size={11} className="text-slate-400" />
                <span className="truncate max-w-[120px]">{company.email}</span>
              </a>
            )}
            {company.phone && (
              <a
                href={`tel:${company.phone}`}
                className="inline-flex items-center gap-1 hover:text-[#00a2e8] transition-colors"
                title={`Llamar a ${company.phone}`}
              >
                <Phone size={11} className="text-slate-400" />
                <span>{company.phone}</span>
              </a>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3 ${className}`}>
      <div className="flex items-center gap-3">
        {renderLogo('w-12 h-12', 24)}
        <div className="flex-1 min-w-0">
          <h4 className="font-bold text-sm text-slate-900 dark:text-slate-50 truncate">
            {company.nombre}
          </h4>
          <div className="flex items-center gap-2 mt-0.5">
            {company.rut && (
              <span className="inline-block text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                RUT {company.rut}
              </span>
            )}
            {company.contacto && (
              <span className="text-[11px] text-slate-400 truncate">
                Contacto: {company.contacto}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
        {company.email && (
          <div className="flex items-center gap-2">
            <Mail size={14} className="text-sky-500 shrink-0" />
            <a
              href={`mailto:${company.email}`}
              className="text-slate-700 dark:text-slate-200 hover:text-sky-500 dark:hover:text-sky-400 transition-colors truncate font-medium"
            >
              {company.email}
            </a>
          </div>
        )}
        {company.phone && (
          <div className="flex items-center gap-2">
            <Phone size={14} className="text-emerald-500 shrink-0" />
            <a
              href={`tel:${company.phone}`}
              className="text-slate-700 dark:text-slate-200 hover:text-emerald-500 dark:hover:text-emerald-400 transition-colors font-medium"
            >
              {company.phone}
            </a>
          </div>
        )}
        {company.address && (
          <div className="flex items-start gap-2">
            <MapPin size={14} className="text-rose-500 shrink-0 mt-0.5" />
            <span className="text-slate-500 dark:text-slate-400 text-[11px] leading-tight">
              {company.address}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default CompanyContactCard;
