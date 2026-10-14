import React, { useState, useEffect } from 'react';
import {
  Building2,
  Search,
  Plus,
  DollarSign,
  Phone,
  Mail,
  MapPin,
  AlertCircle,
  X,
  Edit2,
  Trash2,
} from 'lucide-react';
import { logisticsApi } from '../../services/logisticsApi';
import type { LogisticsClientItem, LogisticsPricing, LogisticsBranchItem } from '../../services/logisticsApi';

export const LogisticsClientsView: React.FC = () => {
  const [clients, setClients] = useState<LogisticsClientItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('TODOS');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isPricingModalOpen, setIsPricingModalOpen] = useState<boolean>(false);
  const [pricingClient, setPricingClient] = useState<LogisticsClientItem | null>(null);

  // Branch Modal State
  const [isBranchModalOpen, setIsBranchModalOpen] = useState<boolean>(false);
  const [branchClient, setBranchClient] = useState<LogisticsClientItem | null>(null);
  const [branchesList, setBranchesList] = useState<LogisticsBranchItem[]>([]);
  const [editingBranchId, setEditingBranchId] = useState<number | null>(null);
  const [branchForm, setBranchForm] = useState({
    nombre_sucursal: '',
    direccion: '',
    contacto_receptor: '',
    telefono_receptor: '',
    distancia_km_base: 10.0,
  });

  // Form State
  const [formData, setFormData] = useState({
    rut: '',
    razon_social: '',
    nombre_comercial: '',
    tipo: 'SUPERMERCADO',
    contacto_logistica: '',
    telefono: '',
    email: '',
    direccion_central: '',
    condiciones_pago: '30_DIAS',
    tarifa_almacenaje_pallet_dia: 0.45,
    tarifa_handling_bulto: 0.15,
    tarifa_etiquetado_unidad: 0.05,
    tarifa_flete_base: 45.0,
    tarifa_flete_km_adicional: 1.2,
  });

  const [pricingFormData, setPricingFormData] = useState<LogisticsPricing>({
    tarifa_almacenaje_pallet_dia: 0.45,
    tarifa_handling_bulto: 0.15,
    tarifa_etiquetado_unidad: 0.05,
    tarifa_flete_base: 45.0,
    tarifa_flete_km_adicional: 1.2,
  });

  const loadClients = async () => {
    try {
      setLoading(true);
      const data = await logisticsApi.getClients();
      setClients(data);
    } catch (err) {
      console.error('Error al cargar clientes 3PL:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClients();
  }, []);

  const handleOpenCreate = () => {
    setFormData({
      rut: '',
      razon_social: '',
      nombre_comercial: '',
      tipo: 'SUPERMERCADO',
      contacto_logistica: '',
      telefono: '',
      email: '',
      direccion_central: '',
      condiciones_pago: '30_DIAS',
      tarifa_almacenaje_pallet_dia: 0.45,
      tarifa_handling_bulto: 0.15,
      tarifa_etiquetado_unidad: 0.05,
      tarifa_flete_base: 45.0,
      tarifa_flete_km_adicional: 1.2,
    });
    setIsModalOpen(true);
  };

  const handleOpenPricing = (client: LogisticsClientItem) => {
    setPricingClient(client);
    if (client.pricing) {
      setPricingFormData(client.pricing);
    } else {
      setPricingFormData({
        tarifa_almacenaje_pallet_dia: 0.45,
        tarifa_handling_bulto: 0.15,
        tarifa_etiquetado_unidad: 0.05,
        tarifa_flete_base: 45.0,
        tarifa_flete_km_adicional: 1.2,
      });
    }
    setIsPricingModalOpen(true);
  };

  const handleSaveClient = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await logisticsApi.createClient({
        rut: formData.rut,
        razon_social: formData.razon_social,
        nombre_comercial: formData.nombre_comercial,
        tipo: formData.tipo,
        contacto_logistica: formData.contacto_logistica,
        telefono: formData.telefono,
        email: formData.email,
        direccion_central: formData.direccion_central,
        condiciones_pago: formData.condiciones_pago,
        pricing: {
          tarifa_almacenaje_pallet_dia: Number(formData.tarifa_almacenaje_pallet_dia),
          tarifa_handling_bulto: Number(formData.tarifa_handling_bulto),
          tarifa_etiquetado_unidad: Number(formData.tarifa_etiquetado_unidad),
          tarifa_flete_base: Number(formData.tarifa_flete_base),
          tarifa_flete_km_adicional: Number(formData.tarifa_flete_km_adicional),
        },
      });
      setIsModalOpen(false);
      loadClients();
    } catch (err: any) {
      alert(`Error al registrar cliente: ${err.response?.data?.detail || err.message}`);
    }
  };

  const handleSavePricing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pricingClient) return;
    try {
      await logisticsApi.updateClientPricing(pricingClient.id, {
        tarifa_almacenaje_pallet_dia: Number(pricingFormData.tarifa_almacenaje_pallet_dia),
        tarifa_handling_bulto: Number(pricingFormData.tarifa_handling_bulto),
        tarifa_etiquetado_unidad: Number(pricingFormData.tarifa_etiquetado_unidad),
        tarifa_flete_base: Number(pricingFormData.tarifa_flete_base),
        tarifa_flete_km_adicional: Number(pricingFormData.tarifa_flete_km_adicional),
      });
      setIsPricingModalOpen(false);
      loadClients();
    } catch (err: any) {
      alert(`Error al actualizar tarifas: ${err.response?.data?.detail || err.message}`);
    }
  };

  const handleOpenBranches = async (client: LogisticsClientItem) => {
    setBranchClient(client);
    setEditingBranchId(null);
    setBranchForm({
      nombre_sucursal: '',
      direccion: '',
      contacto_receptor: client.contacto_logistica || '',
      telefono_receptor: client.telefono || '',
      distancia_km_base: 10.0,
    });
    try {
      const data = await logisticsApi.getClientBranches(client.id);
      setBranchesList(data);
    } catch {
      setBranchesList(client.branches || []);
    }
    setIsBranchModalOpen(true);
  };

  const handleSaveBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!branchClient) return;
    try {
      if (editingBranchId) {
        await logisticsApi.updateBranch(editingBranchId, {
          nombre_sucursal: branchForm.nombre_sucursal,
          direccion: branchForm.direccion,
          contacto_receptor: branchForm.contacto_receptor,
          telefono_receptor: branchForm.telefono_receptor,
          distancia_km_base: Number(branchForm.distancia_km_base),
        });
      } else {
        await logisticsApi.createClientBranch(branchClient.id, {
          nombre_sucursal: branchForm.nombre_sucursal,
          direccion: branchForm.direccion,
          contacto_receptor: branchForm.contacto_receptor,
          telefono_receptor: branchForm.telefono_receptor,
          distancia_km_base: Number(branchForm.distancia_km_base),
        });
      }
      const data = await logisticsApi.getClientBranches(branchClient.id);
      setBranchesList(data);
      setEditingBranchId(null);
      setBranchForm({
        nombre_sucursal: '',
        direccion: '',
        contacto_receptor: branchClient.contacto_logistica || '',
        telefono_receptor: branchClient.telefono || '',
        distancia_km_base: 10.0,
      });
      loadClients();
    } catch (err: any) {
      alert(`Error al guardar sucursal: ${err.response?.data?.detail || err.message}`);
    }
  };

  const handleEditBranch = (b: LogisticsBranchItem) => {
    setEditingBranchId(b.id);
    setBranchForm({
      nombre_sucursal: b.nombre_sucursal,
      direccion: b.direccion,
      contacto_receptor: b.contacto_receptor || '',
      telefono_receptor: b.telefono_receptor || '',
      distancia_km_base: b.distancia_km_base || 10.0,
    });
  };

  const handleDeleteBranch = async (branchId: number) => {
    if (!branchClient || !confirm('¿Desea desactivar esta sucursal?')) return;
    try {
      await logisticsApi.deleteBranch(branchId);
      const data = await logisticsApi.getClientBranches(branchClient.id);
      setBranchesList(data);
      loadClients();
    } catch (err: any) {
      alert(`Error al eliminar sucursal: ${err.response?.data?.detail || err.message}`);
    }
  };


  const filteredClients = clients.filter((c) => {
    const matchesSearch =
      c.nombre_comercial.toLowerCase().includes(search.toLowerCase()) ||
      c.razon_social.toLowerCase().includes(search.toLowerCase()) ||
      c.rut.includes(search);
    const matchesType = typeFilter === 'TODOS' || c.tipo === typeFilter;
    return matchesSearch && matchesType;
  });

  const totalBultosGlobal = clients.reduce((acc, c) => acc + (c.total_bultos || 0), 0);
  const totalSupermercados = clients.filter((c) => c.tipo === 'SUPERMERCADO').length;
  const totalPymes = clients.filter((c) => c.tipo === 'PYME').length;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-sky-100 dark:bg-sky-950/70 text-sky-600 dark:text-sky-400">
              <Building2 size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                Directorio de Clientes 3PL
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Gestión multi-cliente para grandes superficies (Supermercados) y PyMEs de consumo masivo
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={handleOpenCreate}
          className="inline-flex items-center space-x-2 px-4 py-2 bg-[#00a2e8] hover:bg-[#008ecb] text-white rounded-xl text-xs font-semibold shadow-sm transition-colors cursor-pointer"
        >
          <Plus size={16} />
          <span>Nuevo Cliente 3PL</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Total Empresas 3PL
          </span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {clients.length}
            </span>
            <span className="text-xs text-emerald-600 font-medium">Activas</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Grandes Superficies
          </span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-sky-600 dark:text-sky-400">
              {totalSupermercados}
            </span>
            <span className="text-xs text-slate-400">Supermercados</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            PyMEs & Distribuidores
          </span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-violet-600 dark:text-violet-400">
              {totalPymes}
            </span>
            <span className="text-xs text-slate-400">Cuentas Clave</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Bultos en Custodia
          </span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {totalBultosGlobal.toLocaleString()}
            </span>
            <span className="text-xs text-slate-400">Almacén Central</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200/80 dark:border-slate-800">
        <div className="relative w-full sm:w-80">
          <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por RUT, Nombre Comercial o Razón..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-1 focus:ring-sky-500"
          />
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <span className="text-xs text-slate-500 font-medium">Segmento:</span>
          {(['TODOS', 'SUPERMERCADO', 'PYME'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                typeFilter === t
                  ? 'bg-sky-500 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
              }`}
            >
              {t === 'TODOS' ? 'Todos' : t === 'SUPERMERCADO' ? 'Supermercados' : 'PyMEs'}
            </button>
          ))}
        </div>
      </div>

      {/* Client Cards Grid */}
      {loading ? (
        <div className="p-12 text-center text-xs text-slate-400">Cargando directorio 3PL...</div>
      ) : filteredClients.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800">
          <AlertCircle className="mx-auto text-slate-400 mb-2" size={32} />
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            No se encontraron clientes con esos filtros
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredClients.map((client) => (
            <div
              key={client.id}
              className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs hover:border-sky-300 dark:hover:border-sky-800 transition-all flex flex-col justify-between"
            >
              <div>
                {/* Header card */}
                <div className="flex items-start justify-between">
                  <div>
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        client.tipo === 'SUPERMERCADO'
                          ? 'bg-sky-100 text-sky-700 dark:bg-sky-950/80 dark:text-sky-300'
                          : 'bg-purple-100 text-purple-700 dark:bg-purple-950/80 dark:text-purple-300'
                      }`}
                    >
                      {client.tipo}
                    </span>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-1.5">
                      {client.nombre_comercial}
                    </h3>
                    <p className="text-[11px] text-slate-400">{client.razon_social}</p>
                    <p className="text-[10px] font-mono text-slate-500 mt-0.5">RUT: {client.rut}</p>
                  </div>

                  <button
                    onClick={() => handleOpenPricing(client)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-sky-600 hover:bg-sky-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    title="Editar Tarifario Acordado"
                  >
                    <DollarSign size={16} />
                  </button>
                </div>

                {/* Contact & Location */}
                <div className="mt-4 space-y-1.5 text-xs text-slate-600 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800/80 pt-3">
                  {client.contacto_logistica && (
                    <div className="flex items-center space-x-2">
                      <span className="text-slate-400">👤</span>
                      <span className="truncate">{client.contacto_logistica}</span>
                    </div>
                  )}
                  {client.telefono && (
                    <div className="flex items-center space-x-2">
                      <Phone size={13} className="text-slate-400 shrink-0" />
                      <span>{client.telefono}</span>
                    </div>
                  )}
                  {client.email && (
                    <div className="flex items-center space-x-2">
                      <Mail size={13} className="text-slate-400 shrink-0" />
                      <span className="truncate">{client.email}</span>
                    </div>
                  )}
                  {client.direccion_central && (
                    <div className="flex items-center space-x-2">
                      <MapPin size={13} className="text-slate-400 shrink-0" />
                      <span className="truncate">{client.direccion_central}</span>
                    </div>
                  )}
                </div>

                {/* Stock & Orders Stats */}
                <div className="grid grid-cols-3 gap-2 mt-4 p-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-lg text-center">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">Bultos</span>
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                      {client.total_bultos}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">SKUs</span>
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                      {client.total_skus}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">Despachos</span>
                    <p className="text-sm font-bold text-sky-600 dark:text-sky-400">
                      {client.ordenes_activas}
                    </p>
                  </div>
                </div>

                {/* Pricing preview pill */}
                {client.pricing && (
                  <div className="mt-3 text-[10px] text-slate-500 bg-sky-50/60 dark:bg-sky-950/30 p-2 rounded-lg border border-sky-100 dark:border-sky-900/50">
                    <span className="font-semibold text-sky-800 dark:text-sky-300">Tarifario: </span>
                    Pallet/Día ${client.pricing.tarifa_almacenaje_pallet_dia} | Handling ${client.pricing.tarifa_handling_bulto} | Flete Base ${client.pricing.tarifa_flete_base}
                  </div>
                )}
              </div>

              {/* Actions Footer */}
              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <span className="text-[11px] font-medium text-slate-400">
                  Pago: {client.condiciones_pago.replace('_', ' ')}
                </span>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleOpenBranches(client)}
                    className="px-2.5 py-1 text-[11px] font-semibold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/50 rounded-lg hover:bg-purple-100 transition-colors cursor-pointer"
                  >
                    Sucursales ({client.branches?.length || 0})
                  </button>
                  <button
                    onClick={() => handleOpenPricing(client)}
                    className="px-2.5 py-1 text-[11px] font-semibold text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/50 rounded-lg hover:bg-sky-100 transition-colors cursor-pointer"
                  >
                    Tarifas
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Alta Cliente */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-xl w-full p-6 border border-slate-200 dark:border-slate-800 shadow-xl overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center space-x-2">
                <Building2 className="text-sky-500" size={20} />
                <span>Registrar Nuevo Cliente 3PL</span>
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveClient} className="mt-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold uppercase text-slate-500">RUT (12 Dígitos)</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: 215489720018"
                    value={formData.rut}
                    onChange={(e) => setFormData({ ...formData, rut: e.target.value })}
                    className="w-full mt-1 px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase text-slate-500">Tipo de Empresa</label>
                  <select
                    value={formData.tipo}
                    onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}
                    className="w-full mt-1 px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  >
                    <option value="SUPERMERCADO">Supermercado / Cadena Retail</option>
                    <option value="PYME">PyME / Productor</option>
                    <option value="DISTRIBUIDOR">Distribuidor Mayorista</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase text-slate-500">Nombre Comercial</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Supermercados Disco / Ta-Ta / Tienda Inglesa"
                  value={formData.nombre_comercial}
                  onChange={(e) => setFormData({ ...formData, nombre_comercial: e.target.value })}
                  className="w-full mt-1 px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase text-slate-500">Razón Social</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Grupo Disco del Uruguay S.A."
                  value={formData.razon_social}
                  onChange={(e) => setFormData({ ...formData, razon_social: e.target.value })}
                  className="w-full mt-1 px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold uppercase text-slate-500">Contacto de Logística</label>
                  <input
                    type="text"
                    placeholder="Nombre y cargo"
                    value={formData.contacto_logistica}
                    onChange={(e) => setFormData({ ...formData, contacto_logistica: e.target.value })}
                    className="w-full mt-1 px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase text-slate-500">Teléfono</label>
                  <input
                    type="text"
                    placeholder="+598 2900 ..."
                    value={formData.telefono}
                    onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                    className="w-full mt-1 px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold uppercase text-slate-500">Email Corporativo</label>
                  <input
                    type="email"
                    placeholder="logistica@empresa.com.uy"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full mt-1 px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase text-slate-500">Condición de Pago</label>
                  <select
                    value={formData.condiciones_pago}
                    onChange={(e) => setFormData({ ...formData, condiciones_pago: e.target.value })}
                    className="w-full mt-1 px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  >
                    <option value="CONTADO">Contado Contra Entrega</option>
                    <option value="30_DIAS">Crédito 30 Días</option>
                    <option value="45_DIAS">Crédito 45 Días</option>
                    <option value="60_DIAS">Crédito 60 Días</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase text-slate-500">Dirección Central / Depósito Cliente</label>
                <input
                  type="text"
                  placeholder="Calle, número, departamento"
                  value={formData.direccion_central}
                  onChange={(e) => setFormData({ ...formData, direccion_central: e.target.value })}
                  className="w-full mt-1 px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              {/* Tarifas Acordadas Iniciales */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl space-y-2 border border-slate-200 dark:border-slate-700">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                  Tarifas Iniciales Acordadas ($)
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div>
                    <label className="text-[10px] text-slate-400">Pallet / Día</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.tarifa_almacenaje_pallet_dia}
                      onChange={(e) => setFormData({ ...formData, tarifa_almacenaje_pallet_dia: parseFloat(e.target.value) || 0 })}
                      className="w-full px-2 py-1 rounded bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400">Handling Bulto</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.tarifa_handling_bulto}
                      onChange={(e) => setFormData({ ...formData, tarifa_handling_bulto: parseFloat(e.target.value) || 0 })}
                      className="w-full px-2 py-1 rounded bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400">VAS Etiquetado</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.tarifa_etiquetado_unidad}
                      onChange={(e) => setFormData({ ...formData, tarifa_etiquetado_unidad: parseFloat(e.target.value) || 0 })}
                      className="w-full px-2 py-1 rounded bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400">Flete Base ($)</label>
                    <input
                      type="number"
                      step="0.5"
                      value={formData.tarifa_flete_base}
                      onChange={(e) => setFormData({ ...formData, tarifa_flete_base: parseFloat(e.target.value) || 0 })}
                      className="w-full px-2 py-1 rounded bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-[#00a2e8] hover:bg-[#008ecb] rounded-xl cursor-pointer shadow-sm"
                >
                  Guardar Cliente 3PL
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Editar Tarifas */}
      {isPricingModalOpen && pricingClient && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-800 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Tarifario Acordado
                </h2>
                <p className="text-xs text-sky-600 dark:text-sky-400">{pricingClient.nombre_comercial}</p>
              </div>
              <button
                onClick={() => setIsPricingModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSavePricing} className="mt-4 space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Almacenaje en Racks ($/Pallet/Día)
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={pricingFormData.tarifa_almacenaje_pallet_dia}
                  onChange={(e) =>
                    setPricingFormData({
                      ...pricingFormData,
                      tarifa_almacenaje_pallet_dia: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="w-full mt-1 px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Manipulación Handling In/Out ($/Bulto)
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={pricingFormData.tarifa_handling_bulto}
                  onChange={(e) =>
                    setPricingFormData({
                      ...pricingFormData,
                      tarifa_handling_bulto: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="w-full mt-1 px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Acondicionamiento / Etiquetado VAS ($/Unidad)
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={pricingFormData.tarifa_etiquetado_unidad}
                  onChange={(e) =>
                    setPricingFormData({
                      ...pricingFormData,
                      tarifa_etiquetado_unidad: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="w-full mt-1 px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Flete Base Reparto ($/Viaje)
                </label>
                <input
                  type="number"
                  step="0.5"
                  required
                  value={pricingFormData.tarifa_flete_base}
                  onChange={(e) =>
                    setPricingFormData({
                      ...pricingFormData,
                      tarifa_flete_base: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="w-full mt-1 px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Kilómetro Excedente ($/km adicional &gt; 15 km)
                </label>
                <input
                  type="number"
                  step="0.1"
                  required
                  value={pricingFormData.tarifa_flete_km_adicional}
                  onChange={(e) =>
                    setPricingFormData({
                      ...pricingFormData,
                      tarifa_flete_km_adicional: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="w-full mt-1 px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsPricingModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 rounded-xl cursor-pointer"
                >
                  Guardar Tarifas
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Gestión de Sucursales / Direcciones */}
      {isBranchModalOpen && branchClient && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full p-6 border border-slate-200 dark:border-slate-800 shadow-xl overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center space-x-2">
                  <MapPin className="text-purple-500" size={20} />
                  <span>Sucursales & Direcciones de Entrega</span>
                </h2>
                <p className="text-xs text-purple-600 dark:text-purple-400 font-medium">
                  {branchClient.nombre_comercial} (RUT: {branchClient.rut})
                </p>
              </div>
              <button
                onClick={() => setIsBranchModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Listado de Sucursales */}
            <div className="mt-4">
              <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                Sucursales Registradas ({branchesList.length})
              </h3>
              {branchesList.length === 0 ? (
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 text-center text-xs text-slate-500 border border-slate-100 dark:border-slate-800">
                  No hay sucursales adicionales registradas. Se utiliza la dirección central por defecto.
                </div>
              ) : (
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {branchesList.map((branch) => (
                    <div
                      key={branch.id}
                      className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-between text-xs"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-slate-900 dark:text-slate-100">
                            {branch.nombre_sucursal}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 dark:bg-purple-950/80 dark:text-purple-300 font-medium">
                            {branch.distancia_km_base} km base
                          </span>
                        </div>
                        <p className="text-slate-600 dark:text-slate-400 flex items-center space-x-1">
                          <MapPin size={12} className="shrink-0 text-slate-400" />
                          <span className="truncate">{branch.direccion}</span>
                        </p>
                        {(branch.contacto_receptor || branch.telefono_receptor) && (
                          <p className="text-[11px] text-slate-500">
                            Receptor: {branch.contacto_receptor || '-'} | Tel: {branch.telefono_receptor || '-'}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center space-x-1 shrink-0 ml-2">
                        <button
                          onClick={() => handleEditBranch(branch)}
                          className="p-1.5 text-slate-400 hover:text-sky-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                          title="Editar Sucursal"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => handleDeleteBranch(branch.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                          title="Desactivar Sucursal"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Formulario Agregar / Editar Sucursal */}
            <form onSubmit={handleSaveBranch} className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center space-x-1.5">
                <span>{editingBranchId ? 'Editar Sucursal' : 'Agregar Nueva Sucursal / Destino'}</span>
                {editingBranchId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingBranchId(null);
                      setBranchForm({
                        nombre_sucursal: '',
                        direccion: '',
                        contacto_receptor: branchClient.contacto_logistica || '',
                        telefono_receptor: branchClient.telefono || '',
                        distancia_km_base: 10.0,
                      });
                    }}
                    className="text-[10px] text-sky-600 hover:underline cursor-pointer"
                  >
                    (Cancelar edición)
                  </button>
                )}
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                    Nombre Sucursal / Local
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: Sucursal Pocitos / Centro"
                    value={branchForm.nombre_sucursal}
                    onChange={(e) => setBranchForm({ ...branchForm, nombre_sucursal: e.target.value })}
                    className="w-full mt-1 px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                    Distancia Estimada desde Depósito (km)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    required
                    value={branchForm.distancia_km_base}
                    onChange={(e) =>
                      setBranchForm({ ...branchForm, distancia_km_base: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full mt-1 px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                  Dirección Completa de Descarga
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Av. Brasil 2540 esq. Brito del Pino"
                  value={branchForm.direccion}
                  onChange={(e) => setBranchForm({ ...branchForm, direccion: e.target.value })}
                  className="w-full mt-1 px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                    Encargado de Recepción
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: Encargado Depósito / Andrés Pérez"
                    value={branchForm.contacto_receptor}
                    onChange={(e) => setBranchForm({ ...branchForm, contacto_receptor: e.target.value })}
                    className="w-full mt-1 px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                    Teléfono de Contacto
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: 099 123 456"
                    value={branchForm.telefono_receptor}
                    onChange={(e) => setBranchForm({ ...branchForm, telefono_receptor: e.target.value })}
                    className="w-full mt-1 px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsBranchModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cerrar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-xl cursor-pointer shadow-sm"
                >
                  {editingBranchId ? 'Actualizar Sucursal' : 'Guardar Sucursal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
export default LogisticsClientsView;
