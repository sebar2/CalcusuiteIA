import { 
  Boxes, 
  BadgePercent, 
  BarChart3, 
  FileText, 
  UploadCloud, 
  ChevronLeft, 
  ChevronRight, 
  Layers,
  GitPullRequest,
  Briefcase,
  Handshake,
  Ship,
  Users,
  Truck,
  BookOpen,
  Radio,
  Coins,
  ShieldCheck,
  Landmark,
  Calendar,
  Calculator,
  Building2,
  MapPin,
  Receipt,
  CircleDollarSign,
  ClipboardList,
} from 'lucide-react';

export type ActiveTab = 
  | 'control_room' 
  | 'kanban' 
  | 'stock_trace'
  | 'pricing' 
  | 'crm'
  | 'clients'
  | 'suppliers'
  | 'supplier-catalogs'
  | 'tenders'
  | 'tenders_radar'
  | 'tenders_benchmarks'
  | 'tenders_competitors'
  | 'tenders_buyers'
  | 'tenders_calendar'
  | 'tenders_cotizador'
  | 'logistics-clients'
  | 'logistics-fleet'
  | 'logistics-inventory'
  | 'logistics-kanban'
  | 'logistics-tracking'
  | 'logistics-orders'
  | 'logistics-finance'
  | 'initiatives' 
  | 'variance' 
  | 'reports' 
  | 'etl';

interface SidebarProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  alertCount: number;
  currentRole?: string;
}

interface NavSection {
  title: string;
  items: {
    id: ActiveTab;
    label: string;
    shortLabel: string;
    icon: any;
    badge?: number;
    badgeColor?: string;
    roles: string[];
  }[];
}

