import React, { useState, useEffect, useMemo } from 'react';
import {
  Building2,
  Phone,
  Mail,
  MapPin,
  Plus,
  Search,
  DollarSign,
  Briefcase,
  Edit2,
  X,
  ExternalLink,
  LayoutGrid,
  List,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import api from '../../services/api';
import type { ClientItem, ClientDealItemSummary } from '../../types';

const formatCurrency = (val: number | string | undefined | null) => {
  const num = typeof val === 'number' ? val : parseFloat(String(val || 0)) || 0;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(num);
};

export const ClientsView: React.FC = () => {
  const [clients, setClients] = useState<ClientItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  // Selector de vista Dual con persistencia en localStorage
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    return (localStorage.getItem('calcu_clients_view_mode') as 'grid' | 'list') || 'grid';
  });

  const handleViewModeChange = (mode: 'grid' | 'list') => {
    setViewMode(mode);
    localStorage.setItem('calcu_clients_view_mode', mode);
  };

  // Ordenamiento interactivo
  const [sortField, setSortField] = useState<'nombre' | 'pipeline'>('pipeline');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const handleSort = (field: 'nombre' | 'pipeline') => {
    if (sortField === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder(field === 'pipeline' ? 'desc' : 'asc');
    }
  };

  // Drawer de Tratos / Ficha
  const [selectedClient, setSelectedClient] = useState<ClientItem | null>(null);

  // Modal Alta / Edición
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingClient, setEditingClient] = useState<ClientItem | null>(null);
  const [formData, setFormData] = useState({
    nombre: '',
    rut: '',
    logo_url: '',
    email: '',
    phone: '',
    address: ''
  });
  const [saving, setSaving] = useState<boolean>(false);

  const fetchClients = async (query?: string) => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getClients(query);
      setClients(data);
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Error al cargar clientes B2B.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchClients(search);
  };

  const openCreateModal = () => {
    setEditingClient(null);
    setFormData({
      nombre: '',
      rut: '',
      logo_url: 'https://images.unsplash.com/photo-1560179707-f14e90ef3623?w=120&auto=format&fit=crop&q=80',
      email: '',
      phone: '',
      address: ''
    });
    setIsModalOpen(true);
  };

  const openEditModal = (c: ClientItem) => {
    setEditingClient(c);
    setFormData({
      nombre: c.nombre,
      rut: c.rut || '',
      logo_url: c.logo_url || '',
      email: c.email || '',
      phone: c.phone || '',
      address: c.address || ''
    });
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nombre.trim()) return;

    try {
      setSaving(true);
      if (editingClient) {
        await api.updateClient(editingClient.id, formData);
      } else {
        await api.createClient(formData);
      }
      setIsModalOpen(false);
      await fetchClients(search);
    } catch (err: any) {
      alert(err?.response?.data?.detail || 'Error al guardar cliente.');
    } finally {
      setSaving(false);
    }
  };

  // KPIs
  const totalPipeline = useMemo(() => {
    return clients.reduce((acc, c) => {
      const raw = c.pipeline_activo ?? c.pipeline_total ?? c.total_pipeline ?? 0;
      const num = Number(raw) || 0;
      return acc + num;
    }, 0);
  }, [clients]);

  const totalDeals = useMemo(() => {
    return clients.reduce((acc, c) => acc + (Number(c.deals_count) || 0), 0);
  }, [clients]);

  // Clientes ordenados
  const sortedClients = useMemo(() => {
    return [...clients].sort((a, b) => {
      if (sortField === 'nombre') {
        const cmp = a.nombre.localeCompare(b.nombre);
        return sortOrder === 'asc' ? cmp : -cmp;
      }
      const valA = Number(a.pipeline_activo ?? a.pipeline_total ?? a.total_pipeline ?? 0);
      const valB = Number(b.pipeline_activo ?? b.pipeline_total ?? b.total_pipeline ?? 0);
      return sortOrder === 'asc' ? valA - valB : valB - valA;
    });
  }, [clients, sortField, sortOrder]);

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Encabezado y Toolbar Modern SaaS */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 dark:bg-blue-900/40 rounded-xl text-blue-600 dark:text-blue-400">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                Directorio B2B | Clientes & Cuentas Clave
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Fichas de contacto con enriquecimiento en vivo de tratos comerciales y volumen en pipeline.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Toggle de Vista Dual [Cuadrícula / Lista] */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200/80 dark:border-slate-700">
            <button
              onClick={() => handleViewModeChange('grid')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === 'grid'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
              title="Vista Cuadrícula"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Cuadrícula</span>
            </button>
            <button
              onClick={() => handleViewModeChange('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === 'list'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
              title="Vista Lista Compacta"
            >
              <List className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Lista</span>
            </button>
          </div>

          <form onSubmit={handleSearch} className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por nombre o RUT..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 w-48 sm:w-56 md:w-64"
            />
          </form>

          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold shadow-sm transition-all shadow-blue-500/20 active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo Cliente</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Cuentas Registradas</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">{clients.length}</p>
          </div>
          <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl text-slate-600 dark:text-slate-300">
            <Building2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Tratos Activos en Pipeline</p>
            <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">{totalDeals}</p>
          </div>
          <div className="p-3 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl text-indigo-600 dark:text-indigo-400">
            <Briefcase className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Volumen Total Pipeline</p>
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
              {formatCurrency(totalPipeline)}
            </p>
          </div>
          <div className="p-3 bg-emerald-50 dark:bg-emerald-900/30 rounded-xl text-emerald-600 dark:text-emerald-400">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Grid o Tabla Compacta de Fichas de Contacto B2B */}
      {loading ? (
        <div className="py-20 text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent mb-3" />
          <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Cargando directorio de clientes...</p>
        </div>
      ) : error ? (
        <div className="p-4 bg-rose-50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-700 dark:text-rose-300 text-sm">
          {error}
        </div>
      ) : clients.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 text-slate-500 dark:text-slate-400">
          <Building2 className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
          <p className="text-base font-semibold text-slate-800 dark:text-slate-200">No se encontraron clientes</p>
          <p className="text-xs mt-1">Registra una nueva cuenta comercial o sincroniza los tratos del pipeline.</p>
        </div>
      ) : viewMode === 'list' ? (
        /* Vista de Tabla Compacta de Alta Densidad */
        <div className="overflow-x-auto rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-200/80 dark:border-slate-800">
              <tr>
                <th 
                  onClick={() => handleSort('nombre')}
                  className="py-3 px-4 font-semibold cursor-pointer select-none hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                >
                  <div className="flex items-center space-x-1">
                    <span>Empresa / Cliente</span>
                    {sortField === 'nombre' ? (
                      sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-blue-600" /> : <ArrowDown className="w-3 h-3 text-blue-600" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-40" />
                    )}
                  </div>
                </th>
                <th className="py-3 px-4 font-semibold">RUT</th>
                <th className="py-3 px-4 font-semibold">Contacto Directo</th>
                <th 
                  onClick={() => handleSort('pipeline')}
                  className="py-3 px-4 font-semibold cursor-pointer select-none hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                >
                  <div className="flex items-center space-x-1">
                    <span>Pipeline Activo ($)</span>
                    {sortField === 'pipeline' ? (
                      sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-blue-600" /> : <ArrowDown className="w-3 h-3 text-blue-600" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-40" />
                    )}
                  </div>
                </th>
                <th className="py-3 px-4 font-semibold text-center">Tratos Abiertos</th>
                <th className="py-3 px-4 font-semibold text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {sortedClients.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <img
                        src={c.logo_url || 'https://images.unsplash.com/photo-1560179707-f14e90ef3623?w=80&auto=format&fit=crop&q=80'}
                        alt={c.nombre}
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1560179707-f14e90ef3623?w=80&auto=format&fit=crop&q=80';
                        }}
                        className="w-8 h-8 rounded-lg object-cover border border-slate-200 dark:border-slate-700 bg-slate-50 shrink-0"
                      />
                      <span className="font-bold text-slate-900 dark:text-slate-100">{c.nombre}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 font-mono text-[11px] text-slate-600 dark:text-slate-400">
                    {c.rut || '—'}
                  </td>
                  <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                    <div className="flex flex-col gap-0.5">
                      {c.email && (
                        <a href={`mailto:${c.email}`} className="truncate hover:text-blue-600 dark:hover:text-blue-400">
                          {c.email}
                        </a>
                      )}
                      {c.phone && (
                        <a href={`tel:${c.phone}`} className="text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 text-[11px]">
                          {c.phone}
                        </a>
                      )}
                      {!c.email && !c.phone && <span className="text-slate-400 italic">Sin contacto</span>}
                    </div>
                  </td>
                  <td className="py-3 px-4 font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                    {formatCurrency(c.pipeline_activo ?? c.pipeline_total ?? c.total_pipeline)}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                      {c.deals_count || 0} tratos
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        onClick={() => setSelectedClient(c)}
                        title="Ver tratos"
                        className="p-1.5 rounded-lg text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => openEditModal(c)}
                        title="Editar cliente"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        /* Vista Cuadrícula */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {sortedClients.map((c) => (
            <div
              key={c.id}
              className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group"
            >
              <div>
                {/* Cabecera de la ficha */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <img
                      src={c.logo_url || 'https://images.unsplash.com/photo-1560179707-f14e90ef3623?w=80&auto=format&fit=crop&q=80'}
                      alt={c.nombre}
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1560179707-f14e90ef3623?w=80&auto=format&fit=crop&q=80';
                      }}
                      className="w-12 h-12 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shadow-sm bg-slate-50"
                    />
                    <div>
                      <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base leading-snug group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        {c.nombre}
                      </h3>
                      {c.rut && (
                        <span className="inline-block px-2 py-0.5 mt-0.5 rounded text-[11px] font-mono font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                          RUT: {c.rut}
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => openEditModal(c)}
                    title="Editar ficha"
                    className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Datos de contacto */}
                <div className="mt-4 space-y-2 text-xs text-slate-600 dark:text-slate-300">
                  {c.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      <a href={`mailto:${c.email}`} className="truncate hover:text-blue-600 dark:hover:text-blue-400">
                        {c.email}
                      </a>
                    </div>
                  )}
                  {c.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      <a href={`tel:${c.phone}`} className="hover:text-blue-600 dark:hover:text-blue-400">
                        {c.phone}
                      </a>
                    </div>
                  )}
                  {c.address && (
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      <span className="truncate">{c.address}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Métricas y Acción */}
              <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-medium">Pipeline Activo</span>
                  <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(c.pipeline_activo ?? c.pipeline_total ?? c.total_pipeline)}
                  </span>
                </div>

                <button
                  onClick={() => setSelectedClient(c)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs font-semibold hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                >
                  <span>{c.deals_count} Tratos</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Drawer Lateral de Tratos Vinculados */}
      {selectedClient && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/50 backdrop-blur-sm flex justify-end animate-fadeIn">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 h-full shadow-2xl p-6 flex flex-col justify-between border-l border-slate-200 dark:border-slate-800 overflow-y-auto">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <img
                    src={selectedClient.logo_url || 'https://images.unsplash.com/photo-1560179707-f14e90ef3623?w=80&auto=format&fit=crop&q=80'}
                    alt={selectedClient.nombre}
                    className="w-10 h-10 rounded-xl object-cover border border-slate-200 dark:border-slate-700"
                  />
                  <div>
                    <h2 className="font-bold text-slate-900 dark:text-slate-100 text-base">{selectedClient.nombre}</h2>
                    <p className="text-xs text-slate-500">Pipeline: {formatCurrency(selectedClient.pipeline_activo ?? selectedClient.pipeline_total ?? selectedClient.total_pipeline)}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedClient(null)}
                  className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="mt-6">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
                  Tratos en Negociación ({selectedClient.deals?.length || 0})
                </h4>

                {(!selectedClient.deals || selectedClient.deals.length === 0) ? (
                  <p className="text-xs text-slate-500 italic py-4">No hay tratos comerciales activos vinculados a este cliente.</p>
                ) : (
                  <div className="space-y-3">
                    {selectedClient.deals.map((d: ClientDealItemSummary) => (
                      <div
                        key={d.deal_id}
                        className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex flex-col gap-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400">
                            {d.deal_code}
                          </span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300">
                            {d.etapa}
                          </span>
                        </div>
                        <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">{d.deal_title}</p>
                        <div className="flex items-center justify-between text-xs mt-1">
                          <span className="text-slate-500">Monto:</span>
                          <span className="font-bold text-emerald-600 dark:text-emerald-400">
                            {formatCurrency(d.monto_total)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-500">Probabilidad:</span>
                          <span className="font-medium text-slate-700 dark:text-slate-300">{d.probabilidad_pct}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setSelectedClient(null)}
                className="w-full py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition-colors"
              >
                Cerrar Detalle
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Crear / Editar Cliente */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 animate-scaleUp">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-lg">
                {editingClient ? 'Editar Cliente B2B' : 'Nuevo Cliente B2B'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Nombre o Razón Social *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Distribuidora Conosur SpA"
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">RUT Empresa</label>
                <input
                  type="text"
                  placeholder="Ej: 76.452.120-K"
                  value={formData.rut}
                  onChange={(e) => setFormData({ ...formData, rut: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">URL Logo Corporativo</label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={formData.logo_url}
                  onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Email de Contacto</label>
                  <input
                    type="email"
                    placeholder="contacto@empresa.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Teléfono</label>
                  <input
                    type="tel"
                    placeholder="+56 9 1234 5678"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Dirección Matriz</label>
                <input
                  type="text"
                  placeholder="Av. Providencia 1234, Santiago"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-semibold rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 text-sm font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition-all shadow-sm shadow-blue-500/20 disabled:opacity-50"
                >
                  {saving ? 'Guardando...' : editingClient ? 'Actualizar Cliente' : 'Crear Cliente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientsView;