export const Sidebar = ({
  activeTab,
  onTabChange,
  collapsed,
  onToggleCollapse,
  alertCount,
  currentRole = 'controller_admin',
}: SidebarProps) => {
  const sections: NavSection[] = [
    {
      title: 'Supply Chain & Logística',
      items: [
        {
          id: 'control_room',
          label: 'Control Room Abastecimiento',
          shortLabel: 'Abastecimiento',
          icon: Boxes,
          badge: alertCount > 0 ? alertCount : undefined,
          badgeColor: 'bg-rose-500',
          roles: ['controller_admin', 'operaciones', 'analista_operaciones'],
        },
        {
          id: 'kanban',
          label: 'Pipeline Kanban Reposición',
          shortLabel: 'Kanban ROP',
          icon: GitPullRequest,
          roles: ['controller_admin', 'operaciones', 'analista_operaciones'],
        },
        {
          id: 'stock_trace',
          label: 'Trazabilidad Multi-Depósito',
          shortLabel: 'Multi-Depósito',
          icon: Ship,
          roles: ['controller_admin', 'operaciones', 'analista_operaciones'],
        },
        {
          id: 'suppliers',
          label: 'Directorio Proveedores',
          shortLabel: 'Proveedores',
          icon: Truck,
          roles: ['controller_admin', 'operaciones', 'analista_operaciones', 'comercial', 'analista_comercial'],
        },
        {
          id: 'supplier-catalogs',
          label: 'Catálogos de Proveedores',
          shortLabel: 'Catálogos',
          icon: BookOpen,
          roles: ['controller_admin', 'operaciones', 'analista_operaciones', 'comercial', 'analista_comercial'],
        },
      ],
    },
    {
      title: '3PL Logística & Distribución',
      items: [
        {
          id: 'logistics-clients',
          label: 'Clientes 3PL (Retail & PyMEs)',
          shortLabel: 'Clientes 3PL',
          icon: Building2,
          roles: ['controller_admin', 'operaciones', 'analista_operaciones', 'comercial', 'analista_comercial'],
        },
        {
          id: 'logistics-fleet',
          label: 'Flota & Personal Tercerizado',
          shortLabel: 'Flota & Choferes',
          icon: Truck,
          roles: ['controller_admin', 'operaciones', 'analista_operaciones'],
        },
        {
          id: 'logistics-inventory',
          label: 'Depósito & Stock 3PL (WMS)',
          shortLabel: 'Depósito 3PL',
          icon: Boxes,
          roles: ['controller_admin', 'operaciones', 'analista_operaciones'],
        },
        {
          id: 'logistics-kanban',
          label: 'Kanban Operativo 3PL',
          shortLabel: 'Kanban 3PL',
          icon: ClipboardList,
          roles: ['controller_admin', 'operaciones', 'analista_operaciones'],
        },
        {
          id: 'logistics-tracking',
          label: 'Ruteo & Tracking GPS en Vivo',
          shortLabel: 'Tracking GPS',
          icon: MapPin,
          roles: ['controller_admin', 'operaciones', 'analista_operaciones'],
        },
        {
          id: 'logistics-orders',
          label: 'Órdenes de Servicio Logístico',
          shortLabel: 'Órdenes 3PL',
          icon: Receipt,
          roles: ['controller_admin', 'operaciones', 'analista_operaciones', 'comercial', 'analista_comercial'],
        },
        {
          id: 'logistics-finance',
          label: 'Costos & Rentabilidad 3PL',
          shortLabel: 'Rentabilidad 3PL',
          icon: CircleDollarSign,
          roles: ['controller_admin', 'operaciones', 'analista_operaciones', 'comercial', 'analista_comercial'],
        },
      ],
    },
    {
      title: 'Licitaciones & Mercado Público',
      items: [
        {
          id: 'tenders_radar',
          label: 'Radar de Convocatorias',
          shortLabel: 'Radar SICE',
          icon: Radio,
          roles: ['controller_admin', 'comercial', 'analista_comercial'],
        },
        {
          id: 'tenders_benchmarks',
          label: 'Precios & SICE',
          shortLabel: 'Precios & SICE',
          icon: Coins,
          roles: ['controller_admin', 'comercial', 'analista_comercial'],
        },
        {
          id: 'tenders_competitors',
          label: 'Competidores & Proveedores',
          shortLabel: 'Competidores',
          icon: ShieldCheck,
          roles: ['controller_admin', 'comercial', 'analista_comercial'],
        },
        {
          id: 'tenders_buyers',
          label: 'Compradores & Intendencias',
          shortLabel: 'Compradores',
          icon: Landmark,
          roles: ['controller_admin', 'comercial', 'analista_comercial'],
        },
        {
          id: 'tenders_calendar',
          label: 'Calendario & Logística MVD',
          shortLabel: 'Calendario',
          icon: Calendar,
          roles: ['controller_admin', 'comercial', 'analista_comercial', 'operaciones'],
        },
        {
          id: 'tenders_cotizador',
          label: 'Cotizador & Dictamen B2B',
          shortLabel: 'Cotizador B2B',
          icon: Calculator,
          roles: ['controller_admin', 'comercial', 'analista_comercial'],
        },
      ],
    },
    {
      title: 'Finanzas & Control FP&A',
      items: [
        {
          id: 'variance',
          label: 'Control Presupuestario & Escenarios',
          shortLabel: 'Presupuestos',
          icon: BarChart3,
          roles: ['controller_admin'],
        },
        {
          id: 'initiatives',
          label: 'Evaluador de Iniciativas & CAPEX',
          shortLabel: 'Nuevos Proyectos',
          icon: Briefcase,
          roles: ['controller_admin'],
        },
        {
          id: 'reports',
          label: 'Copiloto Ejecutivo & Acciones',
          shortLabel: 'Minutas IA',
          icon: FileText,
          roles: ['controller_admin'],
        },
      ],
    },
    {
      title: 'Comercial & Ventas B2B',
      items: [
        {
          id: 'crm',
          label: 'Pipeline Comercial (CRM)',
          shortLabel: 'Pipeline CRM',
          icon: Handshake,
          roles: ['controller_admin', 'comercial', 'analista_comercial'],
        },
        {
          id: 'pricing',
          label: 'Analítica Comercial & Canales',
          shortLabel: 'Pricing & Canales',
          icon: BadgePercent,
          roles: ['controller_admin', 'comercial', 'analista_comercial'],
        },
        {
          id: 'clients',
          label: 'Directorio Clientes B2B',
          shortLabel: 'Clientes B2B',
          icon: Users,
          roles: ['controller_admin', 'comercial', 'analista_comercial'],
        },
      ],
    },
    {
      title: 'Sistema & Datos',
      items: [
        {
          id: 'etl',
          label: 'Ingesta de Datos (ETL)',
          shortLabel: 'ETL Ingest',
          icon: UploadCloud,
          roles: ['controller_admin', 'operaciones', 'analista_operaciones'],
        },
      ],
    },
  ];

  // Filtrar según el rol activo
  const filteredSections = sections
    .map((sec) => ({
      ...sec,
      items: sec.items.filter((item) => {
        if (currentRole === 'controller_admin') return true;
        return item.roles.includes(currentRole);
      }),
    }))
    .filter((sec) => sec.items.length > 0);

  return (
    <aside
      className={`fixed top-0 left-0 h-screen bg-white dark:bg-slate-900 border-r border-slate-200/80 dark:border-slate-800 z-30 transition-all duration-300 flex flex-col ${
        collapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* Brand Header */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
        {!collapsed && (
          <div className="flex items-center space-x-2.5 overflow-hidden">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-[#00a2e8] to-[#2fc6f6] flex items-center justify-center text-white font-bold shadow-sm shrink-0">
              <Layers size={18} />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-sm tracking-tight text-slate-900 dark:text-slate-100">CALCU</span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium tracking-wide uppercase">SupplyFinance Core</span>
            </div>
          </div>
        )}
        {collapsed && (
          <div className="w-8 h-8 mx-auto rounded-lg bg-[#00a2e8] flex items-center justify-center text-white font-bold shadow-sm">
            <Layers size={18} />
          </div>
        )}
      </div>

      {/* Navigation List Agrupada por Dominios */}
      <nav className="flex-1 py-3 px-2 space-y-4 overflow-y-auto">
        {filteredSections.map((sec, sIdx) => (
          <div key={sIdx} className="space-y-1">
            {!collapsed ? (
              <div className="px-3 pt-1.5 pb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 select-none">
                  {sec.title}
                </span>
              </div>
            ) : (
              sIdx > 0 && <div className="h-px bg-slate-100 dark:bg-slate-800 my-2 mx-1" />
            )}

            {sec.items.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => onTabChange(item.id)}
                  title={collapsed ? `${item.shortLabel} (${sec.title})` : undefined}
                  className={`w-full group flex items-center rounded-xl px-3 py-2 text-xs font-semibold transition-all relative cursor-pointer ${
                    isActive
                      ? 'bg-sky-50 dark:bg-sky-950/60 text-[#00a2e8] dark:text-sky-300 font-bold shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                >
                  {/* Active Indicator Bar */}
                  {isActive && (
                    <span className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-[#00a2e8] rounded-r-md" />
                  )}

                  <Icon
                    size={17}
                    className={`shrink-0 transition-colors ${
                      isActive ? 'text-[#00a2e8] dark:text-sky-300' : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300'
                    } ${collapsed ? 'mx-auto' : 'mr-2.5'}`}
                  />

                  {!collapsed && (
                    <span className="truncate flex-1 text-left">{item.shortLabel}</span>
                  )}

                  {!collapsed && item.badge !== undefined && (
                    <span
                      className={`ml-auto px-1.5 py-0.5 text-[10px] font-bold text-white rounded-full ${item.badgeColor}`}
                    >
                      {item.badge}
                    </span>
                  )}

                  {collapsed && item.badge !== undefined && (
                    <span className="absolute top-1.5 right-2 w-2 h-2 rounded-full bg-rose-500" />
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer / Toggle */}
      <div className="p-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
        {!collapsed && (
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Core API :8000</span>
          </div>
        )}
        <button
          onClick={onToggleCollapse}
          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors ml-auto cursor-pointer"
          title={collapsed ? 'Expandir menú' : 'Colapsar menú'}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>
    </aside>
  );
};
